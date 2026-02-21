
-- Add comprehensive customer and business fields to quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'ID',
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS is_nonprofit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apply_sales_tax BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 6.0,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS shipping_address TEXT,
  ADD COLUMN IF NOT EXISTS requested_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS po_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'due_on_receipt',
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

-- Add color and placement to quote_line_items  
ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS placement TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;
