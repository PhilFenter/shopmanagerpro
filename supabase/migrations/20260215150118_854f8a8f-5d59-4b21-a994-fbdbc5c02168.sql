
-- Product catalog for supplier pricing (SanMar, S&S, etc.)
CREATE TABLE public.product_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  style_number text NOT NULL,
  description text,
  brand text,
  category text,
  color_group text,
  size_range text,
  case_price numeric DEFAULT 0,
  piece_price numeric DEFAULT 0,
  price_code text,
  msrp numeric DEFAULT 0,
  map_price numeric DEFAULT 0,
  supplier text NOT NULL DEFAULT 'sanmar',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast style number lookups
CREATE INDEX idx_product_catalog_style ON public.product_catalog(style_number);
CREATE INDEX idx_product_catalog_supplier ON public.product_catalog(supplier);

-- Unique constraint to prevent duplicates (same style + size + supplier)
CREATE UNIQUE INDEX idx_product_catalog_unique ON public.product_catalog(style_number, size_range, supplier);

-- Enable RLS
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view catalog
CREATE POLICY "Authenticated users can view product catalog"
  ON public.product_catalog FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins can manage catalog
CREATE POLICY "Admins can insert product catalog"
  ON public.product_catalog FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update product catalog"
  ON public.product_catalog FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete product catalog"
  ON public.product_catalog FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Timestamp trigger
CREATE TRIGGER update_product_catalog_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
