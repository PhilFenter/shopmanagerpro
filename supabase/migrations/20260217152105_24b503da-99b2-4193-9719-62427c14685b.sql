
-- Add custom_label for renaming stage display text
ALTER TABLE public.notification_settings
  ADD COLUMN custom_label text DEFAULT NULL;

-- Add email_subject for per-stage subject line
ALTER TABLE public.notification_settings
  ADD COLUMN email_subject text DEFAULT NULL;

-- Add is_custom flag for user-created notification triggers
ALTER TABLE public.notification_settings
  ADD COLUMN is_custom boolean NOT NULL DEFAULT false;
