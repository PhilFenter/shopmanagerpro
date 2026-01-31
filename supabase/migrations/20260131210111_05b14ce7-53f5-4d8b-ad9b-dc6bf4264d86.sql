-- Create job stage enum with 8 progression stages
CREATE TYPE public.job_stage AS ENUM (
  'received',
  'art_approved', 
  'in_production',
  'production_complete',
  'qc_complete',
  'packaged',
  'customer_notified',
  'delivered'
);

-- Add stage column to jobs (default to received)
ALTER TABLE public.jobs 
ADD COLUMN stage public.job_stage NOT NULL DEFAULT 'received';

-- Add timestamp for when stage was last updated
ALTER TABLE public.jobs
ADD COLUMN stage_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create notification settings table (configurable per-stage notifications)
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage public.job_stage NOT NULL,
  notify_customer BOOLEAN NOT NULL DEFAULT false,
  email_template TEXT,
  sms_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(stage)
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage notification settings
CREATE POLICY "Admins can view notification settings"
ON public.notification_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert notification settings"
ON public.notification_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update notification settings"
ON public.notification_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete notification settings"
ON public.notification_settings FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Insert default notification settings for each stage
INSERT INTO public.notification_settings (stage, notify_customer) VALUES
  ('received', false),
  ('art_approved', false),
  ('in_production', false),
  ('production_complete', false),
  ('qc_complete', false),
  ('packaged', false),
  ('customer_notified', true),
  ('delivered', false);

-- Create stage history table to track all transitions
CREATE TABLE public.job_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  from_stage public.job_stage,
  to_stage public.job_stage NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on stage history
ALTER TABLE public.job_stage_history ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view stage history
CREATE POLICY "Authenticated users can view stage history"
ON public.job_stage_history FOR SELECT
USING (true);

-- Authenticated users can insert stage history
CREATE POLICY "Authenticated users can insert stage history"
ON public.job_stage_history FOR INSERT
WITH CHECK (auth.uid() = changed_by);

-- Migrate existing status to stage
UPDATE public.jobs SET stage = 
  CASE 
    WHEN status = 'pending' THEN 'received'::public.job_stage
    WHEN status = 'in_progress' THEN 'in_production'::public.job_stage
    WHEN status = 'completed' THEN 'delivered'::public.job_stage
    WHEN status = 'on_hold' THEN 'received'::public.job_stage
    ELSE 'received'::public.job_stage
  END;