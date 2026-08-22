import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RotateCcw, Trash2, Calendar, Camera, Loader2, FileDown, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { useJobPhotos } from '@/hooks/useJobPhotos';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadRecipePdf, recipePdfBlob, recipePdfFilename } from '@/lib/recipePdf';


interface DetailField {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}

interface DetailSection {
  title: string;
  fields: DetailField[];
}

interface SavedJobDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string | null;
  badges?: { label: string; variant?: 'default' | 'secondary' | 'outline' | 'destructive' }[];
  sections: DetailSection[];
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  rating?: number | null;
  /** Job ID to fetch and display associated photos */
  jobId?: string | null;
  /** Human label for the process, e.g. "Screen Print" — used on the exported PDF */
  processLabel?: string;
  onLoadForReorder: () => void;
  onDelete: () => void;
}

export function SavedJobDetailSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  badges,
  sections,
  notes,
  createdAt,
  updatedAt,
  rating,
  jobId,
  processLabel,
  onLoadForReorder,
  onDelete,
}: SavedJobDetailSheetProps) {
  const { photos, isLoading: photosLoading } = useJobPhotos(open && jobId ? jobId : undefined);
  const [pushing, setPushing] = useState(false);

  const pdfInput = {
    title,
    subtitle,
    badges: badges?.map((b) => b.label),
    sections: sections.map((s) => ({
      title: s.title,
      fields: s.fields.map((f) => ({ label: f.label, value: f.value })),
    })),
    notes,
    updatedAt,
    processLabel,
  };

  const handleDownload = () => {
    try {
      downloadRecipePdf(pdfInput);
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the PDF');
    }
  };

  const handlePushToPrintavo = async () => {
    if (!jobId) return;
    setPushing(true);
    try {
      const blob = recipePdfBlob(pdfInput);
      const path = `${jobId}/${Date.now()}-${recipePdfFilename(pdfInput)}`;

      const { error: uploadError } = await supabase.storage
        .from('production-files')
        .upload(path, blob, { contentType: 'application/pdf', upsert: true });
      if (uploadError) throw uploadError;

      // Printavo fetches the file from this URL, so it needs to be reachable
      // without a session for a short window.
      const { data: signed, error: signError } = await supabase.storage
        .from('production-files')
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      if (signError || !signed?.signedUrl) throw signError || new Error('Could not create file link');

      const { data, error } = await supabase.functions.invoke('push-production-file', {
        body: { jobId, fileUrl: signed.signedUrl },
      });

      if (error) {
        const details = (error as any)?.context
          ? await (error as any).context.text()
          : error.message;
        let msg = details;
        try {
          msg = JSON.parse(details)?.error || details;
        } catch { /* keep raw */ }
        throw new Error(msg);
      }

      toast.success(`Added to Printavo order ${data?.printavoOrder ?? ''}`.trim());
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send to Printavo');
    } finally {
      setPushing(false);
    }
  };


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          {badges && badges.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {badges.map((b, i) => (
                <Badge key={i} variant={b.variant || 'outline'}>{b.label}</Badge>
              ))}
            </div>
          )}
          <SheetTitle className="text-left">{title}</SheetTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {rating != null && rating > 0 && (
            <div className="text-primary text-sm">
              {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
            </div>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Photos Section */}
          {jobId && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Photos
              </h4>
              {photosLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-md overflow-hidden border">
                      <img
                        src={photo.url}
                        alt={photo.description || photo.filename}
                        className="w-full h-full object-cover"
                      />
                      {photo.description && (
                        <div className="absolute bottom-0 inset-x-0 bg-background/80 text-xs px-1 py-0.5 truncate">
                          {photo.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No photos for this job.</p>
              )}
            </div>
          )}

          {sections.map((section, si) => (
            <div key={si}>
              <h4 className="text-sm font-medium mb-2">{section.title}</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {section.fields.map((field, fi) => (
                  <div key={fi}>
                    <span className="text-muted-foreground">{field.label}:</span>{' '}
                    <span className={field.mono ? 'font-mono' : 'font-medium'}>
                      {field.value ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {notes && (
            <div>
              <h4 className="text-sm font-medium mb-1">Notes</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {(createdAt || updatedAt) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {updatedAt && <span>Updated {format(new Date(updatedAt), 'MMM d, yyyy h:mm a')}</span>}
              {createdAt && !updatedAt && <span>Created {format(new Date(createdAt), 'MMM d, yyyy')}</span>}
            </div>
          )}

          <Separator />

          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => { onLoadForReorder(); onOpenChange(false); }}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Load for Reorder
            </Button>
            <Button variant="destructive" size="icon" onClick={() => { onDelete(); onOpenChange(false); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
