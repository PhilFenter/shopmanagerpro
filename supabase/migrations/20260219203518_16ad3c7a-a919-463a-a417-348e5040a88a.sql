
-- Add paid_at and due_date columns to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS due_date timestamp with time zone;

-- Create a function to calculate business days (skips weekends)
CREATE OR REPLACE FUNCTION public.add_business_days(start_date timestamp with time zone, num_days integer)
RETURNS timestamp with time zone
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  current_date_val date := start_date::date;
  days_added integer := 0;
BEGIN
  WHILE days_added < num_days LOOP
    current_date_val := current_date_val + 1;
    -- Skip weekends (6 = Saturday, 0 = Sunday)
    IF EXTRACT(DOW FROM current_date_val) NOT IN (0, 6) THEN
      days_added := days_added + 1;
    END IF;
  END LOOP;
  RETURN current_date_val::timestamp with time zone;
END;
$$;

-- Create a trigger to auto-calculate due_date when paid_at is set
CREATE OR REPLACE FUNCTION public.calculate_due_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- When paid_at is set and due_date is not manually provided
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD.paid_at IS DISTINCT FROM NEW.paid_at) THEN
    IF NEW.due_date IS NULL OR (OLD IS NOT NULL AND OLD.due_date IS NOT DISTINCT FROM NEW.due_date) THEN
      NEW.due_date := public.add_business_days(NEW.paid_at, 13);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_job_due_date
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_due_date();
