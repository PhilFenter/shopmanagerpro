-- Recreate the scheduled jobs on the NEW project.
--
-- There are SEVEN cron jobs on the live Lovable database, not the two that
-- appear in supabase/migrations/. Five were created through Lovable's dashboard
-- and exist in no migration file. Recovered from cron.job in the 2026-07-31 dump:
--
--   jobid  schedule      name                                function
--   9      0 6 * * *     shopify-daily-sync                  shopify-sync
--   10     5 6 * * *     printavo-daily-sync                 printavo-sync
--   11     0 6 * * *     printavo-quote-status-sync-morning  printavo-quote-status-sync
--   12     0 18 * * *    printavo-quote-status-sync-evening  printavo-quote-status-sync
--   13     0 14 * * *    quote-follow-up-daily               quote-follow-up
--   14     10 6 * * *    printavo-quote-import-morning       printavo-quote-import
--   15     10 18 * * *   printavo-quote-import-evening       printavo-quote-import
--
-- All seven authenticated with the PUBLIC ANON KEY, hardcoded into each command.
-- That is why the edge functions had anon-key bypasses: the cron depended on
-- them. They now use the service-role key instead, held in Vault.
--
-- PREREQUISITES — run these first, once, substituting real values:
--   select vault.create_secret('https://fzkxeodjkaeqkwqhwcdv.supabase.co', 'project_url');
--   select vault.create_secret('<<NEW_SERVICE_ROLE_KEY>>', 'service_role_key');
-- Do not commit a copy with real values filled in.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. One helper, instead of seven hardcoded URLs and seven copies of a key
-- ═══════════════════════════════════════════════════════════════════════════
-- Deliberately NOT in the public schema. This function calls any edge function
-- with the service-role key, so exposing it over PostgREST would be a privilege
-- escalation for any signed-in user. PostgREST serves only public (and
-- graphql_public), so `internal` is unreachable from the API.

CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION internal.call_edge_function(fn_name text, payload jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = internal, public
AS $$
DECLARE
  base_url text;
  svc_key  text;
  req_id   bigint;
BEGIN
  SELECT decrypted_secret INTO base_url
  FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;

  SELECT decrypted_secret INTO svc_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF base_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'call_edge_function: vault secrets project_url/service_role_key are not set; skipping %', fn_name;
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := base_url || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || svc_key
               ),
    body    := payload,
    timeout_milliseconds := 120000
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION internal.call_edge_function(text, jsonb) FROM PUBLIC, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. The seven schedules
-- ═══════════════════════════════════════════════════════════════════════════
-- Unschedule by NAME, never by numeric jobid — the old migration
-- (20260221191434) used cron.unschedule(1) and would fail or hit the wrong job.

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'shopify-daily-sync', 'printavo-daily-sync',
  'printavo-quote-status-sync-morning', 'printavo-quote-status-sync-evening',
  'quote-follow-up-daily',
  'printavo-quote-import-morning', 'printavo-quote-import-evening'
);

SELECT cron.schedule('shopify-daily-sync', '0 6 * * *',
  $$SELECT internal.call_edge_function('shopify-sync');$$);

SELECT cron.schedule('printavo-daily-sync', '5 6 * * *',
  $$SELECT internal.call_edge_function('printavo-sync');$$);

SELECT cron.schedule('printavo-quote-status-sync-morning', '0 6 * * *',
  $$SELECT internal.call_edge_function('printavo-quote-status-sync');$$);

SELECT cron.schedule('printavo-quote-status-sync-evening', '0 18 * * *',
  $$SELECT internal.call_edge_function('printavo-quote-status-sync');$$);

SELECT cron.schedule('quote-follow-up-daily', '0 14 * * *',
  $$SELECT internal.call_edge_function('quote-follow-up', '{"dry_run": false}'::jsonb);$$);

SELECT cron.schedule('printavo-quote-import-morning', '10 6 * * *',
  $$SELECT internal.call_edge_function('printavo-quote-import');$$);

SELECT cron.schedule('printavo-quote-import-evening', '10 18 * * *',
  $$SELECT internal.call_edge_function('printavo-quote-import');$$);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Verify
-- ═══════════════════════════════════════════════════════════════════════════
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Smoke-test one without waiting for the schedule (should return a request id,
-- not NULL — NULL means the vault secrets are missing):
--   SELECT internal.call_edge_function('printavo-quote-import');
-- Then check the result:
--   SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 1;
