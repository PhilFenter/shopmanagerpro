-- Update Shopify sync cron to use 120 second timeout
SELECT cron.unschedule(1);
SELECT cron.schedule(
  'shopify-daily-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cwwkkhcpbswvwghxbfgg.supabase.co/functions/v1/shopify-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3d2traGNwYnN3dndnaHhiZmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4OTAyNzAsImV4cCI6MjA4NTQ2NjI3MH0.GgiUbQy3j6l9GjtOLE_1tPhtiWgv7EThjFv_5rJsJog"}'::jsonb,
    body := '{"dateRange": "30days"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);

-- Update Printavo sync cron to use 120 second timeout
SELECT cron.unschedule(2);
SELECT cron.schedule(
  'printavo-daily-sync',
  '5 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cwwkkhcpbswvwghxbfgg.supabase.co/functions/v1/printavo-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3d2traGNwYnN3dndnaHhiZmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4OTAyNzAsImV4cCI6MjA4NTQ2NjI3MH0.GgiUbQy3j6l9GjtOLE_1tPhtiWgv7EThjFv_5rJsJog"}'::jsonb,
    body := '{"dateRange": "30days"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);