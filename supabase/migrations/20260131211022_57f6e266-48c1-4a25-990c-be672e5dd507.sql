-- Add new end stage values to the enum
ALTER TYPE public.job_stage ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE public.job_stage ADD VALUE IF NOT EXISTS 'shipped';