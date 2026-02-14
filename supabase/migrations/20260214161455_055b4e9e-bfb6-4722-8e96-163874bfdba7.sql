
-- Seed notification_settings with 5 key stages for Shopify notifications
-- First clear any existing rows to avoid duplicates
DELETE FROM public.notification_settings;

INSERT INTO public.notification_settings (stage, notify_customer, email_template) VALUES
  ('received', true, 'Hi {{customer_name}}, we''ve received your order #{{order_number}}! We''ll keep you updated as it progresses through production. Thank you for choosing Hell''s Canyon Designs!'),
  ('in_production', true, 'Hi {{customer_name}}, great news! Your order #{{order_number}} is now in production. We''ll let you know when it''s complete.'),
  ('production_complete', true, 'Hi {{customer_name}}, your order #{{order_number}} has finished production and is being prepared for delivery. Almost there!'),
  ('shipped', true, 'Hi {{customer_name}}, your order #{{order_number}} has been shipped! Keep an eye out for delivery.'),
  ('picked_up', true, 'Hi {{customer_name}}, your order #{{order_number}} is ready for pickup! Stop by at your convenience.');

-- Add the remaining stages with notifications disabled by default
INSERT INTO public.notification_settings (stage, notify_customer, email_template) VALUES
  ('art_approved', false, 'Hi {{customer_name}}, the artwork for your order #{{order_number}} has been approved and we''re moving forward!'),
  ('product_ordered', false, 'Hi {{customer_name}}, materials for your order #{{order_number}} have been ordered.'),
  ('product_arrived', false, 'Hi {{customer_name}}, materials for your order #{{order_number}} have arrived.'),
  ('product_staged', false, 'Hi {{customer_name}}, your order #{{order_number}} is staged and ready for production.'),
  ('qc_complete', false, 'Hi {{customer_name}}, your order #{{order_number}} has passed quality control.'),
  ('packaged', false, 'Hi {{customer_name}}, your order #{{order_number}} has been packaged.'),
  ('customer_notified', false, 'Hi {{customer_name}}, your order #{{order_number}} notification has been sent.'),
  ('delivered', false, 'Hi {{customer_name}}, your order #{{order_number}} has been delivered. Enjoy!');

-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function that fires on stage change for Shopify jobs
CREATE OR REPLACE FUNCTION public.notify_customer_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _should_notify boolean;
  _template text;
  _supabase_url text;
  _service_role_key text;
BEGIN
  -- Only fire if stage actually changed
  IF OLD.stage = NEW.stage THEN
    RETURN NEW;
  END IF;

  -- Only for Shopify orders
  IF NEW.source IS NULL OR NEW.source != 'shopify' THEN
    RETURN NEW;
  END IF;

  -- Customer must have an email
  IF NEW.customer_email IS NULL OR NEW.customer_email = '' THEN
    RETURN NEW;
  END IF;

  -- Check if this stage has notifications enabled
  SELECT notify_customer, email_template
  INTO _should_notify, _template
  FROM public.notification_settings
  WHERE stage = NEW.stage::text::job_stage
  LIMIT 1;

  IF NOT _should_notify OR _template IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get secrets for the HTTP call
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _service_role_key := current_setting('app.settings.service_role_key', true);

  -- Call the notify-customer edge function via pg_net
  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/notify-customer',
    body := jsonb_build_object(
      'job_id', NEW.id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'order_number', COALESCE(NEW.order_number, NEW.invoice_number, 'N/A'),
      'stage', NEW.stage,
      'template', _template
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_role_key
    )
  );

  RETURN NEW;
END;
$$;

-- Create the trigger on the jobs table
CREATE TRIGGER on_job_stage_change_notify
  AFTER UPDATE OF stage ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_on_stage_change();
