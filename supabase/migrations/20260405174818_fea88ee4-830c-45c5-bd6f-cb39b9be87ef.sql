
-- Skills: discrete, named capabilities with a defined minimum acceptable standard
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  description TEXT,
  minimum_acceptable_standard TEXT,
  conditions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Skill records: one row per person per skill, updated in place as level advances
CREATE TABLE public.skill_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  skill_id UUID REFERENCES public.skills(id) ON DELETE CASCADE NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_id)
);

-- Check rides: the actual performance evaluation event
CREATE TABLE public.check_rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES public.skills(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  evaluator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  conducted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result TEXT NOT NULL,
  level_awarded INTEGER,
  conditions_notes TEXT,
  evaluator_notes TEXT NOT NULL DEFAULT '',
  recheck_required BOOLEAN NOT NULL DEFAULT false,
  recheck_by TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link training plans to the skill + level they prepare someone for
ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS skill_id UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prepares_for_level INTEGER DEFAULT 2;

-- RLS
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_rides ENABLE ROW LEVEL SECURITY;

-- Skills: everyone can read, admins can write
CREATE POLICY "skills_select" ON public.skills FOR SELECT USING (true);
CREATE POLICY "skills_insert" ON public.skills FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "skills_update" ON public.skills FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "skills_delete" ON public.skills FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Skill records: users see their own, admins see all
CREATE POLICY "skill_records_select_own" ON public.skill_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "skill_records_select_admin" ON public.skill_records FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "skill_records_insert" ON public.skill_records FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "skill_records_update" ON public.skill_records FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Check rides: candidates see their own, admins see all
CREATE POLICY "check_rides_select_own" ON public.check_rides FOR SELECT USING (auth.uid() = candidate_id);
CREATE POLICY "check_rides_select_admin" ON public.check_rides FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "check_rides_insert" ON public.check_rides FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "check_rides_update" ON public.check_rides FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Triggers
CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON public.skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_skill_records_updated_at BEFORE UPDATE ON public.skill_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
