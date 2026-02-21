
-- Create job_mockups table for mockup version history
CREATE TABLE public.job_mockups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  garment_id UUID REFERENCES public.job_garments(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  is_approval_version BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by_customer BOOLEAN DEFAULT false,
  customer_notes TEXT,
  placement TEXT,
  canvas_state JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_mockups ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view mockups"
  ON public.job_mockups FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create mockups"
  ON public.job_mockups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update mockups"
  ON public.job_mockups FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete mockups"
  ON public.job_mockups FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookup
CREATE INDEX idx_job_mockups_job_id ON public.job_mockups(job_id);
CREATE INDEX idx_job_mockups_garment_id ON public.job_mockups(garment_id);
