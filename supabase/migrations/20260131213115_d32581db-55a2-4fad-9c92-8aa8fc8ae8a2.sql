-- Add hourly_rate to profiles for wage tracking
ALTER TABLE public.profiles 
ADD COLUMN hourly_rate numeric DEFAULT 0;

-- Create job_line_items table for multi-service orders
CREATE TABLE public.job_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  service_type service_type NOT NULL DEFAULT 'other',
  description text,
  quantity integer NOT NULL DEFAULT 1,
  sale_price numeric DEFAULT 0,
  material_cost numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on job_line_items
ALTER TABLE public.job_line_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_line_items (same as jobs table)
CREATE POLICY "Authenticated users can view job line items"
ON public.job_line_items FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create job line items"
ON public.job_line_items FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update job line items"
ON public.job_line_items FOR UPDATE
USING (true);

CREATE POLICY "Admins can delete job line items"
ON public.job_line_items FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add worker_id to time_entries for tagging who did the work
ALTER TABLE public.time_entries 
ADD COLUMN worker_id uuid REFERENCES public.profiles(id);

-- Add optional line_item_id to time_entries to track time per line item
ALTER TABLE public.time_entries 
ADD COLUMN line_item_id uuid REFERENCES public.job_line_items(id) ON DELETE SET NULL;

-- Create trigger for updating job_line_items.updated_at
CREATE TRIGGER update_job_line_items_updated_at
BEFORE UPDATE ON public.job_line_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();