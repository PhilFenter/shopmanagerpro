-- Embroidery Recipes (Barudan 15-Needle)
CREATE TABLE public.embroidery_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  name text NOT NULL,
  customer_name text,
  
  -- Needle setup (15 needles)
  needle_setup jsonb NOT NULL DEFAULT '[]', -- [{position: 1, thread_color: "Madeira 1000", thread_number: "1000"}]
  
  -- Settings
  hoop_size text, -- "4x4", "5x7", "6x10", etc
  placement text, -- "Left Chest", "Back", "Cap", etc
  stitch_count integer,
  design_file text,
  
  -- Notes
  notes text,
  
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Screen Print Recipes (ROQ P14XL)
CREATE TABLE public.screen_print_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  name text NOT NULL,
  customer_name text,
  
  -- Print type
  print_type text NOT NULL DEFAULT 'single', -- 'single' or 'multi_rotation'
  
  -- Platen mapping (12 positions)
  platen_setup jsonb NOT NULL DEFAULT '[]', -- [{position: 1, active: true, shirt_size: "L"}]
  
  -- Multi-rotation sequence
  rotation_sequence jsonb, -- [{step: 1, action: "print", screen: 1}, ...]
  
  -- Ink/Mesh/Squeegee
  ink_colors jsonb, -- [{color: "White", type: "Plastisol", mesh: 110}]
  squeegee_settings text,
  
  -- Flash/Cure
  flash_temp integer,
  flash_time integer,
  cure_temp integer,
  cure_time integer,
  
  -- Quality
  quality_rating integer, -- 1-5
  notes text,
  
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- DTF Recipes
CREATE TABLE public.dtf_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  name text NOT NULL,
  customer_name text,
  
  -- Fabric settings
  fabric_type text NOT NULL, -- 'cotton', 'polyester', 'blend', 'specialty'
  
  -- Heat press settings
  press_temp integer, -- Fahrenheit
  press_time integer, -- Seconds
  press_pressure text, -- 'light', 'medium', 'heavy'
  
  -- Peel
  peel_type text, -- 'hot', 'warm', 'cold'
  
  notes text,
  
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Leather Patch Recipes (Trotec Laser)
CREATE TABLE public.leather_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  name text NOT NULL,
  customer_name text,
  
  -- Material
  material_type text NOT NULL, -- 'chestnut', 'black', 'leatherette', etc
  
  -- Laser settings
  laser_power integer, -- Percentage 0-100
  laser_speed integer, -- Percentage 0-100  
  laser_frequency integer, -- Hz
  passes integer DEFAULT 1,
  
  -- Dimensions
  patch_width numeric,
  patch_height numeric,
  
  -- Cost tracking
  material_cost_per_piece numeric,
  
  notes text,
  
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all recipe tables
ALTER TABLE public.embroidery_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_print_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dtf_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leather_recipes ENABLE ROW LEVEL SECURITY;

-- RLS policies for embroidery_recipes
CREATE POLICY "Authenticated users can view embroidery recipes"
ON public.embroidery_recipes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create embroidery recipes"
ON public.embroidery_recipes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update embroidery recipes"
ON public.embroidery_recipes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete embroidery recipes"
ON public.embroidery_recipes FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for screen_print_recipes
CREATE POLICY "Authenticated users can view screen print recipes"
ON public.screen_print_recipes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create screen print recipes"
ON public.screen_print_recipes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update screen print recipes"
ON public.screen_print_recipes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete screen print recipes"
ON public.screen_print_recipes FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for dtf_recipes
CREATE POLICY "Authenticated users can view dtf recipes"
ON public.dtf_recipes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create dtf recipes"
ON public.dtf_recipes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update dtf recipes"
ON public.dtf_recipes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete dtf recipes"
ON public.dtf_recipes FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for leather_recipes
CREATE POLICY "Authenticated users can view leather recipes"
ON public.leather_recipes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create leather recipes"
ON public.leather_recipes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update leather recipes"
ON public.leather_recipes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete leather recipes"
ON public.leather_recipes FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_embroidery_recipes_updated_at BEFORE UPDATE ON public.embroidery_recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_screen_print_recipes_updated_at BEFORE UPDATE ON public.screen_print_recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dtf_recipes_updated_at BEFORE UPDATE ON public.dtf_recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leather_recipes_updated_at BEFORE UPDATE ON public.leather_recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();