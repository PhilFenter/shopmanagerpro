-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Admins and managers can view all profiles (for team management)
CREATE POLICY "Managers can view all profiles"
ON public.profiles
FOR SELECT
USING (has_financial_access(auth.uid()));