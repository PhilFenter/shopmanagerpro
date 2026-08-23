import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RecipeTemplate {
  id: string;
  name: string;
  service_type: string;
  description: string | null;
  ink_color: string | null;
  garment_color: string | null;
  min_qty: number | null;
  max_qty: number | null;
  screens: number | null;
  strokes: number | null;
  rotations: number;
  use_flash: boolean;
  use_stampinator: boolean;
  low_cure: boolean;
  dryer_temp_1: number | null;
  dryer_temp_2: number | null;
  belt_speed: number | null;
  platen_setup: any[];
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RecipeTemplateInput = Partial<Omit<RecipeTemplate, 'id' | 'created_at' | 'updated_at'>> & {
  name: string;
};

export function useRecipeTemplates(serviceType?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['recipe_templates', serviceType ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('recipe_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (serviceType) q = q.eq('service_type', serviceType);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as RecipeTemplate[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['recipe_templates'] });

  const create = useMutation({
    mutationFn: async (input: RecipeTemplateInput) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('recipe_templates')
        .insert({ ...input, created_by: u.user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Saved to recipe library');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save template'),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<RecipeTemplateInput>) => {
      const { error } = await supabase.from('recipe_templates').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Template updated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update template'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipe_templates').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Template removed');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to remove template'),
  });

  return {
    templates: query.data || [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
  };
}
