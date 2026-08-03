import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import type { RosterMember } from '@/hooks/useRoster';
import type { Shift } from '@/hooks/useShifts';
import { atMinutes, editorTimeOptions, minutesFromMidnight } from '@/lib/schedule';

interface ShiftEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing shift to edit, or null to create a new one. */
  shift: Shift | null;
  /** Day the new shift lands on. Ignored when editing. */
  day: Date;
  roster: RosterMember[];
  /** Managers and admins may schedule for someone other than themselves. */
  canPickWorker: boolean;
  defaultWorkerId: string | null;
  onSave: (values: { workerId: string; startsAt: Date; endsAt: Date; note: string | null }) => void;
  onDelete?: (id: string) => void;
  isSaving?: boolean;
}

/**
 * Create/edit dialog for a shift.
 *
 * As well as being the way to adjust an existing block, this is the keyboard-
 * and touch-accessible path for *creating* one — dragging across the grid is
 * faster with a mouse but is not reachable by keyboard or comfortable on a
 * phone, and this feature should not be mouse-only.
 */
export function ShiftEditor({
  open, onOpenChange, shift, day, roster, canPickWorker, defaultWorkerId,
  onSave, onDelete, isSaving,
}: ShiftEditorProps) {
  const timeOptions = editorTimeOptions();
  const [workerId, setWorkerId] = useState<string>('');
  const [start, setStart] = useState<number>(8 * 60);
  const [end, setEnd] = useState<number>(16 * 60);
  const [note, setNote] = useState('');

  // Re-seed whenever the dialog opens, since it stays mounted between uses.
  useEffect(() => {
    if (!open) return;
    if (shift) {
      setWorkerId(shift.worker_id);
      setStart(minutesFromMidnight(new Date(shift.starts_at)));
      setEnd(minutesFromMidnight(new Date(shift.ends_at)));
      setNote(shift.note ?? '');
    } else {
      setWorkerId(defaultWorkerId ?? '');
      setStart(8 * 60);
      setEnd(16 * 60);
      setNote('');
    }
  }, [open, shift, defaultWorkerId]);

  const targetDay = shift ? new Date(shift.starts_at) : day;
  const invalidRange = end <= start;
  const canSave = !!workerId && !invalidRange && !isSaving;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      workerId,
      startsAt: atMinutes(targetDay, start),
      endsAt: atMinutes(targetDay, end),
      note: note.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{shift ? 'Edit shift' : 'Add shift'}</DialogTitle>
          <DialogDescription>{format(targetDay, 'EEEE, MMMM d')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {canPickWorker && (
            <div className="space-y-2">
              <Label htmlFor="shift-worker">Who</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger id="shift-worker">
                  <SelectValue placeholder="Select a person" />
                </SelectTrigger>
                <SelectContent>
                  {roster.filter((r) => r.is_active).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="shift-start">Start</Label>
              <Select value={String(start)} onValueChange={(v) => setStart(Number(v))}>
                <SelectTrigger id="shift-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {timeOptions.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-end">End</Label>
              <Select value={String(end)} onValueChange={(v) => setEnd(Number(v))}>
                <SelectTrigger id="shift-end"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {timeOptions.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {invalidRange && (
            <p className="text-sm text-destructive">End time must be after the start time.</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="shift-note">Note (optional)</Label>
            <Input
              id="shift-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Embroidery, front counter…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {shift && onDelete ? (
            <Button variant="ghost" className="text-destructive" onClick={() => onDelete(shift.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {shift ? 'Save' : 'Add shift'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
