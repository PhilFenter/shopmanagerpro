import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { useAuth } from './useAuth';

export interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  hourly_rate: number;
  is_salary: boolean;
  monthly_salary: number;
  weekly_hours: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateTeamMemberInput {
  profileId: string;
  hourly_rate?: number;
  is_salary?: boolean;
  monthly_salary?: number;
  weekly_hours?: number;
}

export function useTeamMembers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();

  const teamMembersQuery = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_team_members_safe');
      
      if (error) throw error;
      
      // Sort by full_name
      const sorted = (data ?? []).sort((a, b) => 
        (a.full_name ?? '').localeCompare(b.full_name ?? '')
      );
      return sorted as TeamMember[];
    },
    enabled: !!user && !loading,
  });

  const updateMember = useMutation({
    mutationFn: async ({ profileId, ...updates }: UpdateTeamMemberInput) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profileId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Team member updated' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update', description: error.message });
    },
  });

  // Legacy alias for compatibility
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
    members: teamMembersQuery.data ?? [], // alias for useBusinessMetrics
    isLoading: teamMembersQuery.isLoading,
    error: teamMembersQuery.error,
    updateMember,
    updateHourlyRate,
  };
}
