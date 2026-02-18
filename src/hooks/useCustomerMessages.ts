import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface CustomerMessage {
  id: string;
  customer_id: string | null;
  job_id: string | null;
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  recipient: string | null;
  status: string;
  external_id: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useCustomerMessages(customerId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['customer_messages', customerId],
    queryFn: async () => {
      let q = supabase
        .from('customer_messages')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (customerId) {
        q = q.eq('customer_id', customerId);
      }

      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data as CustomerMessage[];
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (msg: {
      customer_id: string;
      job_id?: string;
      channel: string;
      direction?: string;
      subject?: string;
      body: string;
      recipient?: string;
      status?: string;
      sent_by: string;
    }) => {
      // If it's an email or SMS, send via edge function first
      if (msg.channel === 'email' && msg.recipient) {
        const { data, error } = await supabase.functions.invoke('notify-customer', {
          body: {
            jobId: msg.job_id,
            customerEmail: msg.recipient,
            customerName: '',
            orderNumber: '',
            stage: 'custom',
            source: 'manual',
            customSubject: msg.subject,
            customBody: msg.body,
          },
        });
        // Even if email fails, still log the attempt
      }

      if (msg.channel === 'sms' && msg.recipient) {
        await supabase.functions.invoke('send-sms', {
          body: {
            to: msg.recipient,
            message: msg.body,
            jobId: msg.job_id,
          },
        });
      }

      // Log message in DB
      const { error } = await supabase
        .from('customer_messages')
        .insert({
          customer_id: msg.customer_id,
          job_id: msg.job_id || null,
          channel: msg.channel as any,
          direction: (msg.direction || 'outbound') as any,
          subject: msg.subject || null,
          body: msg.body,
          recipient: msg.recipient || null,
          status: (msg.status || 'sent') as any,
          sent_by: msg.sent_by,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer_messages'] });
      toast({ title: 'Message sent' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to send', description: error.message });
    },
  });

  const addNote = useMutation({
    mutationFn: async (note: {
      customer_id: string;
      job_id?: string;
      body: string;
      sent_by: string;
    }) => {
      const { error } = await supabase
        .from('customer_messages')
        .insert({
          customer_id: note.customer_id,
          job_id: note.job_id || null,
          channel: 'internal_note' as any,
          direction: 'outbound' as any,
          body: note.body,
          status: 'sent' as any,
          sent_by: note.sent_by,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer_messages'] });
      toast({ title: 'Note added' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to add note', description: error.message });
    },
  });

  return {
    messages: query.data || [],
    isLoading: query.isLoading,
    sendMessage,
    addNote,
  };
}
