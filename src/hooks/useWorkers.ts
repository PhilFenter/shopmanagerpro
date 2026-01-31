import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface Worker {
  id: string;
  name: string;
  hourly_rate: number;
  is_salary: boolean;
  monthly_salary: number;
  weekly_hours: number;
  is_active: boolean;
  notes: string | null;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkerInput {
  name: string;
  hourly_rate?: number;
  is_salary?: boolean;
  monthly_salary?: number;
  weekly_hours?: number;
  notes?: string;
}

export function useWorkers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const workersQuery = useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Worker[];
    },
  });

  const createWorker = useMutation({
    mutationFn: async (input: CreateWorkerInput) => {
      const { data, error } = await supabase
        .from('workers')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      toast({ title: 'Worker added' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to add worker', description: error.message });
    },
  });

  const updateWorker = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Worker> & { id: string }) => {
      const { data, error } = await supabase
        .from('workers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update worker', description: error.message });
    },
  });

  const deleteWorker = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      toast({ title: 'Worker removed' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to remove worker', description: error.message });
    },
  });

  // Calculate totals for business metrics
  const activeWorkers = workersQuery.data?.filter(w => w.is_active) ?? [];
  
  const monthlyLaborCost = activeWorkers.reduce((sum, worker) => {
    if (worker.is_salary) {
      return sum + (worker.monthly_salary || 0);
    }
    return sum + (worker.hourly_rate || 0) * (worker.weekly_hours || 40) * 4.33;
  }, 0);

  const totalMonthlyHours = activeWorkers.reduce((sum, worker) => {
    return sum + (worker.weekly_hours || 40) * 4.33;
  }, 0);

  return {
    workers: workersQuery.data ?? [],
    activeWorkers,
    isLoading: workersQuery.isLoading,
    error: workersQuery.error,
    monthlyLaborCost,
    totalMonthlyHours,
    createWorker,
    updateWorker,
    deleteWorker,
  };
}
