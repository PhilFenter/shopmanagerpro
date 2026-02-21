import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface JobMockup {
  id: string;
  job_id: string;
  garment_id: string | null;
  storage_path: string;
  filename: string;
  version_number: number;
  is_approval_version: boolean;
  approved_at: string | null;
  approved_by_customer: boolean;
  customer_notes: string | null;
  placement: string | null;
  canvas_state: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  url?: string;
}

export function useMockups(jobId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mockupsQuery = useQuery({
    queryKey: ['job-mockups', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('job_mockups' as any)
        .select('*')
        .eq('job_id', jobId)
        .order('version_number', { ascending: false });
      if (error) throw error;

      const withUrls = await Promise.all(
        (data as any[]).map(async (m) => {
          const { data: urlData } = await supabase.storage
            .from('job-photos')
            .createSignedUrl(m.storage_path, 3600);
          return { ...m, url: urlData?.signedUrl || '' } as JobMockup;
        })
      );
      return withUrls;
    },
    enabled: !!jobId,
  });

  const getNextVersion = () => {
    const mockups = mockupsQuery.data || [];
    return mockups.length > 0 ? Math.max(...mockups.map(m => m.version_number)) + 1 : 1;
  };

  const saveMockup = useMutation({
    mutationFn: async ({
      jobId,
      garmentId,
      imageBlob,
      placement,
      canvasState,
    }: {
      jobId: string;
      garmentId?: string;
      imageBlob: Blob;
      placement?: string;
      canvasState?: any;
    }) => {
      const version = getNextVersion();
      const timestamp = Date.now();
      const filename = `mockup_v${version}_${timestamp}.png`;
      const storagePath = `jobs/${jobId}/mockups/${filename}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(storagePath, imageBlob, { contentType: 'image/png' });
      if (uploadError) throw uploadError;

      // Create record
      const { data, error } = await supabase
        .from('job_mockups' as any)
        .insert({
          job_id: jobId,
          garment_id: garmentId || null,
          storage_path: storagePath,
          filename,
          version_number: version,
          placement: placement || null,
          canvas_state: canvasState || null,
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) {
        await supabase.storage.from('job-photos').remove([storagePath]);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-mockups', jobId] });
      toast({ title: 'Mockup saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to save mockup', description: error.message });
    },
  });

  const setApprovalVersion = useMutation({
    mutationFn: async (mockupId: string) => {
      // Clear existing approval versions for this job
      await supabase
        .from('job_mockups' as any)
        .update({ is_approval_version: false } as any)
        .eq('job_id', jobId!);

      const { error } = await supabase
        .from('job_mockups' as any)
        .update({ is_approval_version: true } as any)
        .eq('id', mockupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-mockups', jobId] });
      toast({ title: 'Approval version set' });
    },
  });

  const deleteMockup = useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      await supabase.storage.from('job-photos').remove([storagePath]);
      const { error } = await supabase.from('job_mockups' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-mockups', jobId] });
      toast({ title: 'Mockup deleted' });
    },
  });

  return {
    mockups: mockupsQuery.data ?? [],
    isLoading: mockupsQuery.isLoading,
    saveMockup,
    setApprovalVersion,
    deleteMockup,
  };
}
