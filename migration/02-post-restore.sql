-- Post-restore fixes. Run in the NEW project's SQL editor, in this order,
-- AFTER pg_restore finishes and BEFORE applying the Phase 0 security migration.
--
-- Replace fzkxeodjkaeqkwqhwcdv with the new project ref before running.
-- Do not commit a copy with real values filled in.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. GRANTS — do not skip
-- ═══════════════════════════════════════════════════════════════════════════
-- The restore runs with --no-acl, because the dump's grants reference Lovable
-- roles (sandbox_exec_cwwkkhcpbswvwghxbfgg, dashboard_user) that do not exist
-- here. That leaves every restored table with no privileges for anon or
-- authenticated. Symptom: "permission denied for table X" on every query, even
-- though the RLS policies restored correctly — grants and RLS are two separate
-- layers and both must pass. This is the same failure hit on Ramp Commander.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Future objects created by postgres/supabase_admin inherit the same.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- NOTE ON ORDERING: the blanket EXECUTE grant above re-opens
-- get_team_members_safe() to anon. The Phase 0 migration
-- (20260730120000_close_anon_rls_holes.sql) revokes it again. Run Phase 0
-- AFTER this file, never before.


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Re-create the auth.users signup trigger
-- ═══════════════════════════════════════════════════════════════════════════
-- auth.users is restored --data-only, so the trigger attached to it is not
-- restored. Without this, new signups silently get no profiles row and no
-- user_roles row, and then fail every RLS policy that calls has_role().
-- The function itself lives in public and IS restored; only the trigger is
-- missing. Definition mirrors supabase/migrations/20260504153646_*.sql.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Repoint the two trigger functions that hardcode the OLD project URL
-- ═══════════════════════════════════════════════════════════════════════════
-- Without this the new database keeps calling the old project's edge functions
-- forever — pushes and new-quote emails would fire against Lovable Cloud.
-- Sources: 20260424003633_*.sql:186 and 20260706114519_*.sql:10.

CREATE OR REPLACE FUNCTION public.trigger_push_send()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://fzkxeodjkaeqkwqhwcdv.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.body,
      'link', NEW.link,
      'data', NEW.data
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_new_action_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'website' THEN
    PERFORM net.http_post(
      url := 'https://fzkxeodjkaeqkwqhwcdv.supabase.co/functions/v1/notify-new-action-item',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'action_item', jsonb_build_object(
          'id', NEW.id,
          'source', NEW.source,
          'title', NEW.title,
          'description', NEW.description,
          'customer_name', NEW.customer_name,
          'priority', NEW.priority,
          'quote_id', NEW.quote_id
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Advance quote_number_seq
-- ═══════════════════════════════════════════════════════════════════════════
-- Only sequence in the schema. Quotes created before 2026-03-15 use 10-digit
-- epoch numbers (Q-1771234567) from the old generate_quote_number(); quotes
-- after use Q-1001, Q-1002... A naive MAX() over all quote_numbers would set
-- the sequence to ~1.7 billion. Match only the modern short format.

SELECT setval('public.quote_number_seq',
  GREATEST(1000, COALESCE((
    SELECT MAX(substring(quote_number from '^Q-(\d{1,6})$')::bigint)
    FROM public.quotes
    WHERE quote_number ~ '^Q-\d{1,6}$'
  ), 1000))
);

-- Sanity check — expect a low four-digit number, NOT billions.
SELECT last_value AS quote_seq_now FROM public.quote_number_seq;
