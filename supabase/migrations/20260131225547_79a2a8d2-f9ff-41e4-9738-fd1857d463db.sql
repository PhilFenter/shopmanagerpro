-- Create overhead_items table for tracking monthly operating costs
CREATE TABLE public.overhead_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_cost NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.overhead_items ENABLE ROW LEVEL SECURITY;

-- Only admins can manage overhead items
CREATE POLICY "Admins can view overhead items"
  ON public.overhead_items FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create overhead items"
  ON public.overhead_items FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update overhead items"
  ON public.overhead_items FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete overhead items"
  ON public.overhead_items FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_overhead_items_updated_at
  BEFORE UPDATE ON public.overhead_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add salary/hourly fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN is_salary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN monthly_salary NUMERIC DEFAULT 0,
  ADD COLUMN weekly_hours NUMERIC NOT NULL DEFAULT 40;

-- Create business_settings table for payroll tax rate and other global settings
CREATE TABLE public.business_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage business settings
CREATE POLICY "Admins can view business settings"
  ON public.business_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create business settings"
  ON public.business_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update business settings"
  ON public.business_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete business settings"
  ON public.business_settings FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default payroll tax rate (16.5%)
INSERT INTO public.business_settings (key, value)
VALUES ('payroll_tax_rate', '{"rate": 0.165}'::jsonb);

-- Add trigger for updated_at
CREATE TRIGGER update_business_settings_updated_at
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();