
-- Allow mockups to be linked to quotes (not just jobs)
ALTER TABLE public.job_mockups 
  ALTER COLUMN job_id DROP NOT NULL,
  ADD COLUMN quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE;

-- Add constraint: must have either job_id or quote_id
ALTER TABLE public.job_mockups 
  ADD CONSTRAINT mockup_job_or_quote CHECK (job_id IS NOT NULL OR quote_id IS NOT NULL);

-- Index for quote lookups
CREATE INDEX idx_job_mockups_quote_id ON public.job_mockups(quote_id) WHERE quote_id IS NOT NULL;

-- RLS policies already cover authenticated users for CRUD, no changes needed
