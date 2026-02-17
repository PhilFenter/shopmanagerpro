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
  custom_label: string | null;
  email_subject: string | null;
  is_custom: boolean;
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
    mutationFn: async ({ id, notify_customer, email_template, custom_label, email_subject }: { id: string; notify_customer?: boolean; email_template?: string; custom_label?: string; email_subject?: string }) => {
      const updates: Record<string, unknown> = {};
      if (notify_customer !== undefined) updates.notify_customer = notify_customer;
      if (email_template !== undefined) updates.email_template = email_template;
      if (custom_label !== undefined) updates.custom_label = custom_label;
      if (email_subject !== undefined) updates.email_subject = email_subject;

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

  const addSetting = useMutation({
    mutationFn: async ({ stage, custom_label }: { stage: string; custom_label: string }) => {
      const { error } = await supabase
        .from('notification_settings')
        .insert({ stage: stage as any, custom_label, is_custom: true, notify_customer: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_settings'] });
      toast({ title: 'Notification added' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to add', description: error.message });
    },
  });

  const deleteSetting = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notification_settings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_settings'] });
      toast({ title: 'Notification removed' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to remove', description: error.message });
    },
  });

  return { settings: query.data || [], isLoading: query.isLoading, updateSetting, addSetting, deleteSetting };
}
