import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SopStep {
  id: string;
  sop_id: string;
  sort_order: number;
  title: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  tip: string | null;
  warning: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sop {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: string;
  department: string | null;
  tags: string[];
  status: string;
  version: number;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  steps?: SopStep[];
}

export interface ChecklistTemplate {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: string;
  department: string | null;
  sop_id: string | null;
  items: { text: string; required: boolean }[];
  created_at: string;
  updated_at: string;
}

export interface ChecklistInstance {
  id: string;
  template_id: string | null;
  assigned_to: string | null;
  job_id: string | null;
  title: string;
  items: { text: string; required: boolean; done: boolean }[];
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingPlan {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  role: string | null;
  department: string | null;
  sop_ids: string[];
  checklist_template_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface TrainingAssignment {
  id: string;
  training_plan_id: string;
  assigned_to: string;
  assigned_by: string;
  completed_sop_ids: string[];
  completed_checklist_ids: string[];
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const DEPARTMENTS = ['Embroidery', 'Screen Print', 'DTF', 'Leather', 'Art', 'Pressing', 'Shipping', 'General'];
const CATEGORIES = ['Setup', 'Production', 'Quality Control', 'Safety', 'Maintenance', 'End of Day', 'Onboarding', 'General'];

export { DEPARTMENTS, CATEGORIES };

export function useSOPs() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: sops = [], isLoading } = useQuery({
    queryKey: ['sops'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sops')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(d => ({ ...d, tags: d.tags ?? [] })) as unknown as Sop[];
    },
    enabled: !!user,
  });

  const createSop = useMutation({
    mutationFn: async (sop: Partial<Sop>) => {
      const { data, error } = await supabase
        .from('sops')
        .insert({ ...sop, created_by: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sops'] }),
  });

  const updateSop = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Sop> & { id: string }) => {
      const { error } = await supabase.from('sops').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sops'] }),
  });

  const deleteSop = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sops').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sops'] }),
  });

  return { sops, isLoading, createSop, updateSop, deleteSop };
}

export function useSOPSteps(sopId: string | null) {
  const qc = useQueryClient();

  const { data: steps = [], isLoading } = useQuery({
    queryKey: ['sop-steps', sopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sop_steps')
        .select('*')
        .eq('sop_id', sopId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as unknown as SopStep[];
    },
    enabled: !!sopId,
  });

  const upsertStep = useMutation({
    mutationFn: async (step: Partial<SopStep> & { sop_id: string }) => {
      if (step.id) {
        const { id, ...updates } = step;
        const { error } = await supabase.from('sop_steps').update(updates as any).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sop_steps').insert(step as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sop-steps', sopId] }),
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sop_steps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sop-steps', sopId] }),
  });

  return { steps, isLoading, upsertStep, deleteStep };
}

export function useChecklistTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(d => ({ ...d, items: Array.isArray(d.items) ? d.items : [] })) as unknown as ChecklistTemplate[];
    },
    enabled: !!user,
  });

  const createTemplate = useMutation({
    mutationFn: async (t: Partial<ChecklistTemplate>) => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .insert({ ...t, created_by: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChecklistTemplate> & { id: string }) => {
      const { error } = await supabase.from('checklist_templates').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  });

  return { templates, isLoading, createTemplate, updateTemplate, deleteTemplate };
}

export function useChecklistInstances() {
  const qc = useQueryClient();

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ['checklist-instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_instances')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(d => ({ ...d, items: Array.isArray(d.items) ? d.items : [] })) as unknown as ChecklistInstance[];
    },
  });

  const createInstance = useMutation({
    mutationFn: async (inst: Partial<ChecklistInstance>) => {
      const { data, error } = await supabase
        .from('checklist_instances')
        .insert(inst as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-instances'] }),
  });

  const updateInstance = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChecklistInstance> & { id: string }) => {
      const { error } = await supabase.from('checklist_instances').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-instances'] }),
  });

  return { instances, isLoading, createInstance, updateInstance };
}

export function useTrainingPlans() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['training-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_plans')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(d => ({
        ...d,
        sop_ids: d.sop_ids ?? [],
        checklist_template_ids: d.checklist_template_ids ?? [],
      })) as unknown as TrainingPlan[];
    },
    enabled: !!user,
  });

  const createPlan = useMutation({
    mutationFn: async (plan: Partial<TrainingPlan>) => {
      const { data, error } = await supabase
        .from('training_plans')
        .insert({ ...plan, created_by: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-plans'] }),
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TrainingPlan> & { id: string }) => {
      const { error } = await supabase.from('training_plans').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-plans'] }),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('training_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-plans'] }),
  });

  return { plans, isLoading, createPlan, updatePlan, deletePlan };
}

export function useTrainingAssignments() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['training-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_assignments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(d => ({
        ...d,
        completed_sop_ids: d.completed_sop_ids ?? [],
        completed_checklist_ids: d.completed_checklist_ids ?? [],
      })) as unknown as TrainingAssignment[];
    },
    enabled: !!user,
  });

  const createAssignment = useMutation({
    mutationFn: async (a: Partial<TrainingAssignment>) => {
      const { data, error } = await supabase
        .from('training_assignments')
        .insert({ ...a, assigned_by: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-assignments'] }),
  });

  const updateAssignment = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TrainingAssignment> & { id: string }) => {
      const { error } = await supabase.from('training_assignments').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-assignments'] }),
  });

  return { assignments, isLoading, createAssignment, updateAssignment };
}
