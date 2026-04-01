
-- Fix business_settings policies
DROP POLICY IF EXISTS "Admins can update business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Admins can insert business settings" ON public.business_settings;

-- Only admin/manager can update settings
CREATE POLICY "Financial role can update business settings"
  ON public.business_settings FOR UPDATE
  TO authenticated
  USING (public.has_financial_access(auth.uid()))
  WITH CHECK (public.has_financial_access(auth.uid()));

-- Only admin/manager can insert settings
CREATE POLICY "Financial role can insert business settings"
  ON public.business_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_financial_access(auth.uid()));

-- Fix 3: Secure team_members_public view
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
