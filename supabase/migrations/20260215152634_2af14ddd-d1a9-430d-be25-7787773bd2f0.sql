-- Add tax_collected column to jobs table
ALTER TABLE public.jobs ADD COLUMN tax_collected numeric DEFAULT 0;

-- Backfill: set to 0 for existing jobs
UPDATE public.jobs SET tax_collected = 0 WHERE tax_collected IS NULL;