CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

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

DROP INDEX IF EXISTS public.idx_customers_name_trgm;
DROP INDEX IF EXISTS public.idx_customers_email_trgm;
DROP INDEX IF EXISTS public.idx_customers_company_trgm;

CREATE INDEX IF NOT EXISTS idx_customers_source ON public.customers (source);
CREATE INDEX IF NOT EXISTS idx_customers_last_order_date ON public.customers (last_order_date);

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

  SELECT count(*)
    INTO v_pareto_count
    FROM (
      SELECT sum(coalesce(total_revenue, 0))
               OVER (ORDER BY coalesce(total_revenue, 0) DESC, id) AS running
        FROM public.customers
    ) s
   WHERE s.running - 0 <= v_total_revenue * 0.8
      OR s.running IS NULL;

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

UPDATE public.workers w
   SET profile_id = p.id
  FROM public.profiles p
 WHERE w.profile_id IS NULL
   AND lower(trim(p.full_name)) = lower(trim(w.name))
   AND (
     SELECT count(*) FROM public.profiles p2
      WHERE lower(trim(p2.full_name)) = lower(trim(w.name))
   ) = 1;

CREATE OR REPLACE FUNCTION public.current_worker_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id
    FROM public.workers w
    JOIN public.profiles p ON p.id = w.profile_id
   WHERE p.user_id = auth.uid()
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_worker_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_worker_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_workers_safe()
RETURNS TABLE (
  id         uuid,
  name       text,
  is_active  boolean,
  profile_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT w.id, w.name, w.is_active, w.profile_id
      FROM public.workers w
     ORDER BY w.is_active DESC, w.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_workers_safe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workers_safe() TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.shifts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id  uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  note       text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shifts_end_after_start CHECK (ends_at > starts_at)
);

ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_no_overlap;
ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_no_overlap
  EXCLUDE USING gist (
    worker_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  );

CREATE INDEX IF NOT EXISTS idx_shifts_starts_at ON public.shifts (starts_at);
CREATE INDEX IF NOT EXISTS idx_shifts_worker_id ON public.shifts (worker_id);

DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.shifts;
CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view shifts"    ON public.shifts;
DROP POLICY IF EXISTS "Users can create their own shifts"      ON public.shifts;
DROP POLICY IF EXISTS "Users can update their own shifts"      ON public.shifts;
DROP POLICY IF EXISTS "Users can delete their own shifts"      ON public.shifts;

CREATE POLICY "Authenticated users can view shifts"
  ON public.shifts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create their own shifts"
  ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (
    worker_id = public.current_worker_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

CREATE POLICY "Users can update their own shifts"
  ON public.shifts FOR UPDATE TO authenticated
  USING (
    worker_id = public.current_worker_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  WITH CHECK (
    worker_id = public.current_worker_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

CREATE POLICY "Users can delete their own shifts"
  ON public.shifts FOR DELETE TO authenticated
  USING (
    worker_id = public.current_worker_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_shift(
  p_worker_id uuid,
  p_starts_at timestamptz,
  p_ends_at   timestamptz,
  p_note      text DEFAULT NULL
)
RETURNS public.shifts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
  v_note  text;
  v_row   public.shifts;
BEGIN
  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'end time must be after start time';
  END IF;

  SELECT least(min(s.starts_at), p_starts_at),
         greatest(max(s.ends_at), p_ends_at),
         min(s.note) FILTER (WHERE s.note IS NOT NULL)
    INTO v_start, v_end, v_note
    FROM public.shifts s
   WHERE s.worker_id = p_worker_id
     AND (
       tstzrange(s.starts_at, s.ends_at) && tstzrange(p_starts_at, p_ends_at)
       OR tstzrange(s.starts_at, s.ends_at) -|- tstzrange(p_starts_at, p_ends_at)
     );

  DELETE FROM public.shifts s
   WHERE s.worker_id = p_worker_id
     AND (
       tstzrange(s.starts_at, s.ends_at) && tstzrange(p_starts_at, p_ends_at)
       OR tstzrange(s.starts_at, s.ends_at) -|- tstzrange(p_starts_at, p_ends_at)
     );

  INSERT INTO public.shifts (worker_id, starts_at, ends_at, note, created_by)
  VALUES (
    p_worker_id,
    coalesce(v_start, p_starts_at),
    coalesce(v_end, p_ends_at),
    coalesce(p_note, v_note),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_shift(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_shift(uuid, timestamptz, timestamptz, text) TO authenticated, service_role;