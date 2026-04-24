
-- Push subscriptions per user/device
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subs select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own push subs insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own push subs update" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own push subs delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

-- In-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL, -- handoff_new, handoff_acknowledged, handoff_completed, handoff_comment
  title text NOT NULL,
  body text,
  link text,
  data jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: when a new handoff is created, fanout to all users with relevant role
-- Simpler: notify all authenticated users (small team). We'll just create rows for all profiles.
CREATE OR REPLACE FUNCTION public.fanout_handoff_new()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_rec RECORD;
BEGIN
  SELECT customer_name, order_number INTO job_rec FROM public.jobs WHERE id = NEW.job_id;
  
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  SELECT 
    p.user_id,
    'handoff_new',
    'New handoff: ' || COALESCE(job_rec.customer_name, 'Job') || ' → ' || NEW.to_dept,
    LEFT(NEW.message, 200),
    '/handoffs',
    jsonb_build_object(
      'handoff_id', NEW.id,
      'job_id', NEW.job_id,
      'from_dept', NEW.from_dept,
      'to_dept', NEW.to_dept,
      'priority', NEW.priority
    )
  FROM public.profiles p
  WHERE p.user_id <> NEW.created_by;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handoff_new_notify
AFTER INSERT ON public.job_handoffs
FOR EACH ROW EXECUTE FUNCTION public.fanout_handoff_new();

-- Trigger on status updates
CREATE OR REPLACE FUNCTION public.fanout_handoff_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_rec RECORD;
  notif_type text;
  notif_title text;
  actor uuid;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  
  SELECT customer_name INTO job_rec FROM public.jobs WHERE id = NEW.job_id;
  
  IF NEW.status = 'acknowledged' THEN
    notif_type := 'handoff_acknowledged';
    notif_title := 'Handoff acknowledged: ' || COALESCE(job_rec.customer_name, 'Job');
    actor := NEW.acknowledged_by;
  ELSIF NEW.status = 'completed' THEN
    notif_type := 'handoff_completed';
    notif_title := 'Handoff completed: ' || COALESCE(job_rec.customer_name, 'Job');
    actor := NEW.completed_by;
  ELSE
    RETURN NEW;
  END IF;
  
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  SELECT 
    p.user_id,
    notif_type,
    notif_title,
    NEW.from_dept || ' → ' || NEW.to_dept,
    '/handoffs',
    jsonb_build_object('handoff_id', NEW.id, 'job_id', NEW.job_id)
  FROM public.profiles p
  WHERE p.user_id <> COALESCE(actor, NEW.created_by);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handoff_status_notify
AFTER UPDATE ON public.job_handoffs
FOR EACH ROW EXECUTE FUNCTION public.fanout_handoff_status();

-- Trigger on new handoff comments
CREATE OR REPLACE FUNCTION public.fanout_handoff_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ho RECORD;
  job_rec RECORD;
BEGIN
  SELECT * INTO ho FROM public.job_handoffs WHERE id = NEW.handoff_id;
  SELECT customer_name INTO job_rec FROM public.jobs WHERE id = ho.job_id;
  
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  SELECT 
    p.user_id,
    'handoff_comment',
    'New comment on handoff: ' || COALESCE(job_rec.customer_name, 'Job'),
    LEFT(NEW.body, 200),
    '/handoffs',
    jsonb_build_object('handoff_id', NEW.handoff_id, 'job_id', ho.job_id)
  FROM public.profiles p
  WHERE p.user_id <> NEW.created_by;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handoff_comment_notify
AFTER INSERT ON public.job_handoff_comments
FOR EACH ROW EXECUTE FUNCTION public.fanout_handoff_comment();

-- After a notification is inserted, call edge function to send push
CREATE OR REPLACE FUNCTION public.trigger_push_send()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://cwwkkhcpbswvwghxbfgg.supabase.co/functions/v1/send-push',
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

CREATE TRIGGER trg_notification_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trigger_push_send();
