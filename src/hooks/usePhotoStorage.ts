import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useQueryClient } from '@tanstack/react-query';

export interface StoredPhoto {
  id: string;
  url: string;
  path: string;
  location: string;
}

export function usePhotoStorage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Upload a photo to Supabase storage and optionally link it to a job
   * @param file The file to upload
   * @param jobId Optional job ID - if provided, creates a job_photos record
   * @param location Label for the photo (e.g., "Left Chest", "Transfer")
   */
  const uploadPhoto = async (
    file: File,
    jobId?: string,
    location?: string
  ): Promise<StoredPhoto | null> => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Must be logged in to upload photos' });
      return null;
    }

    setIsUploading(true);
    try {
      // Create a unique filename
      const ext = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const prefix = jobId ? `jobs/${jobId}` : 'general';
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${prefix}/${timestamp}_${safeName}`;

      // Upload to storage
      const { data, error } = await supabase.storage
        .from('job-photos')
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('job-photos')
        .getPublicUrl(data.path);

      // If jobId provided, also create a job_photos database record
      // This links production photos to job cards for approvals
      let photoId = timestamp.toString();
      if (jobId) {
        const { data: photoRecord, error: insertError } = await supabase
          .from('job_photos')
          .insert({
            job_id: jobId,
            storage_path: data.path,
            filename: file.name,
            description: location || null,
            uploaded_by: user.id,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to create job_photos record:', insertError);
          // Don't fail the upload, just log the error
        } else if (photoRecord) {
          photoId = photoRecord.id;
          // Invalidate job photos query so the gallery updates
          queryClient.invalidateQueries({ queryKey: ['job-photos', jobId] });
        }
      }

      return {
        id: photoId,
        url: urlData.publicUrl,
        path: data.path,
        location: location || '',
      };
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to upload photo',
        description: error.message,
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Upload multiple photos
   */
  const uploadPhotos = async (
    files: { file: File; location?: string }[],
    jobId?: string
  ): Promise<StoredPhoto[]> => {
    const results: StoredPhoto[] = [];
    
    for (const { file, location } of files) {
      const result = await uploadPhoto(file, jobId, location);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  };

  /**
   * Delete a photo from storage and its job_photos record if exists
   */
  const deletePhoto = async (path: string, jobId?: string): Promise<boolean> => {
    try {
      // Delete from storage
      const { error } = await supabase.storage
        .from('job-photos')
        .remove([path]);

      if (error) throw error;

      // If jobId provided, also delete the job_photos record
      if (jobId) {
        await supabase
          .from('job_photos')
          .delete()
          .eq('storage_path', path);
        
        queryClient.invalidateQueries({ queryKey: ['job-photos', jobId] });
      }

      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete photo',
        description: error.message,
      });
      return false;
    }
  };

  return {
    uploadPhoto,
    uploadPhotos,
    deletePhoto,
    isUploading,
  };
}
