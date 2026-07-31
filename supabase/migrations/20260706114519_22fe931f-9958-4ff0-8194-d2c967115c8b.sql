CREATE OR REPLACE FUNCTION public.email_new_action_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'website' THEN
    PERFORM net.http_post(
      url := 'https://cwwkkhcpbswvwghxbfgg.supabase.co/functions/v1/notify-new-action-item',
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