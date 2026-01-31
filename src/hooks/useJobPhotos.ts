import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface JobPhoto {
  id: string;
  job_id: string;
  storage_path: string;
  filename: string;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
  url?: string;
}

export function useJobPhotos(jobId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const photosQuery = useQuery({
    queryKey: ['job-photos', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from('job_photos')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get public URLs for each photo
      const photosWithUrls = data.map((photo) => {
        const { data: urlData } = supabase.storage
          .from('job-photos')
          .getPublicUrl(photo.storage_path);
        
        return {
          ...photo,
          url: urlData.publicUrl,
        };
      });
      
      return photosWithUrls as JobPhoto[];
    },
    enabled: !!jobId,
  });

  const uploadPhoto = useMutation({
    mutationFn: async ({ 
      jobId, 
      file, 
      description 
    }: { 
      jobId: string; 
      file: File; 
      description?: string;
    }) => {
      // Generate unique path: jobs/{jobId}/{timestamp}_{filename}
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `jobs/${jobId}/${timestamp}_${safeName}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(storagePath, file);
      
      if (uploadError) throw uploadError;
      
      // Create database record
      const { data, error: insertError } = await supabase
        .from('job_photos')
        .insert({
          job_id: jobId,
          storage_path: storagePath,
          filename: file.name,
          description,
          uploaded_by: user?.id,
        })
        .select()
        .single();
      
      if (insertError) {
        // Clean up storage if DB insert fails
        await supabase.storage.from('job-photos').remove([storagePath]);
        throw insertError;
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['job-photos', data.job_id] });
      toast({ title: 'Photo uploaded' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async ({ id, storagePath, jobId }: { id: string; storagePath: string; jobId: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('job-photos')
        .remove([storagePath]);
      
      if (storageError) throw storageError;
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('job_photos')
        .delete()
        .eq('id', id);
      
      if (dbError) throw dbError;
      
      return { id, jobId };
    },
    onSuccess: ({ jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['job-photos', jobId] });
      toast({ title: 'Photo deleted' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Delete failed', description: error.message });
    },
  });

  return {
    photos: photosQuery.data ?? [],
    isLoading: photosQuery.isLoading,
    error: photosQuery.error,
    uploadPhoto,
    deletePhoto,
  };
}
