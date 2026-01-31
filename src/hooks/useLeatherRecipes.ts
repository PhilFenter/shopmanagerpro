import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface LeatherRecipe {
  id: string;
  job_id: string | null;
  name: string;
  customer_name: string | null;
  material_type: string;
  laser_power: number | null;
  laser_speed: number | null;
  laser_frequency: number | null;
  passes: number;
  patch_width: number | null;
  patch_height: number | null;
  material_cost_per_piece: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const LEATHER_MATERIALS = [
  { value: 'chestnut_natural', label: 'Chestnut Natural' },
  { value: 'chestnut_dark', label: 'Chestnut Dark' },
  { value: 'black', label: 'Black Leather' },
  { value: 'brown', label: 'Brown Leather' },
  { value: 'tan', label: 'Tan Leather' },
  { value: 'leatherette_black', label: 'Leatherette Black' },
  { value: 'leatherette_brown', label: 'Leatherette Brown' },
];

export function useLeatherRecipes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const recipesQuery = useQuery({
    queryKey: ['leather-recipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leather_recipes')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as LeatherRecipe[];
    },
    enabled: !!user,
  });

  const createRecipe = useMutation({
    mutationFn: async (input: Partial<LeatherRecipe>) => {
      const { data, error } = await supabase
        .from('leather_recipes')
        .insert({
          name: input.name!,
          material_type: input.material_type!,
          job_id: input.job_id,
          customer_name: input.customer_name,
          laser_power: input.laser_power,
          laser_speed: input.laser_speed,
          laser_frequency: input.laser_frequency,
          passes: input.passes ?? 1,
          patch_width: input.patch_width,
          patch_height: input.patch_height,
          material_cost_per_piece: input.material_cost_per_piece,
          notes: input.notes,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leather-recipes'] });
      toast({ title: 'Recipe saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to save recipe', description: error.message });
    },
  });

  const updateRecipe = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeatherRecipe> & { id: string }) => {
      const { data, error } = await supabase
        .from('leather_recipes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leather-recipes'] });
      toast({ title: 'Recipe updated' });
    },
  });

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leather_recipes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leather-recipes'] });
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
