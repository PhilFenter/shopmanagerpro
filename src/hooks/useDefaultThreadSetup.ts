import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface ThreadSetup {
  color: string;
  number: string;
  weight: string;
}

export type ThreadSetupMap = Record<number, ThreadSetup>;

// Fallback defaults if nothing is saved
const FALLBACK_THREAD_SETUP: ThreadSetupMap = {
  1:  { color: '', number: '', weight: '40' },
  2:  { color: 'Royal Blue', number: '1842', weight: '40' },
  3:  { color: 'Black', number: '1800', weight: '40' },
  4:  { color: 'Brown', number: '1872', weight: '40' },
  5:  { color: 'Gold', number: '1624', weight: '40' },
  6:  { color: '', number: '', weight: '40' },
  7:  { color: 'Light Blue', number: '1528', weight: '40' },
  8:  { color: 'White', number: '1800', weight: '40' },
  9:  { color: 'Red', number: '1918', weight: '40' },
  10: { color: 'Yellow', number: '1623', weight: '40' },
  11: { color: '', number: '', weight: '40' },
  12: { color: 'Orange', number: '1678', weight: '40' },
  13: { color: 'Red', number: '1747', weight: '40' },
  14: { color: 'White 60wt', number: '1801', weight: '60' },
  15: { color: 'Black 60wt', number: '1800', weight: '60' },
};

const SETTINGS_KEY = 'embroidery_default_thread_setup';

export function useDefaultThreadSetup() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = role === 'admin';

  const query = useQuery({
    queryKey: ['default-thread-setup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('value')
        .eq('key', SETTINGS_KEY)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        // Parse the stored JSON value
        return data.value as unknown as ThreadSetupMap;
      }
      
      return FALLBACK_THREAD_SETUP;
    },
    enabled: !!user,
  });

  const saveDefaults = useMutation({
    mutationFn: async (setup: ThreadSetupMap) => {
      // Check if setting exists
      const { data: existing } = await supabase
        .from('business_settings')
        .select('id')
        .eq('key', SETTINGS_KEY)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('business_settings')
          .update({ value: setup as unknown as any, updated_at: new Date().toISOString() })
          .eq('key', SETTINGS_KEY);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('business_settings')
          .insert({ key: SETTINGS_KEY, value: setup as unknown as any });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['default-thread-setup'] });
      toast({ title: 'Default thread setup saved' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to save defaults', 
        description: error.message 
      });
    },
  });

  return {
    defaultSetup: query.data ?? FALLBACK_THREAD_SETUP,
    isLoading: query.isLoading,
    saveDefaults,
    canEdit: isAdmin,
  };
}
