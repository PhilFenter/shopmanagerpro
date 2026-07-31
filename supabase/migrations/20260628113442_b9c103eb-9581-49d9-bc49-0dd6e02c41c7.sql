
CREATE TABLE public.job_prints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  design_name text NOT NULL,
  artwork_url text,
  location text NOT NULL,
  width_in numeric,
  height_in numeric,
  garment_color text,
  ink_colors jsonb DEFAULT '[]'::jsonb,
  mesh_count integer,
  squeegee_durometer integer,
  strokes integer,
  flash boolean DEFAULT false,
  underbase boolean DEFAULT false,
  flash_temp integer,
  flash_time integer,
  cure_temp integer,
  cure_time integer,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_prints TO authenticated;
GRANT ALL ON public.job_prints TO service_role;

ALTER TABLE public.job_prints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view job prints" ON public.job_prints
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert job prints" ON public.job_prints
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update job prints" ON public.job_prints
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete job prints" ON public.job_prints
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_job_prints_job_id ON public.job_prints(job_id);

CREATE TRIGGER update_job_prints_updated_at
  BEFORE UPDATE ON public.job_prints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.job_garment_prints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garment_id uuid NOT NULL REFERENCES public.job_garments(id) ON DELETE CASCADE,
  print_id uuid NOT NULL REFERENCES public.job_prints(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(garment_id, print_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_garment_prints TO authenticated;
GRANT ALL ON public.job_garment_prints TO service_role;

ALTER TABLE public.job_garment_prints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view garment prints" ON public.job_garment_prints
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert garment prints" ON public.job_garment_prints
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update garment prints" ON public.job_garment_prints
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete garment prints" ON public.job_garment_prints
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_jgp_garment_id ON public.job_garment_prints(garment_id);
CREATE INDEX idx_jgp_print_id ON public.job_garment_prints(print_id);
