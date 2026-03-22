
-- Drop the overly permissive SELECT policy
DROP POLICY "Authenticated users can view workers" ON public.workers;

-- Admins/managers see all worker data (including compensation)
CREATE POLICY "Managers can view all workers"
  ON public.workers FOR SELECT TO public
  USING (has_financial_access(auth.uid()));

-- Team members can see workers but only non-financial columns via a view
-- For now, restrict full table access to managers; team uses team_members_public view
