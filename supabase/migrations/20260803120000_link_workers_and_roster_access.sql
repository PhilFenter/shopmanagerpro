-- Connect the two lists of people, and expose the roster without exposing pay.
--
-- The app has had two unrelated person tables since the beginning:
--   profiles  — one row per login, created by the handle_new_user trigger
--   workers   — the payroll roster: free-text name, hourly_rate, salary fields
-- workers.profile_id has existed the whole time and was never populated, so
-- there is currently no way to answer "which roster entry is this logged-in
-- person?". The schedule feature needs exactly that, for self-service shifts.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Backfill the link where the name is unambiguous
-- ═══════════════════════════════════════════════════════════════════════════
-- Only links when exactly one profile matches the worker's name, so a
-- duplicate or near-duplicate name is left alone rather than guessed at.
-- Anything not matched here is linked afterwards through the Team page.

UPDATE public.workers w
   SET profile_id = p.id
  FROM public.profiles p
 WHERE w.profile_id IS NULL
   AND lower(trim(p.full_name)) = lower(trim(w.name))
   AND (
     SELECT count(*) FROM public.profiles p2
      WHERE lower(trim(p2.full_name)) = lower(trim(w.name))
   ) = 1;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. current_worker_id()
-- ═══════════════════════════════════════════════════════════════════════════
-- Resolves auth.uid() -> profiles.user_id -> workers.profile_id -> workers.id.
-- SECURITY DEFINER because a team-role user cannot read `workers` directly
-- (that table holds pay rates and is restricted to admins/managers).
-- Returns NULL when the caller has no roster entry; callers must handle that.

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


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. get_workers_safe()
-- ═══════════════════════════════════════════════════════════════════════════
-- The schedule shows everyone's name, so every authenticated user needs to read
-- the roster. But `workers` SELECT is deliberately admin/manager-only because
-- the table carries hourly_rate, monthly_salary, is_salary and weekly_hours.
--
-- Rather than loosening that policy, this returns the four non-sensitive
-- columns and nothing else — there is no compensation data to leak, so no
-- role-based blanking is needed. Same approach as get_team_members_safe().

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


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Let admins set the link from the Team page
-- ═══════════════════════════════════════════════════════════════════════════
-- workers UPDATE is already admin-only (20260131231650_*.sql), which covers the
-- new "linked login" control. Nothing to change here — noted so the next reader
-- does not go looking for a missing policy.
