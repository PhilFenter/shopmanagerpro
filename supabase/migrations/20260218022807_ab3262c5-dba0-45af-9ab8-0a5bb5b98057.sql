
-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'manual', -- manual, printavo, shopify, import
  first_order_date TIMESTAMPTZ,
  last_order_date TIMESTAMPTZ,
  total_revenue NUMERIC DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can CRUD customers (team-wide per memory/security/customer-data-visibility)
CREATE POLICY "Authenticated users can view customers"
  ON public.customers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create customers"
  ON public.customers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update customers"
  ON public.customers FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete customers"
  ON public.customers FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_customers_total_revenue ON public.customers(total_revenue DESC);

-- Add customer_id to jobs
ALTER TABLE public.jobs ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
CREATE INDEX idx_jobs_customer_id ON public.jobs(customer_id);

-- Add customer_id to quotes
ALTER TABLE public.quotes ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
CREATE INDEX idx_quotes_customer_id ON public.quotes(customer_id);

-- Add customer_id to action_items
ALTER TABLE public.action_items ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
CREATE INDEX idx_action_items_customer_id ON public.action_items(customer_id);

-- Deduplicate: create customer records from existing jobs and quotes
-- Match by email first (most reliable), then by name for those without email
INSERT INTO public.customers (name, email, phone, source, first_order_date, last_order_date, total_revenue, total_orders)
SELECT 
  COALESCE(MIN(j.customer_name), 'Unknown') as name,
  j.customer_email as email,
  MIN(j.customer_phone) as phone,
  'system' as source,
  MIN(j.created_at) as first_order_date,
  MAX(j.created_at) as last_order_date,
  COALESCE(SUM(j.sale_price), 0) as total_revenue,
  COUNT(*) as total_orders
FROM public.jobs j
WHERE j.customer_email IS NOT NULL AND j.customer_email != ''
GROUP BY j.customer_email;

-- For jobs without email, group by customer_name
INSERT INTO public.customers (name, phone, source, first_order_date, last_order_date, total_revenue, total_orders)
SELECT 
  j.customer_name as name,
  MIN(j.customer_phone) as phone,
  'system' as source,
  MIN(j.created_at) as first_order_date,
  MAX(j.created_at) as last_order_date,
  COALESCE(SUM(j.sale_price), 0) as total_revenue,
  COUNT(*) as total_orders
FROM public.jobs j
WHERE (j.customer_email IS NULL OR j.customer_email = '')
  AND j.customer_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.customers c WHERE c.name = j.customer_name
  )
GROUP BY j.customer_name;

-- Link jobs back to customers by email match
UPDATE public.jobs j
SET customer_id = c.id
FROM public.customers c
WHERE j.customer_email IS NOT NULL 
  AND j.customer_email != ''
  AND j.customer_email = c.email;

-- Link remaining jobs by name match
UPDATE public.jobs j
SET customer_id = c.id
FROM public.customers c
WHERE j.customer_id IS NULL
  AND j.customer_name = c.name;

-- Link quotes to customers by email
UPDATE public.quotes q
SET customer_id = c.id
FROM public.customers c
WHERE q.customer_email IS NOT NULL
  AND q.customer_email != ''
  AND q.customer_email = c.email;

-- Link remaining quotes by name
UPDATE public.quotes q
SET customer_id = c.id
FROM public.customers c
WHERE q.customer_id IS NULL
  AND q.customer_name = c.name;
