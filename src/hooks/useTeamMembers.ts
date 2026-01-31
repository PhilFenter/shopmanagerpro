import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  hourly_rate: number;
  created_at: string;
  updated_at: string;
}

export function useTeamMembers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const teamMembersQuery = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      // Fetch all profiles - in a shop environment, all team members need to be visible
      // This requires either an admin role or a public profiles policy
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  const updateHourlyRate = useMutation({
    mutationFn: async ({ profileId, hourlyRate }: { profileId: string; hourlyRate: number }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ hourly_rate: hourlyRate })
        .eq('id', profileId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Hourly rate updated' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update rate', description: error.message });
    },
  });

  return {
    teamMembers: teamMembersQuery.data ?? [],
    isLoading: teamMembersQuery.isLoading,
    error: teamMembersQuery.error,
    updateHourlyRate,
  };
}
