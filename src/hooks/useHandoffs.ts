import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import type { HandoffDept, HandoffStatus } from '@/lib/handoff-constants';

export interface JobHandoff {
  id: string;
  job_id: string;
  from_dept: HandoffDept;
  to_dept: HandoffDept;
  message: string;
  status: HandoffStatus;
  priority: string;
  created_by: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface HandoffComment {
  id: string;
  handoff_id: string;
  body: string;
  created_by: string;
  created_at: string;
}

export function useHandoffs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['handoffs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_handoffs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as JobHandoff[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('handoffs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_handoffs' }, () => {
        qc.invalidateQueries({ queryKey: ['handoffs'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const createHandoff = useMutation({
    mutationFn: async (input: {
      job_id: string;
      from_dept: HandoffDept;
      to_dept: HandoffDept;
      message: string;
      priority?: string;
      due_date?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('job_handoffs')
        .insert({
          ...input,
          priority: input.priority ?? 'normal',
          created_by: user?.id!,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handoffs'] });
      toast({ title: 'Handoff sent' });
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: HandoffStatus }) => {
      const updates: any = { status };
      if (status === 'acknowledged') {
        updates.acknowledged_by = user?.id;
        updates.acknowledged_at = new Date().toISOString();
      } else if (status === 'completed') {
        updates.completed_by = user?.id;
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('job_handoffs').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handoffs'] }),
    onError: (e) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  const deleteHandoff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('job_handoffs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handoffs'] });
      toast({ title: 'Handoff deleted' });
    },
  });

  return {
    handoffs: query.data ?? [],
    isLoading: query.isLoading,
    createHandoff,
    updateStatus,
    deleteHandoff,
  };
}

export function useHandoffComments(handoffId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['handoff-comments', handoffId],
    queryFn: async () => {
      if (!handoffId) return [];
      const { data, error } = await supabase
        .from('job_handoff_comments')
        .select('*')
        .eq('handoff_id', handoffId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as HandoffComment[];
    },
    enabled: !!handoffId && !!user,
  });

  useEffect(() => {
    if (!handoffId) return;
    const channel = supabase
      .channel(`handoff-comments-${handoffId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_handoff_comments', filter: `handoff_id=eq.${handoffId}` },
        () => qc.invalidateQueries({ queryKey: ['handoff-comments', handoffId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [handoffId, qc]);

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      if (!handoffId) throw new Error('No handoff');
      const { error } = await supabase
        .from('job_handoff_comments')
        .insert({ handoff_id: handoffId, body, created_by: user?.id! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handoff-comments', handoffId] }),
    onError: (e) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  return { comments: query.data ?? [], isLoading: query.isLoading, addComment };
}
