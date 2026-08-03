import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Shift {
  id: string;
  worker_id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NewShift {
  worker_id: string;
  starts_at: string;
  ends_at: string;
  note?: string | null;
}

/** Turns the database's constraint names into something a person can act on. */
function describeShiftError(message: string): string {
  if (message.includes('shifts_no_overlap')) {
    return 'That overlaps a shift this person already has.';
  }
  if (message.includes('shifts_end_after_start')) {
    return 'The end time has to be after the start time.';
  }
  if (message.includes('row-level security')) {
    return 'You can only change your own shifts.';
  }
  return message;
}

/**
 * Shifts within a date window.
 *
 * The window is applied server-side — the schedule only ever shows two weeks,
 * so there is no reason to pull the whole table and filter in the browser (the
 * mistake that made the Customers page miss records past the 1000-row cap).
 */
export function useShifts(rangeStart: Date, rangeEnd: Date) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startISO = rangeStart.toISOString();
  const endISO = rangeEnd.toISOString();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shifts', startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('starts_at', startISO)
        .lt('starts_at', endISO)
        .order('starts_at');
      if (error) throw error;
      return (data ?? []) as Shift[];
    },
    enabled: !!user,
  });

  // A schedule is shared, so a coworker adding a shift should appear without a
  // refresh. Invalidates every window, since an edit may land outside this one.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('shifts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['shifts'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const createShift = useMutation({
    mutationFn: async (shift: NewShift) => {
      const { data, error } = await supabase
        .from('shifts')
        .insert({ ...shift, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Could not add shift',
        description: describeShiftError(error.message),
      });
    },
  });

  const updateShift = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Shift> & { id: string }) => {
      const { data, error } = await supabase
        .from('shifts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast({ title: 'Shift updated' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Could not update shift',
        description: describeShiftError(error.message),
      });
    },
  });

  const deleteShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast({ title: 'Shift removed' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Could not remove shift',
        description: describeShiftError(error.message),
      });
    },
  });

  return {
    shifts: data ?? [],
    isLoading,
    error,
    createShift,
    updateShift,
    deleteShift,
  };
}
