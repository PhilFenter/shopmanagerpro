
-- Notify all team members when a new action item comes in (quote requests, etc.)
CREATE OR REPLACE FUNCTION public.fanout_action_item_new()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  source_label text;
  title_text text;
  body_text text;
BEGIN
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

DROP TRIGGER IF EXISTS trg_fanout_action_item_new ON public.action_items;
CREATE TRIGGER trg_fanout_action_item_new
AFTER INSERT ON public.action_items
FOR EACH ROW
EXECUTE FUNCTION public.fanout_action_item_new();
