
-- Create quote_imprints table for decoration/imprint groups
CREATE TABLE public.quote_imprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  decoration_type TEXT NOT NULL DEFAULT 'screen_print',
  matrix_id UUID REFERENCES public.pricing_matrices(id) ON DELETE SET NULL,
  column_value TEXT,
  placement TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quote_imprints ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view quote imprints"
  ON public.quote_imprints FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create quote imprints"
  ON public.quote_imprints FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update quote imprints"
  ON public.quote_imprints FOR UPDATE TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete quote imprints"
  ON public.quote_imprints FOR DELETE TO public
  USING (public.has_role(auth.uid(), 'admin'));

-- Add imprint_id and size_costs to quote_line_items
ALTER TABLE public.quote_line_items 
  ADD COLUMN imprint_id UUID REFERENCES public.quote_imprints(id) ON DELETE SET NULL,
  ADD COLUMN size_costs JSONB DEFAULT '{}'::jsonb;
