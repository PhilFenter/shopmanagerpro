import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, User, Clock, Pencil, Check, X } from 'lucide-react';
import { useTimeEntries, TimeEntry } from '@/hooks/useTimeEntries';
import { useWorkers } from '@/hooks/useWorkers';
import { formatTime } from './TimeEntry';

interface TimeEntriesListProps {
  jobId: string;
}

export function TimeEntriesList({ jobId }: TimeEntriesListProps) {
  const { timeEntries, totalMinutes, deleteTimeEntry, updateTimeEntry } = useTimeEntries(jobId);

  if (timeEntries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No time entries yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Time Entries</span>
        <span className="text-sm text-muted-foreground">
          Total: {formatTime(totalMinutes)}
        </span>
      </div>
      
      <div className="space-y-2">
        {timeEntries.map((entry) => (
          <TimeEntryRow 
            key={entry.id} 
            entry={entry}
            jobId={jobId}
            onDelete={() => deleteTimeEntry.mutate({ id: entry.id, jobId })}
            isDeleting={deleteTimeEntry.isPending}
            onUpdate={updateTimeEntry}
          />
        ))}
      </div>
    </div>
  );
}

function TimeEntryRow({ 
  entry, 
  jobId,
  onDelete,
  isDeleting,
  onUpdate,
}: { 
  entry: TimeEntry; 
  jobId: string;
  onDelete: () => void;
  isDeleting: boolean;
  onUpdate: ReturnType<typeof useTimeEntries>['updateTimeEntry'];
}) {
  const [editing, setEditing] = useState(false);
  const { activeWorkers } = useWorkers();
  const [workerId, setWorkerId] = useState(entry.worker_id || '');
  const [hours, setHours] = useState(String(Math.floor((entry.duration || 0) / 60)));
  const [minutes, setMinutes] = useState(String((entry.duration || 0) % 60));
  const [notes, setNotes] = useState(entry.notes || '');

  const handleSave = async () => {
    const totalMinutes = ((parseInt(hours) || 0) * 60) + (parseInt(minutes) || 0);
    if (totalMinutes <= 0) return;

    await onUpdate.mutateAsync({
      id: entry.id,
      jobId,
      worker_id: workerId || undefined,
      duration: totalMinutes,
      notes: notes.trim() || null,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setWorkerId(entry.worker_id || '');
    setHours(String(Math.floor((entry.duration || 0) / 60)));
    setMinutes(String((entry.duration || 0) % 60));
    setNotes(entry.notes || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="p-3 rounded-lg border bg-card space-y-3">
        {/* Worker */}
        <Select value={workerId} onValueChange={setWorkerId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select worker" />
          </SelectTrigger>
          <SelectContent>
            {activeWorkers.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  {w.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Duration */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={999}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-16 h-9 text-center"
            />
            <span className="text-sm text-muted-foreground">hrs</span>
          </div>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-16 h-9 text-center"
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>

        {/* Notes */}
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes..."
          className="h-9"
        />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={onUpdate.isPending}
            className="flex-1 h-9"
          >
            <Check className="mr-1 h-3 w-3" />
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            className="flex-1 h-9"
          >
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-1 text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{entry.worker?.name || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="font-mono">{formatTime(entry.duration || 0)}</span>
        </div>
        {entry.notes && (
          <span className="text-muted-foreground truncate max-w-[150px]">
            — {entry.notes}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  );
}
