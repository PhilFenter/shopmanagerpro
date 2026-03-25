import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChecklistItem {
  text: string;
  required: boolean;
  done: boolean;
}

export interface JobChecklist {
  id: string;
  template_id: string | null;
  assigned_to: string | null;
  job_id: string | null;
  title: string;
  items: ChecklistItem[];
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useJobChecklists(jobId: string | undefined | null) {
  const qc = useQueryClient();

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ['job-checklists', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_instances')
        .select('*')
        .eq('job_id', jobId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(d => ({
        ...d,
        items: Array.isArray(d.items) ? d.items : [],
      })) as unknown as JobChecklist[];
    },
    enabled: !!jobId,
  });

  const attachChecklist = useMutation({
    mutationFn: async (params: { templateTitle: string; templateId: string; items: { text: string; required: boolean }[] }) => {
      const { data, error } = await supabase
        .from('checklist_instances')
        .insert({
          job_id: jobId,
          template_id: params.templateId,
          title: params.templateTitle,
          items: params.items.map(it => ({ ...it, done: false })),
          status: 'in_progress',
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-checklists', jobId] });
      qc.invalidateQueries({ queryKey: ['checklist-instances'] });
    },
  });

  const updateChecklist = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; items?: ChecklistItem[]; status?: string; completed_at?: string | null }) => {
      const { error } = await supabase
        .from('checklist_instances')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-checklists', jobId] });
      qc.invalidateQueries({ queryKey: ['checklist-instances'] });
    },
  });

  const removeChecklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('checklist_instances')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-checklists', jobId] });
      qc.invalidateQueries({ queryKey: ['checklist-instances'] });
    },
  });

  // Computed stats
  const totalItems = checklists.reduce((sum, cl) => sum + cl.items.length, 0);
  const doneItems = checklists.reduce((sum, cl) => sum + cl.items.filter(it => it.done).length, 0);
  const activeCount = checklists.filter(cl => cl.status === 'in_progress').length;

  return {
    checklists,
    isLoading,
    attachChecklist,
    updateChecklist,
    removeChecklist,
    totalItems,
    doneItems,
    activeCount,
  };
}
