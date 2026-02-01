-- Add column to store the original Printavo status for pipeline visualization
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS printavo_status TEXT;

-- Add an index for filtering by printavo_status
CREATE INDEX IF NOT EXISTS idx_jobs_printavo_status ON public.jobs(printavo_status) WHERE printavo_status IS NOT NULL;