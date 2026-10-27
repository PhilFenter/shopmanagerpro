import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function useIsProdManager() {
  const { role } = useAuth();
  return role === 'admin' || role === 'manager';
}

/** Low-res PDF preview. Dark background by default because much of the art is white. */
export function PreviewThumb({
  url, size = 64, dark = true, label, className,
}: { url?: string | null; size?: number; dark?: boolean; label?: string; className?: string }) {
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded border', dark ? 'bg-neutral-800' : 'bg-white', className)}
      style={{ width: size, height: size }}
      title={label ? `${label} — preview only, not production art` : 'Preview only, not production art'}
    >
      {url ? (
        <img src={url} alt={label ?? 'preview'} className="max-h-full max-w-full object-contain" loading="lazy" />
      ) : (
        <ImageOff className={cn('h-4 w-4', dark ? 'text-neutral-400' : 'text-muted-foreground')} aria-label="No preview" />
      )}
    </div>
  );
}

export function ReasonDialog({
  open, onOpenChange, title, description, confirmLabel = 'Save', onConfirm, busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => void;
  busy?: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setReason(''); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!reason.trim() || busy} onClick={() => { onConfirm(reason.trim()); setReason(''); }}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y) return d;
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
