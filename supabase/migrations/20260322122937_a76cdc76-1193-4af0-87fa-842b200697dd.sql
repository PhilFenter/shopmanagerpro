ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS follow_up_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_quotes_follow_up
  ON public.quotes (status, converted_job_id, follow_up_sent_at, created_at)
  WHERE status = 'draft' AND converted_job_id IS NULL AND follow_up_sent_at IS NULL;