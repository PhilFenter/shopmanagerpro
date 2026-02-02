import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, X, Loader2, Cloud, CloudOff } from 'lucide-react';
import { usePhotoStorage, StoredPhoto } from '@/hooks/usePhotoStorage';
import { cn } from '@/lib/utils';

export interface PhotoSlot {
  location: string;
  file: File | null;
  preview: string;
  /** If uploaded to cloud, this contains the storage info */
  stored?: StoredPhoto;
}

interface ProductionPhotosProps {
  photos: PhotoSlot[];
  onPhotosChange: (photos: PhotoSlot[]) => void;
  /** Number of photo slots (default 4) */
  slots?: number;
  /** Use aspect-video instead of aspect-square */
  videoAspect?: boolean;
  /** Show editable location labels (default true) */
  editableLabels?: boolean;
  /** Fixed labels for each slot (overrides editable labels) */
  fixedLabels?: string[];
  /** Job ID for organizing photos in storage */
  jobId?: string;
  /** Enable cloud upload (default true) */
  cloudUpload?: boolean;
}

export default function ProductionPhotos({
  photos,
  onPhotosChange,
  slots = 4,
  videoAspect = false,
  editableLabels = true,
  fixedLabels,
  jobId,
  cloudUpload = true,
}: ProductionPhotosProps) {
  const { uploadPhoto, deletePhoto, isUploading } = usePhotoStorage();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const handlePhotoUpload = async (index: number, file: File) => {
    // First show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      onPhotosChange(
        photos.map((p, i) =>
          i === index ? { ...p, file, preview: e.target?.result as string } : p
        )
      );
    };
    reader.readAsDataURL(file);

    // Then upload to cloud if enabled
    if (cloudUpload) {
      setUploadingIndex(index);
      const location = fixedLabels?.[index] || photos[index]?.location || `Photo ${index + 1}`;
      const stored = await uploadPhoto(file, jobId, location);
      
      if (stored) {
        onPhotosChange(
          photos.map((p, i) =>
            i === index ? { ...p, file, preview: stored.url, stored } : p
          )
        );
      }
      setUploadingIndex(null);
    }
  };

  const removePhoto = async (index: number) => {
    const photo = photos[index];
    
    // Delete from cloud if it was uploaded (also removes job_photos record if jobId provided)
    if (photo?.stored?.path) {
      await deletePhoto(photo.stored.path, jobId);
    }

    onPhotosChange(
      photos.map((p, i) =>
        i === index ? { ...p, file: null, preview: '', stored: undefined } : p
      )
    );
  };

  const updateLocation = (index: number, location: string) => {
    onPhotosChange(
      photos.map((p, i) => (i === index ? { ...p, location } : p))
    );
  };

  // Ensure we have the right number of slots
  const displayPhotos = [...photos];
  while (displayPhotos.length < slots) {
    displayPhotos.push({ location: '', file: null, preview: '' });
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Production Photos
          {cloudUpload && (
            <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Cloud className="h-3 w-3" />
              Cloud sync
            </span>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tap camera to take photos directly
        </p>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-4 grid-cols-2 ${slots > 2 ? 'lg:grid-cols-4' : ''}`}>
          {displayPhotos.slice(0, slots).map((photo, index) => (
            <div key={index} className="space-y-2">
              {fixedLabels ? (
                <Label className="text-sm font-medium">{fixedLabels[index] || `Photo ${index + 1}`}</Label>
              ) : editableLabels ? (
                <Input
                  value={photo.location}
                  onChange={(e) => updateLocation(index, e.target.value)}
                  placeholder={`Photo ${index + 1} label`}
                  className="text-sm"
                />
              ) : (
                <Label className="text-sm font-medium">Photo {index + 1}</Label>
              )}
              <div
                className={cn(
                  'relative border-2 border-dashed rounded-xl flex items-center justify-center bg-muted/30 overflow-hidden',
                  videoAspect ? 'aspect-video' : 'aspect-square'
                )}
              >
                {photo.preview ? (
                  <>
                    <img
                      src={photo.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {/* Cloud indicator */}
                    {photo.stored ? (
                      <div className="absolute bottom-2 left-2 p-1 bg-green-500/90 text-white rounded-full">
                        <Cloud className="h-3 w-3" />
                      </div>
                    ) : cloudUpload && (
                      <div className="absolute bottom-2 left-2 p-1 bg-muted/90 text-muted-foreground rounded-full">
                        <CloudOff className="h-3 w-3" />
                      </div>
                    )}
                    {/* Uploading indicator */}
                    {uploadingIndex === index && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 p-2 bg-destructive text-destructive-foreground rounded-full shadow-lg active:scale-95 transition-transform"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-3 cursor-pointer w-full h-full active:bg-primary/10 transition-colors rounded-xl touch-manipulation">
                    <div className="p-4 rounded-full bg-primary/10 border-2 border-primary/30">
                      <Camera className="h-10 w-10 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Tap to Capture
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files?.[0] && handlePhotoUpload(index, e.target.files[0])
                      }
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Re-export PhotoSlot type for convenience
export type { StoredPhoto };
