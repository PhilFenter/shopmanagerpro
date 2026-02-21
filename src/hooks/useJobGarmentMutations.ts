import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface CreateGarmentInput {
  job_id: string;
  style?: string;
  item_number?: string;
  color?: string;
  description?: string;
  sizes?: Record<string, number>;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  vendor?: string;
  decoration_type?: string;
  placement?: string;
  image_url?: string;
  markup_pct?: number;
  decoration_cost?: number;
  unit_sell_price?: number;
}

export function useJobGarmentMutations(jobId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createGarment = useMutation({
    mutationFn: async (input: CreateGarmentInput) => {
      const { data, error } = await supabase
        .from('job_garments')
        .insert({
          job_id: input.job_id,
          style: input.style,
          item_number: input.item_number,
          color: input.color,
          description: input.description,
          sizes: input.sizes || {},
          quantity: input.quantity,
          unit_cost: input.unit_cost || 0,
          total_cost: input.total_cost || 0,
          vendor: input.vendor,
          decoration_type: input.decoration_type,
          placement: input.placement,
          image_url: input.image_url,
          markup_pct: input.markup_pct,
          decoration_cost: input.decoration_cost || 0,
          unit_sell_price: input.unit_sell_price,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['job-garments', (data as any).job_id] });
      toast({ title: 'Garment added to job' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to add garment', description: error.message });
    },
  });

  const updateGarment = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CreateGarmentInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('job_garments')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (jobId) queryClient.invalidateQueries({ queryKey: ['job-garments', jobId] });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update garment', description: error.message });
    },
  });

  const deleteGarment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('job_garments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (jobId) queryClient.invalidateQueries({ queryKey: ['job-garments', jobId] });
      toast({ title: 'Garment removed' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to remove garment', description: error.message });
    },
  });

  return { createGarment, updateGarment, deleteGarment };
}
