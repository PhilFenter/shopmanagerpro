
-- 1. Fix job_stage_history: restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can view stage history" ON public.job_stage_history;
CREATE POLICY "Authenticated users can view stage history"
  ON public.job_stage_history FOR SELECT
  TO authenticated
  USING (true);

-- 2. Fix business_settings: drop overly permissive SELECT and UPDATE
DROP POLICY IF EXISTS "Authenticated users can view business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Authenticated users can update business settings" ON public.business_settings;

-- Allow team to read non-sensitive settings only
CREATE POLICY "Team can view non-sensitive settings"
  ON public.business_settings FOR SELECT
  TO authenticated
  USING (key NOT IN ('dropbox_refresh_token'));

-- 3. Drop the team_members_public view that exposes compensation data
DROP VIEW IF EXISTS public.team_members_public;
