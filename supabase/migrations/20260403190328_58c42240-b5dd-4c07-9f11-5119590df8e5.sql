
-- Purchase Orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT,
  supplier TEXT NOT NULL DEFAULT 'sanmar',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  submitted_at TIMESTAMPTZ,
  total_items INTEGER DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PO Line Items table
CREATE TABLE public.po_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  style_number TEXT NOT NULL,
  color TEXT,
  size TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  brand TEXT,
  description TEXT,
  source TEXT,
  source_order_id TEXT,
  source_order_name TEXT,
  job_id UUID REFERENCES public.jobs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users with financial access can manage POs
CREATE POLICY "Financial users can view POs"
  ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can create POs"
  ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can update POs"
  ON public.purchase_orders FOR UPDATE TO authenticated
  USING (public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can delete POs"
  ON public.purchase_orders FOR DELETE TO authenticated
  USING (public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can view PO items"
  ON public.po_line_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND public.has_financial_access(auth.uid())));

CREATE POLICY "Financial users can manage PO items"
  ON public.po_line_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND public.has_financial_access(auth.uid())));

CREATE POLICY "Financial users can update PO items"
  ON public.po_line_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND public.has_financial_access(auth.uid())));

CREATE POLICY "Financial users can delete PO items"
  ON public.po_line_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND public.has_financial_access(auth.uid())));

-- Updated_at triggers
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_po_line_items_updated_at BEFORE UPDATE ON public.po_line_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
