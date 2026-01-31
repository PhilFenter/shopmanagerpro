-- Allow authenticated users to view all profiles (needed for team member selection)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can still only update their own profile
-- The existing update policy already handles this