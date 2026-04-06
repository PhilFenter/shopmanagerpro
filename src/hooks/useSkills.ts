import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const SKILL_LEVELS = [
  { level: 0, label: 'Not Started', color: 'bg-muted text-muted-foreground' },
  { level: 1, label: 'In Training', color: 'bg-yellow-100 text-yellow-800' },
  { level: 2, label: 'Qualified',   color: 'bg-green-100 text-green-800' },
  { level: 3, label: 'Lead',        color: 'bg-blue-100 text-blue-800' },
  { level: 4, label: 'Evaluator',   color: 'bg-purple-100 text-purple-800' },
] as const;

export type SkillLevel = 0 | 1 | 2 | 3 | 4;

export interface Skill {
  id: string;
  created_by: string | null;
  name: string;
  department: string;
  description: string | null;
  minimum_acceptable_standard: string | null;
  conditions: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SkillRecord {
  id: string;
  user_id: string;
  skill_id: string;
  level: SkillLevel;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Observation {
  id: string;
  skill_id: string;
  candidate_id: string;
  evaluator_id: string;
  conducted_at: string;
  result: 'pass' | 'no_pass' | 'incomplete';
  level_awarded: SkillLevel | null;
  conditions_notes: string | null;
  evaluator_notes: string;
  recheck_required: boolean;
  recheck_by: string | null;
  created_at: string;
}

/** @deprecated Use Observation instead */
export type CheckRide = Observation;

// ─── Skills ──────────────────────────────────────────────────────────────────
export function useSkills() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .eq('is_active', true)
        .order('department')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data as Skill[];
    },
    enabled: !!user,
  });

  const createSkill = useMutation({
    mutationFn: async (skill: Omit<Skill, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('skills')
        .insert({ ...skill, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills'] }),
  });

  const updateSkill = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Skill> & { id: string }) => {
      const { error } = await supabase.from('skills').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills'] }),
  });

  const deleteSkill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('skills').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills'] }),
  });

  const departments = [...new Set(skills.map(s => s.department))].sort();

  return { skills, isLoading, createSkill, updateSkill, deleteSkill, departments };
}

// ─── Skill Records ────────────────────────────────────────────────────────────
export function useSkillRecords() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['skill-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skill_records')
        .select('*');
      if (error) throw error;
      return data as SkillRecord[];
    },
    enabled: !!user,
  });

  const upsertRecord = useMutation({
    mutationFn: async (record: Omit<SkillRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('skill_records')
        .upsert(record, { onConflict: 'user_id,skill_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skill-records'] }),
  });

  return { records, isLoading, upsertRecord };
}

// ─── Observations ─────────────────────────────────────────────────────────────
export function useObservations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: observations = [], isLoading } = useQuery({
    queryKey: ['observations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('check_rides')
        .select('*')
        .order('conducted_at', { ascending: false });
      if (error) throw error;
      return data as Observation[];
    },
    enabled: !!user,
  });

  const conductObservation = useMutation({
    mutationFn: async (ride: Omit<Observation, 'id' | 'created_at'>) => {
      // 1. Record the observation
      const { data, error } = await supabase
        .from('check_rides')
        .insert(ride)
        .select()
        .single();
      if (error) throw error;

      // 2. If pass, upsert the skill record
      if (ride.result === 'pass' && ride.level_awarded) {
        const { error: recErr } = await supabase
          .from('skill_records')
          .upsert({
            user_id: ride.candidate_id,
            skill_id: ride.skill_id,
            level: ride.level_awarded,
            verified_by: ride.evaluator_id,
            verified_at: ride.conducted_at,
            notes: ride.evaluator_notes || null,
          }, { onConflict: 'user_id,skill_id' });
        if (recErr) throw recErr;
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['observations'] });
      qc.invalidateQueries({ queryKey: ['skill-records'] });
    },
  });

  return { observations, isLoading, conductObservation };
}

/** @deprecated Use useObservations instead */
export const useCheckRides = useObservations;
