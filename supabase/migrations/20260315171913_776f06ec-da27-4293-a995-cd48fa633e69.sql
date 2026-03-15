
-- Garment inventory table
CREATE TABLE public.garment_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  style_number TEXT NOT NULL,
  color TEXT,
  size TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  location TEXT,
  bin TEXT,
  brand TEXT,
  description TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.garment_inventory ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view inventory"
  ON public.garment_inventory FOR SELECT
  TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert inventory"
  ON public.garment_inventory FOR INSERT
  TO public
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update inventory"
  ON public.garment_inventory FOR UPDATE
  TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete inventory"
  ON public.garment_inventory FOR DELETE
  TO public
  USING (public.has_role(auth.uid(), 'admin'::app_role));
