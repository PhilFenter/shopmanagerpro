-- Allow all authenticated users to read business settings (thread templates, etc.)
CREATE POLICY "Authenticated users can view business settings"
  ON public.business_settings FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to update business settings (thread template editing)
CREATE POLICY "Authenticated users can update business settings"
  ON public.business_settings FOR UPDATE
  TO authenticated
  USING (true);
