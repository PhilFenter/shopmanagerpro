-- Server-side customer search and analytics.
--
-- The Customers page fetched every row and filtered in the browser. PostgREST
-- caps a response at 1000 rows, so with 1411 customers the newest ones (sorted
-- last by total_revenue) were never returned and could not be found by search.
-- The aggregate figures on that page also reduced over the truncated array, so
-- total revenue, average LTV, the Pareto split and the category breakdown were
-- all quietly computed from a subset.
--
-- Filtering and aggregation now happen in Postgres, which is correct at any
-- number of customers.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Trigram indexes so ILIKE '%term%' does not seq-scan
-- ═══════════════════════════════════════════════════════════════════════════
-- A btree index cannot serve a leading-wildcard match. The existing
-- idx_customers_name / idx_customers_email are useless for this search.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- One column holding everything the search box matches on, so the query is a
-- single indexed ILIKE rather than a four-way OR.
--
-- tags[1] rather than array_to_string(tags, ' '): a generated column requires an
-- IMMUTABLE expression and array_to_string is not. Subscripting is. This loses
-- nothing — no customer has more than one tag, and customer_analytics() below
-- already treats tags[1] as *the* category, so first-tag is the data model.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (
    coalesce(name, '')    || ' ' ||
    coalesce(email, '')   || ' ' ||
    coalesce(company, '') || ' ' ||
    coalesce(tags[1], '')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_customers_search_trgm
  ON public.customers USING gin (search_text extensions.gin_trgm_ops);

-- Superseded by idx_customers_search_trgm.
DROP INDEX IF EXISTS public.idx_customers_name_trgm;
DROP INDEX IF EXISTS public.idx_customers_email_trgm;
DROP INDEX IF EXISTS public.idx_customers_company_trgm;

-- Supports the source filter and the sources dropdown.
CREATE INDEX IF NOT EXISTS idx_customers_source ON public.customers (source);
-- Supports the last-order date range filter.
CREATE INDEX IF NOT EXISTS idx_customers_last_order_date ON public.customers (last_order_date);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. customer_analytics()
-- ═══════════════════════════════════════════════════════════════════════════
-- One round trip returning every aggregate the page needs, computed over all
-- customers rather than a page of them. Payload stays a few KB no matter how
-- many customers exist.
--
-- SECURITY DEFINER with an explicit gate: this returns revenue figures, and the
-- page is already restricted to financial roles client-side. Enforcing it here
-- as well means the numbers cannot be read straight off the API by a team-role
-- account.

CREATE OR REPLACE FUNCTION public.customer_analytics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result            jsonb;
  v_total_revenue   numeric;
  v_total_customers bigint;
  v_pareto_count    bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_financial_access(auth.uid()) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(sum(coalesce(total_revenue, 0)), 0), count(*)
    INTO v_total_revenue, v_total_customers
    FROM public.customers;

  -- How many customers make up the first 80% of revenue. Mirrors the previous
  -- client-side loop: walk highest revenue first, stop once the running total
  -- reaches the threshold.
  SELECT count(*)
    INTO v_pareto_count
    FROM (
      SELECT sum(coalesce(total_revenue, 0))
               OVER (ORDER BY coalesce(total_revenue, 0) DESC, id) AS running
        FROM public.customers
    ) s
   WHERE s.running - 0 <= v_total_revenue * 0.8
      OR s.running IS NULL;

  -- The walk must include the row that crosses the threshold, not stop before it.
  v_pareto_count := least(v_pareto_count + 1, greatest(v_total_customers, 1));

  SELECT jsonb_build_object(
    'total_customers',      v_total_customers,
    'total_revenue',        v_total_revenue,
    'avg_ltv',              CASE WHEN v_total_customers > 0
                                 THEN v_total_revenue / v_total_customers ELSE 0 END,
    'pareto_customer_count', v_pareto_count,
    'pareto_percent',       CASE WHEN v_total_customers > 0
                                 THEN round((v_pareto_count::numeric / v_total_customers) * 100, 1)
                                 ELSE 0 END,

    'categories', coalesce((
      SELECT jsonb_agg(c ORDER BY (c->>'revenue')::numeric DESC)
        FROM (
          SELECT jsonb_build_object(
                   'name',    coalesce(tags[1], 'Uncategorized'),
                   'count',   count(*),
                   'revenue', coalesce(sum(coalesce(total_revenue, 0)), 0)
                 ) AS c
            FROM public.customers
           GROUP BY coalesce(tags[1], 'Uncategorized')
        ) t
    ), '[]'::jsonb),

    'top_customers', coalesce((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY coalesce(t.total_revenue, 0) DESC)
        FROM (
          SELECT id, name, company, email, total_revenue, total_orders, last_order_date
            FROM public.customers
           ORDER BY coalesce(total_revenue, 0) DESC, id
           LIMIT 20
        ) t
    ), '[]'::jsonb),

    -- Downsampled to at most 100 points. The chart cannot resolve more than
    -- that, and sending one point per customer is what made this expensive.
    'pareto_curve', coalesce((
      SELECT jsonb_agg(p ORDER BY (p->>'customerPercent')::numeric)
        FROM (
          SELECT DISTINCT ON (bucket)
                 jsonb_build_object(
                   'customerPercent', round((rn::numeric / greatest(v_total_customers, 1)) * 100, 2),
                   'revenuePercent',  CASE WHEN v_total_revenue > 0
                                           THEN round((running / v_total_revenue) * 100, 2)
                                           ELSE 0 END,
                   'name',            name,
                   'revenue',         coalesce(revenue, 0)
                 ) AS p,
                 bucket
            FROM (
              SELECT name,
                     total_revenue AS revenue,
                     row_number() OVER (ORDER BY coalesce(total_revenue, 0) DESC, id) AS rn,
                     sum(coalesce(total_revenue, 0))
                       OVER (ORDER BY coalesce(total_revenue, 0) DESC, id)            AS running,
                     ntile(100) OVER (ORDER BY coalesce(total_revenue, 0) DESC, id)   AS bucket
                FROM public.customers
            ) ranked
           ORDER BY bucket, rn DESC
        ) curve
    ), '[]'::jsonb),

    'sources', coalesce((
      SELECT jsonb_agg(DISTINCT coalesce(source, 'manual'))
        FROM public.customers
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_analytics() TO authenticated, service_role;
