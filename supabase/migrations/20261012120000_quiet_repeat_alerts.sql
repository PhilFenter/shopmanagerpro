-- 1. Shopify "Missing price" items: remember every style we've flagged so a
--    deleted/closed item isn't recreated (and re-emailed) on every nightly sync.
CREATE TABLE IF NOT EXISTS public.shopify_flagged_styles (
  style text PRIMARY KEY,
  first_flagged_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shopify_flagged_styles ENABLE ROW LEVEL SECURITY;
-- Only the service role (shopify-sync) reads/writes this table; no client policies.

-- Seed with every style already flagged so none of them re-alert.
INSERT INTO public.shopify_flagged_styles (style)
SELECT DISTINCT trim(substring(title from 'Missing price: (.*)$'))
FROM public.action_items
WHERE source = 'shopify-sync' AND title LIKE 'Missing price: %'
ON CONFLICT DO NOTHING;
INSERT INTO public.shopify_flagged_styles (style)
VALUES ('40'), ('40OZ'), ('937'), ('112P')
ON CONFLICT DO NOTHING;

-- 2. Nightly website health check: its test action item (source 'health-check')
--    is created and deleted within the same request. Don't fan it out to the
--    in-app notification bell. (The email trigger already ignores this source.)
CREATE OR REPLACE FUNCTION public.fanout_action_item_new()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_label text;
  title_text text;
  body_text text;
BEGIN
  IF NEW.source = 'health-check' THEN
    RETURN NEW;
  END IF;

  source_label := CASE NEW.source
    WHEN 'website' THEN 'Website quote request'
    WHEN 'shopify-sync' THEN 'Shopify order'
    WHEN 'manual' THEN 'New action item'
    ELSE COALESCE(NEW.source, 'New action item')
  END;

  title_text := source_label
    || CASE WHEN NEW.customer_name IS NOT NULL AND NEW.customer_name <> ''
            THEN ': ' || NEW.customer_name
            ELSE '' END;

  body_text := COALESCE(NULLIF(NEW.title, ''), NEW.description, 'Tap to review');

  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  SELECT
    p.user_id,
    'action_item_new',
    title_text,
    LEFT(body_text, 200),
    '/action-items',
    jsonb_build_object(
      'action_item_id', NEW.id,
      'source', NEW.source,
      'priority', NEW.priority,
      'customer_name', NEW.customer_name,
      'quote_id', NEW.quote_id
    )
  FROM public.profiles p
  WHERE NEW.created_by IS NULL OR p.user_id <> NEW.created_by;

  RETURN NEW;
END;
$$;
