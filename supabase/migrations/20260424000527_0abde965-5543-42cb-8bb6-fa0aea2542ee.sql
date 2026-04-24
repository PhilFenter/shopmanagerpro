-- Department handoffs for inter-department job communication
CREATE TYPE public.handoff_dept AS ENUM (
  'embroidery',
  'screen_print',
  'dtf',
  'leather',
  'patch',
  'art',
  'front_office',
  'production',
  'shipping'
);

CREATE TYPE public.handoff_status AS ENUM (
  'pending',
  'acknowledged',
  'completed'
);

CREATE TABLE public.job_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  from_dept public.handoff_dept NOT NULL,
  to_dept public.handoff_dept NOT NULL,
  message text NOT NULL,
  status public.handoff_status NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',
  created_by uuid NOT NULL,
  acknowledged_by uuid,
  acknowledged_at timestamp with time zone,
  completed_by uuid,
  completed_at timestamp with time zone,
  due_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_handoffs_to_dept_status ON public.job_handoffs(to_dept, status);
CREATE INDEX idx_job_handoffs_job_id ON public.job_handoffs(job_id);
CREATE INDEX idx_job_handoffs_created_at ON public.job_handoffs(created_at DESC);

ALTER TABLE public.job_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view handoffs"
  ON public.job_handoffs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create handoffs"
  ON public.job_handoffs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update handoffs"
  ON public.job_handoffs FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete handoffs"
  ON public.job_handoffs FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_job_handoffs_updated_at
  BEFORE UPDATE ON public.job_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comments for handoff threads
CREATE TABLE public.job_handoff_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id uuid NOT NULL REFERENCES public.job_handoffs(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_handoff_comments_handoff_id ON public.job_handoff_comments(handoff_id, created_at);

ALTER TABLE public.job_handoff_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view handoff comments"
  ON public.job_handoff_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create handoff comments"
  ON public.job_handoff_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can delete own handoff comments"
  ON public.job_handoff_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_handoffs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_handoff_comments;