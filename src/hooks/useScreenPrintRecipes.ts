import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface PlatenSetup {
  position: number;
  active: boolean;
  shirt_size?: string;
}

export interface InkColor {
  color: string;
  type: string;
  mesh: number;
}

export interface ScreenPrintRecipe {
  id: string;
  job_id: string | null;
  name: string;
  customer_name: string | null;
  print_type: 'single' | 'multi_rotation';
  platen_setup: PlatenSetup[];
  rotation_sequence: any[] | null;
  ink_colors: InkColor[] | null;
  squeegee_settings: string | null;
  flash_temp: number | null;
  flash_time: number | null;
  cure_temp: number | null;
  cure_time: number | null;
  quality_rating: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useScreenPrintRecipes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const recipesQuery = useQuery({
    queryKey: ['screen-print-recipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screen_print_recipes')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data ?? []).map(row => ({
        ...row,
        platen_setup: (row.platen_setup as unknown as PlatenSetup[]) ?? [],
        ink_colors: (row.ink_colors as unknown as InkColor[]) ?? null,
        rotation_sequence: row.rotation_sequence as unknown as any[] | null,
      })) as ScreenPrintRecipe[];
    },
    enabled: !!user,
  });

  const createRecipe = useMutation({
    mutationFn: async (input: Partial<ScreenPrintRecipe>) => {
      const { data, error } = await supabase
        .from('screen_print_recipes')
        .insert({
          name: input.name!,
          job_id: input.job_id,
          customer_name: input.customer_name,
          print_type: input.print_type ?? 'single',
          platen_setup: input.platen_setup as unknown as any,
          rotation_sequence: input.rotation_sequence as unknown as any,
          ink_colors: input.ink_colors as unknown as any,
          squeegee_settings: input.squeegee_settings,
          flash_temp: input.flash_temp,
          flash_time: input.flash_time,
          cure_temp: input.cure_temp,
          cure_time: input.cure_time,
          quality_rating: input.quality_rating,
          notes: input.notes,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screen-print-recipes'] });
      toast({ title: 'Recipe saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to save recipe', description: error.message });
    },
  });

  const updateRecipe = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScreenPrintRecipe> & { id: string }) => {
      const updateData: any = { ...updates };
      if (updates.platen_setup) updateData.platen_setup = updates.platen_setup as unknown as any;
      if (updates.ink_colors) updateData.ink_colors = updates.ink_colors as unknown as any;
      if (updates.rotation_sequence) updateData.rotation_sequence = updates.rotation_sequence as unknown as any;
      
      const { data, error } = await supabase
        .from('screen_print_recipes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screen-print-recipes'] });
      toast({ title: 'Recipe updated' });
    },
  });

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('screen_print_recipes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screen-print-recipes'] });
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
