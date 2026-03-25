
-- SOPs: Standard Operating Procedures
CREATE TABLE public.sops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  department text,
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  cover_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SOP Steps: ordered steps within an SOP
CREATE TABLE public.sop_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  content text,
  image_url text,
  video_url text,
  tip text,
  warning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Checklist Templates: reusable checklists
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  department text,
  sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Checklist Instances: assigned/active checklists
CREATE TABLE public.checklist_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  assigned_to uuid,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  title text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'in_progress',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Training Plans: onboarding/role-based training
CREATE TABLE public.training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  role text,
  department text,
  sop_ids uuid[] DEFAULT '{}',
  checklist_template_ids uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Training Assignments: track who is assigned and completion
CREATE TABLE public.training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_plan_id uuid NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL,
  assigned_by uuid NOT NULL,
  completed_sop_ids uuid[] DEFAULT '{}',
  completed_checklist_ids uuid[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'assigned',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;

-- SOPs policies
CREATE POLICY "Authenticated users can view sops" ON public.sops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create sops" ON public.sops FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update sops" ON public.sops FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete sops" ON public.sops FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- SOP Steps policies
CREATE POLICY "Authenticated users can view sop steps" ON public.sop_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create sop steps" ON public.sop_steps FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update sop steps" ON public.sop_steps FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete sop steps" ON public.sop_steps FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Checklist Templates policies
CREATE POLICY "Authenticated users can view checklist templates" ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create checklist templates" ON public.checklist_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update checklist templates" ON public.checklist_templates FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete checklist templates" ON public.checklist_templates FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Checklist Instances policies
CREATE POLICY "Authenticated users can view checklist instances" ON public.checklist_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create checklist instances" ON public.checklist_instances FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update checklist instances" ON public.checklist_instances FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete checklist instances" ON public.checklist_instances FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Training Plans policies
CREATE POLICY "Authenticated users can view training plans" ON public.training_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create training plans" ON public.training_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update training plans" ON public.training_plans FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete training plans" ON public.training_plans FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Training Assignments policies
CREATE POLICY "Authenticated users can view training assignments" ON public.training_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create training assignments" ON public.training_assignments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update training assignments" ON public.training_assignments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete training assignments" ON public.training_assignments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at triggers
CREATE TRIGGER set_sops_updated_at BEFORE UPDATE ON public.sops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_sop_steps_updated_at BEFORE UPDATE ON public.sop_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_checklist_templates_updated_at BEFORE UPDATE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_checklist_instances_updated_at BEFORE UPDATE ON public.checklist_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_training_plans_updated_at BEFORE UPDATE ON public.training_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_training_assignments_updated_at BEFORE UPDATE ON public.training_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
