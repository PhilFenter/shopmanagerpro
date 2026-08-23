ALTER TABLE public.screen_print_recipes ADD COLUMN IF NOT EXISTS print_id uuid REFERENCES public.job_prints(id) ON DELETE SET NULL;
ALTER TABLE public.dtf_recipes ADD COLUMN IF NOT EXISTS print_id uuid REFERENCES public.job_prints(id) ON DELETE SET NULL;
ALTER TABLE public.embroidery_recipes ADD COLUMN IF NOT EXISTS print_id uuid REFERENCES public.job_prints(id) ON DELETE SET NULL;
ALTER TABLE public.leather_recipes ADD COLUMN IF NOT EXISTS print_id uuid REFERENCES public.job_prints(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_spr_print_id ON public.screen_print_recipes(print_id);
CREATE INDEX IF NOT EXISTS idx_dtf_print_id ON public.dtf_recipes(print_id);
CREATE INDEX IF NOT EXISTS idx_emb_print_id ON public.embroidery_recipes(print_id);
CREATE INDEX IF NOT EXISTS idx_lea_print_id ON public.leather_recipes(print_id);

CREATE TABLE IF NOT EXISTS public.recipe_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_type text NOT NULL DEFAULT 'screen_print',
  description text,
  ink_color text,
  garment_color text,
  min_qty integer,
  max_qty integer,
  screens integer,
  strokes integer,
  rotations integer NOT NULL DEFAULT 1,
  use_flash boolean NOT NULL DEFAULT false,
  use_stampinator boolean NOT NULL DEFAULT false,
  low_cure boolean NOT NULL DEFAULT false,
  dryer_temp_1 integer,
  dryer_temp_2 integer,
  belt_speed integer,
  platen_setup jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_templates TO authenticated;
GRANT ALL ON public.recipe_templates TO service_role;

ALTER TABLE public.recipe_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view recipe templates"
  ON public.recipe_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can create recipe templates"
  ON public.recipe_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Managers can update recipe templates"
  ON public.recipe_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Managers can delete recipe templates"
  ON public.recipe_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER update_recipe_templates_updated_at
  BEFORE UPDATE ON public.recipe_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();