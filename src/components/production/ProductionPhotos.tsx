import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, X } from 'lucide-react';

export interface PhotoSlot {
  location: string;
  file: File | null;
  preview: string;
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
}

export default function ProductionPhotos({
  photos,
  onPhotosChange,
  slots = 4,
  videoAspect = false,
  editableLabels = true,
  fixedLabels,
}: ProductionPhotosProps) {
  const handlePhotoUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      onPhotosChange(
        photos.map((p, i) =>
          i === index ? { ...p, file, preview: e.target?.result as string } : p
        )
      );
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index: number) => {
    onPhotosChange(
      photos.map((p, i) =>
        i === index ? { ...p, file: null, preview: '' } : p
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
                className={`relative border-2 border-dashed rounded-xl ${
                  videoAspect ? 'aspect-video' : 'aspect-square'
                } flex items-center justify-center bg-muted/30 overflow-hidden`}
              >
                {photo.preview ? (
                  <>
                    <img
                      src={photo.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
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
