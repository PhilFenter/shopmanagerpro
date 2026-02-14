
-- Add new stages to job_stage enum
ALTER TYPE public.job_stage ADD VALUE IF NOT EXISTS 'product_ordered' AFTER 'art_approved';
ALTER TYPE public.job_stage ADD VALUE IF NOT EXISTS 'product_arrived' AFTER 'product_ordered';
ALTER TYPE public.job_stage ADD VALUE IF NOT EXISTS 'product_staged' AFTER 'product_arrived';
