import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface RosterMember {
  id: string;
  name: string;
  is_active: boolean;
  profile_id: string | null;
}

/**
 * The worker roster, without pay data.
 *
 * Deliberately not `useWorkers()` — that reads the `workers` table directly, and
 * its SELECT policy is restricted to admins/managers because the table holds
 * hourly_rate and salary columns. A team member would get an empty array. The
 * get_workers_safe() RPC returns only id/name/is_active/profile_id, so everyone
 * can see who is on the schedule without seeing what anyone is paid.
 */
export function useRoster() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['roster'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_workers_safe');
      if (error) throw error;
      return (data ?? []) as RosterMember[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return {
    roster: data ?? [],
    activeRoster: (data ?? []).filter((r) => r.is_active),
    isLoading,
    error,
  };
}

/**
 * The current user's own worker id, or null if their login has never been linked
 * to a roster entry. Null is a real, expected state — it means they cannot add
 * shifts for themselves, and the page says so rather than failing on save.
 */
export function useMyWorkerId() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['my-worker-id', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('current_worker_id');
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return { myWorkerId: data ?? null, isLoading };
}
