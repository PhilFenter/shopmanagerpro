import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface QuoteImprint {
  id: string;
  quote_id: string;
  decoration_type: string;
  matrix_id: string | null;
  column_value: string | null;
  placement: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const DECORATION_TYPES = [
  { value: 'screen_print', label: 'Screen Printing' },
  { value: 'dtf', label: 'DTF Transfers' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'leather_patch', label: 'Leather Patch' },
  { value: 'uv_patch', label: 'UV Patch' },
  { value: 'vinyl', label: 'Vinyl/HTV' },
  { value: 'other', label: 'Other' },
];

export function useQuoteImprints(quoteId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const imprintsQuery = useQuery({
    queryKey: ['quote-imprints', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('quote_imprints' as any)
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as any[]) as QuoteImprint[];
    },
    enabled: !!quoteId,
  });

  const createImprint = useMutation({
    mutationFn: async (input: Partial<QuoteImprint> & { quote_id: string }) => {
      const { data, error } = await supabase
        .from('quote_imprints' as any)
        .insert({
          quote_id: input.quote_id,
          decoration_type: input.decoration_type || 'screen_print',
          matrix_id: input.matrix_id || null,
          column_value: input.column_value || null,
          placement: input.placement || null,
          description: input.description || null,
          sort_order: input.sort_order || 0,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as QuoteImprint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-imprints', quoteId] });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to add imprint', description: error.message });
    },
  });

  const updateImprint = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuoteImprint> & { id: string }) => {
      const { data, error } = await supabase
        .from('quote_imprints' as any)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as QuoteImprint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-imprints', quoteId] });
    },
  });

  const deleteImprint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quote_imprints' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-imprints', quoteId] });
      toast({ title: 'Imprint removed' });
    },
  });

  return {
    imprints: imprintsQuery.data ?? [],
    isLoading: imprintsQuery.isLoading,
    createImprint,
    updateImprint,
    deleteImprint,
  };
}
