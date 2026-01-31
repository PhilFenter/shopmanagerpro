import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface TimeEntry {
  id: string;
  job_id: string;
  user_id: string | null;
  worker_id: string | null;
  line_item_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration: number | null; // in minutes
  notes: string | null;
  created_at: string;
  // Joined data
  worker?: {
    id: string;
    full_name: string | null;
    hourly_rate: number;
  };
}

export interface CreateTimeEntryInput {
  job_id: string;
  worker_id: string;
  duration: number; // in minutes
  notes?: string;
  line_item_id?: string;
}

export function useTimeEntries(jobId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const timeEntriesQuery = useQuery({
    queryKey: ['time-entries', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          worker:profiles!time_entries_worker_id_fkey(id, full_name, hourly_rate)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!jobId,
  });

  const createTimeEntry = useMutation({
    mutationFn: async (input: CreateTimeEntryInput) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          job_id: input.job_id,
          user_id: user?.id,
          worker_id: input.worker_id,
          line_item_id: input.line_item_id,
          started_at: now,
          ended_at: now,
          duration: input.duration,
          notes: input.notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ title: 'Time logged' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to log time', description: error.message });
    },
  });

  const deleteTimeEntry = useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }) => {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, jobId };
    },
    onSuccess: ({ jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ title: 'Time entry removed' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to delete time entry', description: error.message });
    },
  });

  // Calculate total time for the job
  const totalMinutes = timeEntriesQuery.data?.reduce((sum, entry) => sum + (entry.duration || 0), 0) ?? 0;

  return {
    timeEntries: timeEntriesQuery.data ?? [],
    totalMinutes,
    isLoading: timeEntriesQuery.isLoading,
    error: timeEntriesQuery.error,
    createTimeEntry,
    deleteTimeEntry,
  };
}
