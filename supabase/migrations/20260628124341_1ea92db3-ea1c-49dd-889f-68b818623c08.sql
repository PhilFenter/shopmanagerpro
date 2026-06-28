
DROP POLICY IF EXISTS "Authenticated users can create job garments" ON public.job_garments;
DROP POLICY IF EXISTS "Authenticated users can update job garments" ON public.job_garments;
CREATE POLICY "Authenticated users can create job garments"
  ON public.job_garments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_garments.job_id));
CREATE POLICY "Authenticated users can update job garments"
  ON public.job_garments FOR UPDATE
  USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_garments.job_id))
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_garments.job_id));

DROP POLICY IF EXISTS "Authenticated users can create job line items" ON public.job_line_items;
DROP POLICY IF EXISTS "Authenticated users can update job line items" ON public.job_line_items;
CREATE POLICY "Authenticated users can create job line items"
  ON public.job_line_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_line_items.job_id));
CREATE POLICY "Authenticated users can update job line items"
  ON public.job_line_items FOR UPDATE
  USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_line_items.job_id))
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_line_items.job_id));
