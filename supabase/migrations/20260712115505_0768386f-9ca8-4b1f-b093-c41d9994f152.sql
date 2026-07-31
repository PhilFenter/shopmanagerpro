UPDATE public.jobs
SET status = 'completed',
    completed_at = COALESCE(completed_at, NOW())
WHERE stage IN ('delivered', 'picked_up', 'shipped')
  AND status != 'completed';