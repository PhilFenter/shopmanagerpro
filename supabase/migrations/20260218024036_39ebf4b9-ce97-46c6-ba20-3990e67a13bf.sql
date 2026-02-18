
-- Message templates for reusable content
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'both')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates" ON public.message_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can create templates" ON public.message_templates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update templates" ON public.message_templates FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete templates" ON public.message_templates FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Customer messages / communication log
CREATE TABLE public.customer_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'internal_note')),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  body TEXT NOT NULL,
  recipient TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'delivered', 'failed', 'read')),
  external_id TEXT,
  sent_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view messages" ON public.customer_messages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create messages" ON public.customer_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sent_by);
CREATE POLICY "Authenticated users can update messages" ON public.customer_messages FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete messages" ON public.customer_messages FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_customer_messages_updated_at BEFORE UPDATE ON public.customer_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed some default templates
INSERT INTO public.message_templates (name, category, subject, body, channel) VALUES
  ('Order Received', 'order_update', 'Your order has been received!', 'Hi {{customer_name}},

Thank you for your order #{{order_number}}! We''ve received it and will begin processing shortly.

We''ll keep you updated as your order progresses through production.

Thanks,
Hell''s Canyon Designs', 'email'),
  ('Production Started', 'order_update', 'Your order is in production!', 'Hi {{customer_name}},

Great news! Your order #{{order_number}} has moved into production. Our team is working on it now.

We''ll let you know when it''s ready for pickup or shipment.

Thanks,
Hell''s Canyon Designs', 'email'),
  ('Ready for Pickup', 'order_update', 'Your order is ready!', 'Hi {{customer_name}},

Your order #{{order_number}} is complete and ready for pickup! Stop by anytime during business hours.

Thanks,
Hell''s Canyon Designs', 'both'),
  ('Follow-Up', 'sales', 'Following up on your project', 'Hi {{customer_name}},

I wanted to follow up on our recent conversation about your project. We''d love to help bring your vision to life.

Let me know if you have any questions or would like to move forward!

Best,
Hell''s Canyon Designs', 'email'),
  ('Thank You', 'relationship', 'Thank you for your business!', 'Hi {{customer_name}},

Thank you for choosing Hell''s Canyon Designs! We truly appreciate your business and hope you love the finished product.

We''d love to work with you again in the future. Don''t hesitate to reach out!

Best,
Hell''s Canyon Designs', 'email'),
  ('SMS Order Update', 'order_update', NULL, 'Hi {{customer_name}}, your order #{{order_number}} is {{stage}}. Questions? Reply to this message or call us!', 'sms');
