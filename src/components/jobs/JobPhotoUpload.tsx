import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Upload, Loader2, Trash2, Send, Check } from 'lucide-react';
import { useJobPhotos, JobPhoto } from '@/hooks/useJobPhotos';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
import { Label } from '@/components/ui/label';

interface JobPhotoUploadProps {
  jobId: string;
  customerEmail?: string | null;
  customerName?: string;
  orderNumber?: string | null;
}

export function JobPhotoUpload({ jobId, customerEmail, customerName, orderNumber }: JobPhotoUploadProps) {
  const { photos, isLoading, uploadPhoto, deletePhoto } = useJobPhotos(jobId);
  const { role } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      await uploadPhoto.mutateAsync({ jobId, file });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleDelete = (photoId: string, storagePath: string) => {
    deletePhoto.mutate({ id: photoId, storagePath, jobId });
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      next.delete(photoId);
      return next;
    });
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const handleSendApproval = async () => {
    if (!customerEmail) {
      toast({
        variant: 'destructive',
        title: 'No email address',
        description: 'This customer does not have an email address on file.',
      });
      return;
    }

    if (selectedPhotos.size === 0) {
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
          photoIds: Array.from(selectedPhotos),
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
      setSelectedPhotos(new Set());
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

  const canSendApproval = customerEmail && photos.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Photos</h4>
        <div className="flex gap-2">
          {/* Send for Approval button */}
          {canSendApproval && (
            <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Send className="h-4 w-4 mr-1" />
                  Send
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
                  {/* Photo selection */}
                  <div className="space-y-2">
                    <Label>Select photos to send</Label>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {photos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => togglePhotoSelection(photo.id)}
                          className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                            selectedPhotos.has(photo.id)
                              ? 'border-primary'
                              : 'border-transparent'
                          }`}
                        >
                          <img
                            src={photo.url}
                            alt={photo.filename}
                            className="w-full h-full object-cover"
                          />
                          {selectedPhotos.has(photo.id) && (
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedPhotos.size} photo{selectedPhotos.size !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                  
                  {/* Custom message */}
                  <div className="space-y-2">
                    <Label htmlFor="message">Custom message (optional)</Label>
                    <Textarea
                      id="message"
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
                    disabled={isSending || selectedPhotos.size === 0}
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
          
          {/* Camera button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploadPhoto.isPending}
          >
            <Camera className="h-4 w-4" />
          </Button>
          
          {/* File upload button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadPhoto.isPending}
          >
            {uploadPhoto.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Photo Grid */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No photos yet. Tap camera or upload to add.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <Dialog key={photo.id}>
              <DialogTrigger asChild>
                <button
                  className="relative aspect-square rounded-md overflow-hidden bg-muted group focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <img
                    src={photo.url}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                  />
                  {role === 'admin' && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(photo.id, photo.storage_path);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl p-0 overflow-hidden">
                <img
                  src={photo.url}
                  alt={photo.filename}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
              </DialogContent>
            </Dialog>
          ))}
        </div>
      )}
    </div>
  );
}
