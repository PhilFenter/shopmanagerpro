import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { STAGE_ORDER, FINAL_STAGES } from './useJobStages';

export interface NotificationSetting {
  id: string;
  stage: string;
  notify_customer: boolean;
  email_template: string | null;
  sms_template: string | null;
  created_at: string;
  updated_at: string;
}

export function useNotificationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notification_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .order('created_at');
      if (error) throw error;
      const allStages = [...STAGE_ORDER, ...FINAL_STAGES];
      return (data as NotificationSetting[]).sort((a, b) => {
        const aIdx = allStages.indexOf(a.stage as any);
        const bIdx = allStages.indexOf(b.stage as any);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ id, notify_customer, email_template }: { id: string; notify_customer?: boolean; email_template?: string }) => {
      const updates: Record<string, unknown> = {};
      if (notify_customer !== undefined) updates.notify_customer = notify_customer;
      if (email_template !== undefined) updates.email_template = email_template;

      const { error } = await supabase
        .from('notification_settings')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_settings'] });
      toast({ title: 'Notification settings updated' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update', description: error.message });
    },
  });

  return { settings: query.data || [], isLoading: query.isLoading, updateSetting };
}
