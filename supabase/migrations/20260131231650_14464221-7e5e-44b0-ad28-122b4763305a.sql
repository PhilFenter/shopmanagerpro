-- Create workers table for tracking labor costs (independent of user accounts)
CREATE TABLE public.workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  hourly_rate NUMERIC DEFAULT 0,
  is_salary BOOLEAN NOT NULL DEFAULT false,
  monthly_salary NUMERIC DEFAULT 0,
  weekly_hours NUMERIC NOT NULL DEFAULT 40,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  -- Optional link to user profile if they have an account
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view workers (for time entry assignment)
CREATE POLICY "Authenticated users can view workers"
  ON public.workers FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can manage workers
CREATE POLICY "Admins can create workers"
  ON public.workers FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update workers"
  ON public.workers FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete workers"
  ON public.workers FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();