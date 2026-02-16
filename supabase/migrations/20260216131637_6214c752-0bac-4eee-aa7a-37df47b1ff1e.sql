
-- Pricing matrices: flexible JSONB storage for different service types
CREATE TABLE public.pricing_matrices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  column_headers JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- column_headers example for screen print: ["1 color","2 color",...,"Product Markup %"]
-- rows example: [{"quantity":12,"prices":[3.57,4.56,...],"markup":200}, ...]

ALTER TABLE public.pricing_matrices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pricing matrices"
  ON public.pricing_matrices FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert pricing matrices"
  ON public.pricing_matrices FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pricing matrices"
  ON public.pricing_matrices FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pricing matrices"
  ON public.pricing_matrices FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pricing_matrices_updated_at
  BEFORE UPDATE ON public.pricing_matrices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  raw_email TEXT,
  total_price NUMERIC DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  converted_job_id UUID REFERENCES public.jobs(id)
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quotes"
  ON public.quotes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create quotes"
  ON public.quotes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update quotes"
  ON public.quotes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete quotes"
  ON public.quotes FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quote line items
CREATE TABLE public.quote_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  style_number TEXT,
  description TEXT,
  service_type TEXT NOT NULL DEFAULT 'other',
  quantity INTEGER NOT NULL DEFAULT 1,
  sizes JSONB DEFAULT '{}'::jsonb,
  garment_cost NUMERIC DEFAULT 0,
  garment_markup_pct NUMERIC DEFAULT 200,
  decoration_cost NUMERIC DEFAULT 0,
  decoration_params JSONB DEFAULT '{}'::jsonb,
  line_total NUMERIC DEFAULT 0,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- decoration_params stores the lookup keys, e.g. {"colors": 2} or {"stitch_range": "0 - 5000 Stitches"}

ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quote line items"
  ON public.quote_line_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create quote line items"
  ON public.quote_line_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update quote line items"
  ON public.quote_line_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete quote line items"
  ON public.quote_line_items FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_quote_line_items_updated_at
  BEFORE UPDATE ON public.quote_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate quote numbers
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.quote_number := 'Q-' || LPAD(EXTRACT(EPOCH FROM now())::bigint::text, 10, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  WHEN (NEW.quote_number IS NULL)
  EXECUTE FUNCTION public.generate_quote_number();
