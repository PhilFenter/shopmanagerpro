import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { hasFinancialAccess } from './useJobs';

export interface OverheadItem {
  id: string;
  name: string;
  monthly_cost: number;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useOverheadItems() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['overhead-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('overhead_items')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as OverheadItem[];
    },
    enabled: !!user && hasFinancialAccess(role),
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<OverheadItem, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('overhead_items')
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overhead-items'] });
      toast({ title: 'Overhead item added' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to add item', description: error.message });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OverheadItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('overhead_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overhead-items'] });
      toast({ title: 'Overhead item updated' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update item', description: error.message });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('overhead_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overhead-items'] });
      toast({ title: 'Overhead item deleted' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to delete item', description: error.message });
    },
  });

  const totalMonthlyOverhead = query.data?.reduce((sum, item) => sum + item.monthly_cost, 0) ?? 0;

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    totalMonthlyOverhead,
    createItem,
    updateItem,
    deleteItem,
  };
}
