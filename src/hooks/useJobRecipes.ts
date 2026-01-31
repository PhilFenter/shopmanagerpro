import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface JobRecipe {
  id: string;
  name: string;
  type: 'dtf' | 'screen_print' | 'embroidery' | 'leather';
  customer_name: string | null;
  created_at: string;
  updated_at: string;
}

export function useJobRecipes(jobId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['job-recipes', jobId],
    queryFn: async (): Promise<JobRecipe[]> => {
      if (!jobId) return [];

      const [dtf, screenPrint, embroidery, leather] = await Promise.all([
        supabase
          .from('dtf_recipes')
          .select('id, name, customer_name, created_at, updated_at')
          .eq('job_id', jobId),
        supabase
          .from('screen_print_recipes')
          .select('id, name, customer_name, created_at, updated_at')
          .eq('job_id', jobId),
        supabase
          .from('embroidery_recipes')
          .select('id, name, customer_name, created_at, updated_at')
          .eq('job_id', jobId),
        supabase
          .from('leather_recipes')
          .select('id, name, customer_name, created_at, updated_at')
          .eq('job_id', jobId),
      ]);

      const recipes: JobRecipe[] = [];

      if (dtf.data) {
        recipes.push(...dtf.data.map((r) => ({ ...r, type: 'dtf' as const })));
      }
      if (screenPrint.data) {
        recipes.push(...screenPrint.data.map((r) => ({ ...r, type: 'screen_print' as const })));
      }
      if (embroidery.data) {
        recipes.push(...embroidery.data.map((r) => ({ ...r, type: 'embroidery' as const })));
      }
      if (leather.data) {
        recipes.push(...leather.data.map((r) => ({ ...r, type: 'leather' as const })));
      }

      return recipes.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    },
    enabled: !!user && !!jobId,
  });
}
