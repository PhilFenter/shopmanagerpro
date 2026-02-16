import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Quote {
  id: string;
  quote_number: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  status: string;
  notes: string | null;
  raw_email: string | null;
  total_price: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  converted_job_id: string | null;
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  style_number: string | null;
  description: string | null;
  service_type: string;
  quantity: number;
  sizes: Record<string, number>;
  garment_cost: number;
  garment_markup_pct: number;
  decoration_cost: number;
  decoration_params: Record<string, any>;
  line_total: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQuoteInput {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  notes?: string;
  raw_email?: string;
}

export function useQuotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const quotesQuery = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!user,
  });

  const createQuote = useMutation({
    mutationFn: async (input: CreateQuoteInput) => {
      const { data, error } = await supabase
        .from('quotes')
        .insert({ ...input, created_by: user?.id })
        .select()
        .single();

      if (error) throw error;
      return data as Quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Quote created' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to create quote', description: error.message });
    },
  });

  const updateQuote = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Quote> & { id: string }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update quote', description: error.message });
    },
  });

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Quote deleted' });
    },
  });

  return {
    quotes: quotesQuery.data ?? [],
    isLoading: quotesQuery.isLoading,
    createQuote,
    updateQuote,
    deleteQuote,
  };
}

export function useQuoteLineItems(quoteId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const lineItemsQuery = useQuery({
    queryKey: ['quote-line-items', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as QuoteLineItem[];
    },
    enabled: !!quoteId,
  });

  const createLineItem = useMutation({
    mutationFn: async (input: Partial<QuoteLineItem> & { quote_id: string }) => {
      const { data, error } = await supabase
        .from('quote_line_items')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as QuoteLineItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quote-line-items', data.quote_id] });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to add line item', description: error.message });
    },
  });

  const updateLineItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuoteLineItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('quote_line_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as QuoteLineItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quote-line-items', data.quote_id] });
    },
  });

  const deleteLineItem = useMutation({
    mutationFn: async ({ id, quoteId }: { id: string; quoteId: string }) => {
      const { error } = await supabase.from('quote_line_items').delete().eq('id', id);
      if (error) throw error;
      return { quoteId };
    },
    onSuccess: ({ quoteId: qid }) => {
      queryClient.invalidateQueries({ queryKey: ['quote-line-items', qid] });
    },
  });

  return {
    lineItems: lineItemsQuery.data ?? [],
    isLoading: lineItemsQuery.isLoading,
    createLineItem,
    updateLineItem,
    deleteLineItem,
  };
}
