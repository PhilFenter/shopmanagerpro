import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface NeedleSetup {
  position: number;
  thread_color: string;
  thread_number: string;
}

export interface EmbroideryRecipe {
  id: string;
  job_id: string | null;
  name: string;
  customer_name: string | null;
  needle_setup: NeedleSetup[];
  hoop_size: string | null;
  placement: string | null;
  stitch_count: number | null;
  design_file: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmbroideryRecipes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const recipesQuery = useQuery({
    queryKey: ['embroidery-recipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('embroidery_recipes')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data ?? []).map(row => ({
        ...row,
        needle_setup: (row.needle_setup as unknown as NeedleSetup[]) ?? [],
      })) as EmbroideryRecipe[];
    },
    enabled: !!user,
  });

  const createRecipe = useMutation({
    mutationFn: async (input: Partial<EmbroideryRecipe>) => {
      const { data, error } = await supabase
        .from('embroidery_recipes')
        .insert({
          name: input.name!,
          job_id: input.job_id,
          customer_name: input.customer_name,
          needle_setup: input.needle_setup as unknown as any,
          hoop_size: input.hoop_size,
          placement: input.placement,
          stitch_count: input.stitch_count,
          design_file: input.design_file,
          notes: input.notes,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embroidery-recipes'] });
      toast({ title: 'Recipe saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to save recipe', description: error.message });
    },
  });

  const updateRecipe = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmbroideryRecipe> & { id: string }) => {
      const updateData: any = { ...updates };
      if (updates.needle_setup) {
        updateData.needle_setup = updates.needle_setup as unknown as any;
      }
      
      const { data, error } = await supabase
        .from('embroidery_recipes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embroidery-recipes'] });
      toast({ title: 'Recipe updated' });
    },
  });

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('embroidery_recipes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embroidery-recipes'] });
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
