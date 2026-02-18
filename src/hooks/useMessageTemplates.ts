import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  subject: string | null;
  body: string;
  channel: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useMessageTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['message_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('category', { ascending: true });
      if (error) throw error;
      return data as MessageTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (t: { name: string; category: string; subject?: string; body: string; channel: string; created_by?: string }) => {
      const { error } = await supabase.from('message_templates').insert(t as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message_templates'] });
      toast({ title: 'Template created' });
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; category?: string; subject?: string; body?: string; channel?: string }) => {
      const { error } = await supabase.from('message_templates').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message_templates'] });
      toast({ title: 'Template updated' });
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('message_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message_templates'] });
      toast({ title: 'Template deleted' });
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  return {
    templates: query.data || [],
    isLoading: query.isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
