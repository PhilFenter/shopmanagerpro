-- Fix cron body to use startDate parameter instead of dateRange
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
    body := jsonb_build_object('startDate', to_char(now() - interval '30 days', 'YYYY-MM-DD')),
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
    body := jsonb_build_object('startDate', to_char(now() - interval '30 days', 'YYYY-MM-DD')),
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);