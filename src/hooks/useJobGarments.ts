import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface JobGarment {
  id: string;
  job_id: string;
  style: string | null;
  item_number: string | null;
  color: string | null;
  description: string | null;
  sizes: Record<string, number>;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  printavo_line_item_id: string | null;
  image_url: string | null;
  vendor: string | null;
  decoration_type: string | null;
  placement: string | null;
  markup_pct: number | null;
  decoration_cost: number | null;
  unit_sell_price: number | null;
  created_at: string;
}

export function useJobGarments(jobId: string | undefined) {
  const { data: garments = [], isLoading } = useQuery({
    queryKey: ['job-garments', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('job_garments')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as JobGarment[];
    },
    enabled: !!jobId,
  });

  return { garments, isLoading };
}
