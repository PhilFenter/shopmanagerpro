-- Remove the jobs we just created and recreate with service role key
SELECT cron.unschedule('shopify-daily-sync');
SELECT cron.unschedule('printavo-daily-sync');

SELECT cron.schedule(
  'shopify-daily-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/shopify-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"dateRange": "30days"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'printavo-daily-sync',
  '5 6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/printavo-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"dateRange": "30days"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);