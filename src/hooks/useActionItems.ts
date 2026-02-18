import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ActionItem {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  job_id: string | null;
  quote_id: string | null;
  source: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'completed' | 'cancelled';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

type ActionItemInsert = {
  title: string;
  description?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  job_id?: string;
  quote_id?: string;
  source?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
};

export function useActionItems() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['action-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_items')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as ActionItem[];
    },
    enabled: !!user,
  });

  const openItems = items.filter(i => i.status === 'open');
  const completedItems = items.filter(i => i.status === 'completed');

  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const overdueItems = openItems.filter(i => i.due_date && new Date(i.due_date) < now);
  const dueTodayItems = openItems.filter(i => {
    if (!i.due_date) return false;
    const d = new Date(i.due_date);
    return d >= now && d <= todayEnd;
  });
  const upcomingItems = openItems.filter(i => {
    if (!i.due_date) return false;
    return new Date(i.due_date) > todayEnd;
  });
  const noDueDateItems = openItems.filter(i => !i.due_date);

  const createItem = useMutation({
    mutationFn: async (item: ActionItemInsert) => {
      const { data, error } = await supabase
        .from('action_items')
        .insert({ ...item, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['action-items'] }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ActionItem> & { id: string }) => {
      const { error } = await supabase
        .from('action_items')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['action-items'] }),
  });

  const completeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('action_items')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['action-items'] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('action_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['action-items'] }),
  });

  return {
    items,
    openItems,
    completedItems,
    overdueItems,
    dueTodayItems,
    upcomingItems,
    noDueDateItems,
    isLoading,
    createItem,
    updateItem,
    completeItem,
    deleteItem,
  };
}
