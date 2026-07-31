-- Close policies that reach the `anon` role, and lock down two functions.
--
-- A policy written without a TO clause defaults to TO public, which includes
-- anon. Combined with USING (true) that means "anyone holding the published
-- anon key", not "any signed-in user" as the policy names suggest.

-- ── job_line_items ─────────────────────────────────────────────────────────
-- Sale price and material cost live here, so this was the worst of them:
-- readable AND writable without an account.
DROP POLICY IF EXISTS "Authenticated users can view job line items" ON public.job_line_items;
DROP POLICY IF EXISTS "Authenticated users can create job line items" ON public.job_line_items;
DROP POLICY IF EXISTS "Authenticated users can update job line items" ON public.job_line_items;

CREATE POLICY "Authenticated users can view job line items"
ON public.job_line_items FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create job line items"
ON public.job_line_items FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update job line items"
ON public.job_line_items FOR UPDATE TO authenticated
USING (true);

-- ── job_garments ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view job garments" ON public.job_garments;
DROP POLICY IF EXISTS "Authenticated users can create job garments" ON public.job_garments;
DROP POLICY IF EXISTS "Authenticated users can update job garments" ON public.job_garments;

CREATE POLICY "Authenticated users can view job garments"
ON public.job_garments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create job garments"
ON public.job_garments FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update job garments"
ON public.job_garments FOR UPDATE TO authenticated
USING (true);

-- ── skills ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "skills_select" ON public.skills;

CREATE POLICY "skills_select"
ON public.skills FOR SELECT TO authenticated
USING (true);

-- ── notifications ──────────────────────────────────────────────────────────
-- Was WITH CHECK (true), so any signed-in user could forge a notification for
-- any other user — and every insert fires trg_notification_push, turning it
-- into a push-spam primitive. System fanout runs through SECURITY DEFINER
-- triggers and the service role, both of which bypass RLS, so restricting this
-- to self-inserts does not affect them.
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;

CREATE POLICY "Users insert own notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ── get_team_members_safe() ────────────────────────────────────────────────
-- SECURITY DEFINER with no auth.uid() check: the ELSE branch returned every
-- row in profiles, and EXECUTE is granted to PUBLIC by default, so an
-- unauthenticated RPC call returned the whole staff roster.
CREATE OR REPLACE FUNCTION public.get_team_members_safe()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  avatar_url text,
  hourly_rate numeric,
  is_salary boolean,
  monthly_salary numeric,
  weekly_hours numeric
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

  IF public.has_financial_access(auth.uid()) THEN
    RETURN QUERY
      SELECT p.id, p.user_id, p.full_name, p.avatar_url,
             p.hourly_rate, p.is_salary, p.monthly_salary, p.weekly_hours
      FROM profiles p;
  ELSE
    RETURN QUERY
      SELECT p.id, p.user_id, p.full_name, p.avatar_url,
             NULL::numeric as hourly_rate,
             NULL::boolean as is_salary,
             NULL::numeric as monthly_salary,
             NULL::numeric as weekly_hours
      FROM profiles p;
  END IF;
END;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and anon inherits that. Revoking
-- from anon alone would leave the PUBLIC grant in place and change nothing, so
-- drop PUBLIC and re-grant explicitly. This function is only ever called over
-- RPC (src/hooks/useTeamMembers.ts) and is not referenced by any policy, so
-- narrowing it cannot break policy evaluation.
REVOKE EXECUTE ON FUNCTION public.get_team_members_safe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_members_safe() TO authenticated, service_role;

-- Deliberately NOT revoked: has_role() and has_financial_access(). They are
-- referenced by ~75 RLS policies, most written without a TO clause and so
-- evaluated for anon as well. Dropping the PUBLIC grant would turn "policy
-- denies the row" into "permission denied for function has_role" on any
-- anonymous request touching those tables. The remaining exposure is an
-- unauthenticated "is user X an admin?" oracle, which is not worth that
-- trade; fix it by adding TO authenticated to those policies first.

-- ── quote-artwork storage bucket ───────────────────────────────────────────
-- Anonymous upload stays: the public quote form lets visitors attach artwork
-- before they have an account. Uploads are now bounded by type and size so the
-- bucket cannot be used as general-purpose file hosting on our domain.
UPDATE storage.buckets
SET file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = ARRAY[
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
      'image/vnd.adobe.photoshop', 'application/postscript', 'application/pdf'
    ]
WHERE id = 'quote-artwork';
