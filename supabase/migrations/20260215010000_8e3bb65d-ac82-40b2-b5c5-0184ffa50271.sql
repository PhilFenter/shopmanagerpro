
-- Table to store garment details from Printavo line items
CREATE TABLE public.job_garments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  style TEXT,              -- garment name e.g. "Gildan G500"
  item_number TEXT,        -- catalog/item number
  color TEXT,
  description TEXT,
  sizes JSONB DEFAULT '{}',  -- e.g. {"S": 2, "M": 5, "L": 10, "XL": 3}
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  printavo_line_item_id TEXT,  -- external reference
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_garments ENABLE ROW LEVEL SECURITY;

-- Policies: same pattern as job_line_items
CREATE POLICY "Authenticated users can view job garments"
  ON public.job_garments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create job garments"
  ON public.job_garments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update job garments"
  ON public.job_garments FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete job garments"
  ON public.job_garments FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups by job
CREATE INDEX idx_job_garments_job_id ON public.job_garments(job_id);

-- Updated_at trigger
CREATE TRIGGER update_job_garments_updated_at
  BEFORE UPDATE ON public.job_garments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
