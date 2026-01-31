-- Create service type enum
CREATE TYPE public.service_type AS ENUM ('embroidery', 'screen_print', 'dtf', 'leather_patch', 'other');

-- Create job status enum
CREATE TYPE public.job_status AS ENUM ('pending', 'in_progress', 'completed', 'on_hold');

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Order/Invoice reference
  order_number TEXT,
  invoice_number TEXT,
  
  -- Customer info (pulled from Shopify/Printavo or entered manually)
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Job details
  description TEXT,
  service_type service_type NOT NULL DEFAULT 'other',
  quantity INTEGER NOT NULL DEFAULT 1,
  sale_price DECIMAL(10, 2),
  material_cost DECIMAL(10, 2) DEFAULT 0,
  
  -- Status and tracking
  status job_status NOT NULL DEFAULT 'pending',
  
  -- Time tracking (stored in seconds)
  time_tracked INTEGER NOT NULL DEFAULT 0,
  timer_started_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Source tracking
  source TEXT DEFAULT 'manual', -- 'manual', 'printavo', 'shopify'
  external_id TEXT -- ID from Printavo or Shopify
);

-- Create time entries table for detailed time tracking
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- in seconds, calculated on end
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Jobs policies - all authenticated users can CRUD
CREATE POLICY "Authenticated users can view all jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete jobs"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Time entries policies
CREATE POLICY "Authenticated users can view all time entries"
  ON public.time_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create time entries"
  ON public.time_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time entries"
  ON public.time_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete time entries"
  ON public.time_entries FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for jobs updated_at
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;