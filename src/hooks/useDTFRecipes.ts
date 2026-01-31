import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface DTFRecipe {
  id: string;
  job_id: string | null;
  name: string;
  customer_name: string | null;
  fabric_type: string;
  press_temp: number | null;
  press_time: number | null;
  press_pressure: string | null;
  peel_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const FABRIC_TYPES = [
  { value: 'cotton', label: 'Cotton', defaults: { temp: 320, time: 15, pressure: 'medium', peel: 'warm' } },
  { value: 'polyester', label: 'Polyester', defaults: { temp: 285, time: 10, pressure: 'light', peel: 'cold' } },
  { value: 'poly_blend', label: 'Poly/Cotton Blend', defaults: { temp: 300, time: 12, pressure: 'medium', peel: 'warm' } },
  { value: 'tri_blend', label: 'Tri-Blend', defaults: { temp: 295, time: 12, pressure: 'medium', peel: 'warm' } },
  { value: 'nylon', label: 'Nylon', defaults: { temp: 275, time: 8, pressure: 'light', peel: 'cold' } },
  { value: 'specialty', label: 'Specialty/Other', defaults: { temp: 300, time: 12, pressure: 'medium', peel: 'warm' } },
];

export const PRESSURE_OPTIONS = ['light', 'medium', 'heavy'];
export const PEEL_OPTIONS = ['hot', 'warm', 'cold'];

export function useDTFRecipes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const recipesQuery = useQuery({
    queryKey: ['dtf-recipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dtf_recipes')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as DTFRecipe[];
    },
    enabled: !!user,
  });

  const createRecipe = useMutation({
    mutationFn: async (input: Partial<DTFRecipe>) => {
      const { data, error } = await supabase
        .from('dtf_recipes')
        .insert({
          name: input.name!,
          fabric_type: input.fabric_type!,
          job_id: input.job_id,
          customer_name: input.customer_name,
          press_temp: input.press_temp,
          press_time: input.press_time,
          press_pressure: input.press_pressure,
          peel_type: input.peel_type,
          notes: input.notes,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dtf-recipes'] });
      toast({ title: 'Recipe saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to save recipe', description: error.message });
    },
  });

  const updateRecipe = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DTFRecipe> & { id: string }) => {
      const { data, error } = await supabase
        .from('dtf_recipes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dtf-recipes'] });
      toast({ title: 'Recipe updated' });
    },
  });

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dtf_recipes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dtf-recipes'] });
      toast({ title: 'Recipe deleted' });
    },
  });

  return {
    recipes: recipesQuery.data ?? [],
    isLoading: recipesQuery.isLoading,
    createRecipe,
    updateRecipe,
    deleteRecipe,
  };
}
