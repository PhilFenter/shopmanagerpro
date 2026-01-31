import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { ServiceType } from './useJobs';

export interface JobLineItem {
  id: string;
  job_id: string;
  service_type: ServiceType;
  description: string | null;
  quantity: number;
  sale_price: number;
  material_cost: number;
  created_at: string;
  updated_at: string;
}

export interface CreateLineItemInput {
  job_id: string;
  service_type: ServiceType;
  description?: string;
  quantity: number;
  sale_price?: number;
  material_cost?: number;
}

export function useJobLineItems(jobId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const lineItemsQuery = useQuery({
    queryKey: ['job-line-items', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from('job_line_items')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as JobLineItem[];
    },
    enabled: !!jobId,
  });

  const createLineItem = useMutation({
    mutationFn: async (input: CreateLineItemInput) => {
      const { data, error } = await supabase
        .from('job_line_items')
        .insert({
          job_id: input.job_id,
          service_type: input.service_type,
          description: input.description,
          quantity: input.quantity,
          sale_price: input.sale_price ?? 0,
          material_cost: input.material_cost ?? 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['job-line-items', data.job_id] });
      toast({ title: 'Line item added' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to add line item', description: error.message });
    },
  });

  const updateLineItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<JobLineItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('job_line_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['job-line-items', data.job_id] });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update line item', description: error.message });
    },
  });

  const deleteLineItem = useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }) => {
      const { error } = await supabase
        .from('job_line_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, jobId };
    },
    onSuccess: ({ jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['job-line-items', jobId] });
      toast({ title: 'Line item removed' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to delete line item', description: error.message });
    },
  });

  return {
    lineItems: lineItemsQuery.data ?? [],
    isLoading: lineItemsQuery.isLoading,
    error: lineItemsQuery.error,
    createLineItem,
    updateLineItem,
    deleteLineItem,
  };
}
