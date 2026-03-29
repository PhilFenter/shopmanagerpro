import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import type { JobStage } from './useJobStages';

export type ServiceType = 'embroidery' | 'screen_print' | 'dtf' | 'leather_patch' | 'laser_engraving' | 'uv_patch' | 'heat_press_patch' | 'woven_patch' | 'pvc_patch' | 'mixed' | 'other';

// Map service types to checklist template departments for auto-attach
const SERVICE_DEPT_MAP: Record<string, string[]> = {
  embroidery: ['Embroidery'],
  screen_print: ['Screen Print'],
  dtf: ['DTF'],
  leather_patch: ['Leather'],
  laser_engraving: ['Leather'],
};
export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold';

// Helper to check if user has financial access
export const hasFinancialAccess = (role: string | null) => role === 'admin' || role === 'manager';

export interface Job {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  description: string | null;
  service_type: ServiceType;
  quantity: number;
  sale_price: number | null;
  material_cost: number | null;
  status: JobStatus;
  time_tracked: number; // stored in minutes now
  timer_started_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  source: string | null;
  external_id: string | null;
  stage: JobStage;
  stage_updated_at: string | null;
  paid_at: string | null;
  due_date: string | null;
}

export interface CreateJobInput {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  order_number?: string;
  invoice_number?: string;
  description?: string;
  service_type: ServiceType;
  quantity: number;
  sale_price?: number;
  material_cost?: number;
}

export function useJobs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const allJobs: Job[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .order('order_number', { ascending: false, nullsFirst: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allJobs.push(...(data as Job[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allJobs;
    },
    enabled: !!user,
  });

  // Real-time subscription for jobs
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('jobs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const createJob = useMutation({
    mutationFn: async (input: CreateJobInput) => {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ title: 'Job created' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to create job', description: error.message });
    },
  });

  const updateJob = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Job> & { id: string }) => {
      const { data, error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
      const previous = queryClient.getQueryData<Job[]>(['jobs']);
      queryClient.setQueryData<Job[]>(['jobs'], (old) =>
        old?.map((j) => (j.id === id ? { ...j, ...updates } : j))
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['jobs'], context.previous);
      toast({ variant: 'destructive', title: 'Failed to update job', description: error.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const completeJob = useMutation({
    mutationFn: async (job: Job) => {
      const { data, error } = await supabase
        .from('jobs')
        .update({ 
          status: 'completed' as JobStatus,
          completed_at: new Date().toISOString(),
          time_tracked: job.time_tracked,
        })
        .eq('id', job.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ title: 'Job completed!' });
    },
  });

  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ title: 'Job deleted' });
    },
  });

  return {
    jobs: jobsQuery.data ?? [],
    isLoading: jobsQuery.isLoading,
    error: jobsQuery.error,
    createJob,
    updateJob,
    completeJob,
    deleteJob,
  };
}
