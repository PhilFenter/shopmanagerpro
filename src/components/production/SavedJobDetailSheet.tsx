import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RotateCcw, Trash2, Calendar, Camera, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useJobPhotos } from '@/hooks/useJobPhotos';

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
  onLoadForReorder,
  onDelete,
}: SavedJobDetailSheetProps) {
  const { photos, isLoading: photosLoading } = useJobPhotos(open && jobId ? jobId : undefined);

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
