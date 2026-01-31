import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type ServiceType = 'embroidery' | 'screen_print' | 'dtf' | 'leather_patch' | 'other';
export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold';

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
  time_tracked: number;
  timer_started_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  source: string | null;
  external_id: string | null;
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
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Job[];
    },
    enabled: !!user,
  });

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
      toast({ title: 'Job created successfully' });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update job', description: error.message });
    },
  });

  const startTimer = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase
        .from('jobs')
        .update({ 
          timer_started_at: new Date().toISOString(),
          status: 'in_progress' as JobStatus,
        })
        .eq('id', jobId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Create time entry
      await supabase.from('time_entries').insert({
        job_id: jobId,
        user_id: user?.id,
        started_at: new Date().toISOString(),
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const stopTimer = useMutation({
    mutationFn: async (job: Job) => {
      if (!job.timer_started_at) return job;
      
      const startTime = new Date(job.timer_started_at).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const newTimeTracked = job.time_tracked + elapsed;
      
      const { data, error } = await supabase
        .from('jobs')
        .update({ 
          timer_started_at: null,
          time_tracked: newTimeTracked,
        })
        .eq('id', job.id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update time entry
      const { data: entries } = await supabase
        .from('time_entries')
        .select('*')
        .eq('job_id', job.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1);
      
      if (entries && entries.length > 0) {
        await supabase
          .from('time_entries')
          .update({ 
            ended_at: new Date().toISOString(),
            duration: elapsed,
          })
          .eq('id', entries[0].id);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const completeJob = useMutation({
    mutationFn: async (job: Job) => {
      // Stop timer if running
      if (job.timer_started_at) {
        await stopTimer.mutateAsync(job);
      }
      
      const { data, error } = await supabase
        .from('jobs')
        .update({ 
          status: 'completed' as JobStatus,
          completed_at: new Date().toISOString(),
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

  return {
    jobs: jobsQuery.data ?? [],
    isLoading: jobsQuery.isLoading,
    error: jobsQuery.error,
    createJob,
    updateJob,
    startTimer,
    stopTimer,
    completeJob,
  };
}
