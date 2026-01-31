import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface StoredPhoto {
  id: string;
  url: string;
  path: string;
  location: string;
}

export function usePhotoStorage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Upload a photo to Supabase storage
   * @param file The file to upload
   * @param jobId Optional job ID to organize photos
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
      const prefix = jobId || 'general';
      const filename = `${prefix}/${timestamp}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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

      return {
        id: data.id || timestamp.toString(),
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
   * Delete a photo from storage
   */
  const deletePhoto = async (path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from('job-photos')
        .remove([path]);

      if (error) throw error;
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
