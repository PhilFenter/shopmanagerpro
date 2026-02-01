import { Button } from '@/components/ui/button';
import { Trash2, User, Clock } from 'lucide-react';
import { useTimeEntries, TimeEntry } from '@/hooks/useTimeEntries';
import { formatTime } from './TimeEntry';

interface TimeEntriesListProps {
  jobId: string;
}

export function TimeEntriesList({ jobId }: TimeEntriesListProps) {
  const { timeEntries, totalMinutes, deleteTimeEntry } = useTimeEntries(jobId);

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
            onDelete={() => deleteTimeEntry.mutate({ id: entry.id, jobId })}
            isDeleting={deleteTimeEntry.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function TimeEntryRow({ 
  entry, 
  onDelete,
  isDeleting 
}: { 
  entry: TimeEntry; 
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{entry.worker?.name || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono">{formatTime(entry.duration || 0)}</span>
        </div>
        {entry.notes && (
          <span className="text-muted-foreground truncate max-w-[150px]">
            — {entry.notes}
          </span>
        )}
      </div>
      
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
  );
}
