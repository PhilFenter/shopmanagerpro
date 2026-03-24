CREATE POLICY "Team members can view workers"
ON public.workers FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);