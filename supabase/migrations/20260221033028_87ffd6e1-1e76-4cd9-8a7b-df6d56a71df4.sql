
-- Add new columns to job_garments for enhanced garment selection
ALTER TABLE public.job_garments
  ADD COLUMN IF NOT EXISTS vendor text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS decoration_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS placement text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS markup_pct numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS decoration_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_sell_price numeric DEFAULT NULL;
