import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface QuoteMockup {
  id: string;
  quote_id: string;
  job_id: string | null;
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

export function useQuoteMockups(quoteId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mockupsQuery = useQuery({
    queryKey: ['quote-mockups', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('job_mockups' as any)
        .select('*')
        .eq('quote_id', quoteId)
        .order('version_number', { ascending: false });
      if (error) throw error;

      const withUrls = await Promise.all(
        (data as any[]).map(async (m) => {
          const { data: urlData } = await supabase.storage
            .from('job-photos')
            .createSignedUrl(m.storage_path, 3600);
          return { ...m, url: urlData?.signedUrl || '' } as QuoteMockup;
        })
      );
      return withUrls;
    },
    enabled: !!quoteId,
  });

  const getNextVersion = () => {
    const mockups = mockupsQuery.data || [];
    return mockups.length > 0 ? Math.max(...mockups.map(m => m.version_number)) + 1 : 1;
  };

  const saveMockup = useMutation({
    mutationFn: async ({
      quoteId,
      imageBlob,
      placement,
      canvasState,
      lineItemImageUrl,
    }: {
      quoteId: string;
      imageBlob: Blob;
      placement?: string;
      canvasState?: any;
      lineItemImageUrl?: string;
    }) => {
      const version = getNextVersion();
      const timestamp = Date.now();
      const filename = `mockup_v${version}_${timestamp}.png`;
      const storagePath = `quotes/${quoteId}/mockups/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(storagePath, imageBlob, { contentType: 'image/png' });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('job_mockups' as any)
        .insert({
          quote_id: quoteId,
          job_id: null,
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
      queryClient.invalidateQueries({ queryKey: ['quote-mockups', quoteId] });
      toast({ title: 'Mockup saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to save mockup', description: error.message });
    },
  });

  const deleteMockup = useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      await supabase.storage.from('job-photos').remove([storagePath]);
      const { error } = await supabase.from('job_mockups' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-mockups', quoteId] });
      toast({ title: 'Mockup deleted' });
    },
  });

  return {
    mockups: mockupsQuery.data ?? [],
    isLoading: mockupsQuery.isLoading,
    saveMockup,
    deleteMockup,
  };
}
