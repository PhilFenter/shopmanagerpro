-- Backfill completed_at for completed jobs that are missing it
UPDATE jobs 
SET completed_at = updated_at 
WHERE status = 'completed' AND completed_at IS NULL;

-- Create a trigger to auto-set completed_at when status changes to 'completed'
CREATE OR REPLACE FUNCTION public.set_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_completed_at_on_complete
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_completed_at();