import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QuoteLineItem {
  id: string;
  service_type: string;
  description: string | null;
  style_number: string | null;
  quantity: number;
  color: string | null;
  placement: string | null;
  line_total: number | null;
}

export interface Quote {
  id: string;
  quote_number: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  company: string | null;
  status: string;
  total_price: number | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  converted_job_id: string | null;
  follow_up_sent_at: string | null;
  follow_up_count: number;
  notes: string | null;
  requested_date: string | null;
  printavo_visual_id: string | null;
  printavo_order_id: string | null;
  quote_line_items: QuoteLineItem[];
}

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'converted' | 'expired';

export const QUOTE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  approved: { label: 'Approved', color: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  converted: { label: 'Converted', color: 'bg-primary/15 text-primary' },
  expired: { label: 'Expired', color: 'bg-destructive/15 text-destructive' },
};

export function useQuotes() {
  return useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_line_items(id, service_type, description, style_number, quantity, color, placement, line_total)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Quote[];
    },
  });
}

export function useQuoteStats(quotes: Quote[] | undefined) {
  if (!quotes) return { total: 0, draft: 0, sent: 0, approved: 0, converted: 0, expired: 0, totalValue: 0, conversionRate: 0 };

  const total = quotes.length;
  const draft = quotes.filter(q => q.status === 'draft').length;
  const sent = quotes.filter(q => q.status === 'sent').length;
  const approved = quotes.filter(q => q.status === 'approved').length;
  const converted = quotes.filter(q => q.converted_job_id !== null).length;
  const expired = quotes.filter(q => q.status === 'expired').length;
  const totalValue = quotes.reduce((sum, q) => sum + (q.total_price || 0), 0);
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  return { total, draft, sent, approved, converted, expired, totalValue, conversionRate };
}
