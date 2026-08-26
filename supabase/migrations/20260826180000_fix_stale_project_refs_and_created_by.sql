-- Two fixes found while diagnosing the Aug 1-21 stranded-quotes incident:
--
-- 1. action_items.created_by was NOT NULL, which pushed the website's public
--    quote endpoint into writing a placeholder all-zero UUID for every
--    website-sourced item (there's no authenticated user to attribute it to).
--    fanout_action_item_new() already treats NEW.created_by IS NULL as "no
--    specific owner" (see its WHERE clause below), so NULL is the value this
--    trigger was actually designed for — allow it for real instead of faking
--    an identity.
ALTER TABLE public.action_items ALTER COLUMN created_by DROP NOT NULL;

-- 2. Both of these SECURITY DEFINER trigger functions still hardcode the
--    Lovable Cloud project (cwwkkhcpbswvwghxbfgg) this database was migrated
--    off of on 2026-08-01 (see migration e0cf881 in git history). Every push
--    notification and new-action-item email alert has been silently posting
--    to a project this app no longer uses since that migration.
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
  IF NEW.source IN ('website', 'shopify-sync') THEN
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
