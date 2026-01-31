-- Create a helper function to check if user has financial access (admin or manager)
CREATE OR REPLACE FUNCTION public.has_financial_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'manager'::app_role)
  )
$$;

-- Create a view for team member data that hides financial info from non-managers
CREATE VIEW public.team_members_public
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  created_at,
  updated_at,
  -- Only show financial fields if user has financial access
  CASE WHEN public.has_financial_access(auth.uid()) THEN hourly_rate ELSE NULL END as hourly_rate,
  CASE WHEN public.has_financial_access(auth.uid()) THEN is_salary ELSE NULL END as is_salary,
  CASE WHEN public.has_financial_access(auth.uid()) THEN monthly_salary ELSE NULL END as monthly_salary,
  CASE WHEN public.has_financial_access(auth.uid()) THEN weekly_hours ELSE NULL END as weekly_hours
FROM public.profiles;

-- Create a view for jobs that hides financial info from non-managers
CREATE VIEW public.jobs_with_access
WITH (security_invoker = on) AS
SELECT 
  id,
  order_number,
  invoice_number,
  customer_name,
  customer_email,
  customer_phone,
  description,
  service_type,
  quantity,
  status,
  stage,
  stage_updated_at,
  time_tracked,
  timer_started_at,
  created_by,
  created_at,
  updated_at,
  completed_at,
  source,
  external_id,
  -- Only show financial fields if user has financial access
  CASE WHEN public.has_financial_access(auth.uid()) THEN sale_price ELSE NULL END as sale_price,
  CASE WHEN public.has_financial_access(auth.uid()) THEN material_cost ELSE NULL END as material_cost
FROM public.jobs;