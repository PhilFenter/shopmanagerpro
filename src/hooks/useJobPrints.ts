import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface JobPrint {
  id: string;
  job_id: string;
  design_name: string;
  artwork_url: string | null;
  location: string;
  width_in: number | null;
  height_in: number | null;
  garment_color: string | null;
  ink_colors: string[] | null;
  mesh_count: number | null;
  squeegee_durometer: number | null;
  strokes: number | null;
  flash: boolean;
  underbase: boolean;
  flash_temp: number | null;
  flash_time: number | null;
  cure_temp: number | null;
  cure_time: number | null;
  notes: string | null;
  sort_order: number;
}

export type JobPrintInput = Partial<Omit<JobPrint, 'id' | 'job_id'>> & {
  design_name: string;
  location: string;
};

export function useJobPrints(jobId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['job_prints', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_prints')
        .select('*')
        .eq('job_id', jobId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as JobPrint[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: JobPrintInput) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('job_prints')
        .insert({ ...input, job_id: jobId!, created_by: u.user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job_prints', jobId] });
      toast.success('Print added');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add print'),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<JobPrintInput>) => {
      const { error } = await supabase.from('job_prints').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job_prints', jobId] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('job_prints').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job_prints', jobId] });
      toast.success('Print deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const src = (query.data || []).find((p) => p.id === id);
      if (!src) throw new Error('Print not found');
      const { id: _omit, ...rest } = src as any;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('job_prints')
        .insert({ ...rest, design_name: `${src.design_name} (copy)`, created_by: u.user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job_prints', jobId] });
      toast.success('Print duplicated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to duplicate'),
  });

  return { prints: query.data || [], isLoading: query.isLoading, create, update, remove, duplicate };
}

export const PRINT_LOCATIONS = [
  'Left Chest',
  'Right Chest',
  'Full Front',
  'Full Back',
  'Upper Back / Yoke',
  'Left Sleeve',
  'Right Sleeve',
  'Left Sleeve Hem',
  'Right Sleeve Hem',
  'Hood',
  'Hem / Bottom',
  'Pocket',
  'Other',
];
