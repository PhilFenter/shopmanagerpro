
-- Drop the DB trigger since we handle notifications client-side
DROP TRIGGER IF EXISTS on_job_stage_change_notify ON public.jobs;
DROP FUNCTION IF EXISTS public.notify_customer_on_stage_change();

-- Add RLS policies for notification_settings (if not already present)
-- Allow authenticated users to read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notification_settings' AND policyname = 'Authenticated can read notification settings'
  ) THEN
    CREATE POLICY "Authenticated can read notification settings"
      ON public.notification_settings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Allow admins/managers to update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notification_settings' AND policyname = 'Admins can update notification settings'
  ) THEN
    CREATE POLICY "Admins can update notification settings"
      ON public.notification_settings FOR UPDATE TO authenticated
      USING (public.has_financial_access(auth.uid()));
  END IF;
END $$;
