import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Camera, X, Loader2, Cloud, CloudOff, Send, Check, ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePhotoStorage, StoredPhoto } from '@/hooks/usePhotoStorage';
import { useJobPhotos } from '@/hooks/useJobPhotos';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

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
  /** Customer email for send-for-approval (enables Send button) */
  customerEmail?: string | null;
  /** Customer name for send-for-approval */
  customerName?: string;
  /** Order number for send-for-approval */
  orderNumber?: string | null;
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
  customerEmail,
  customerName,
  orderNumber,
}: ProductionPhotosProps) {
  const { uploadPhoto, deletePhoto, isUploading } = usePhotoStorage();
  const { toast } = useToast();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Also fetch job photos if we have a jobId (so we can send any photo from the job gallery)
  const { photos: jobGalleryPhotos } = useJobPhotos(jobId || '');

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

  // Toggle selection for gallery photos (used in send dialog)
  const toggleGalleryPhoto = (photoId: string) => {
    setSelectedGalleryPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const [selectedGalleryPhotos, setSelectedGalleryPhotos] = useState<Set<string>>(new Set());

  const handleSendApproval = async () => {
    if (!customerEmail) {
      toast({
        variant: 'destructive',
        title: 'No email address',
        description: 'This customer does not have an email address on file.',
      });
      return;
    }

    if (selectedGalleryPhotos.size === 0) {
      toast({
        variant: 'destructive',
        title: 'No photos selected',
        description: 'Please select at least one photo to send.',
      });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-mockup-email', {
        body: {
          jobId,
          photoIds: Array.from(selectedGalleryPhotos),
          customerEmail,
          customerName: customerName || 'Customer',
          message: customMessage || undefined,
          orderNumber: orderNumber || undefined,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send email');

      toast({
        title: 'Mockup sent!',
        description: `Email sent to ${customerEmail}`,
      });
      setIsSendDialogOpen(false);
      setSelectedGalleryPhotos(new Set());
      setCustomMessage('');
    } catch (error) {
      console.error('Error sending mockup:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to send',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSending(false);
    }
  };

  const canSendApproval = customerEmail && jobId && jobGalleryPhotos.length > 0;

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
          {jobGalleryPhotos.length > 0 && (
            <Badge variant="secondary" className="text-xs font-normal">
              {jobGalleryPhotos.length} from job
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* Send for Approval button */}
            {canSendApproval && (
              <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Send className="h-4 w-4 mr-1" />
                    Send for Approval
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Mockup for Approval</DialogTitle>
                    <DialogDescription>
                      Select photos and send them to {customerName || 'the customer'} at {customerEmail}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Select photos to send</Label>
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                        {jobGalleryPhotos.map((photo) => (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => toggleGalleryPhoto(photo.id)}
                            className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                              selectedGalleryPhotos.has(photo.id)
                                ? 'border-primary'
                                : 'border-transparent'
                            }`}
                          >
                            <img
                              src={photo.url}
                              alt={photo.filename}
                              className="w-full h-full object-cover"
                            />
                            {selectedGalleryPhotos.has(photo.id) && (
                              <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedGalleryPhotos.size} photo{selectedGalleryPhotos.size !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="prod-message">Custom message (optional)</Label>
                      <Textarea
                        id="prod-message"
                        placeholder="Please review the attached mockup(s) for your upcoming order."
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsSendDialogOpen(false)}
                      disabled={isSending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendApproval}
                      disabled={isSending || selectedGalleryPhotos.size === 0}
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Email
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {cloudUpload && (
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Cloud className="h-3 w-3" />
                Cloud sync
              </span>
            )}
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tap camera to take photos directly
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing job photos gallery */}
        {jobGalleryPhotos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              Job Photos
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {jobGalleryPhotos.map((photo) => (
                <div key={photo.id} className="relative aspect-square rounded-md overflow-hidden border border-border">
                  <img
                    src={photo.url}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                  />
                  {photo.description && (
                    <div className="absolute bottom-0 inset-x-0 bg-background/80 px-1 py-0.5">
                      <p className="text-[10px] text-foreground truncate">{photo.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Capture slots */}
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
                    {photo.stored ? (
                      <div className="absolute bottom-2 left-2 p-1 bg-green-500/90 text-white rounded-full">
                        <Cloud className="h-3 w-3" />
                      </div>
                    ) : cloudUpload && (
                      <div className="absolute bottom-2 left-2 p-1 bg-muted/90 text-muted-foreground rounded-full">
                        <CloudOff className="h-3 w-3" />
                      </div>
                    )}
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
