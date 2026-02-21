import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useJobs } from '@/hooks/useJobs';

interface DueDatePickerProps {
  jobId: string;
  dueDate: string | null;
  compact?: boolean;
}

export function DueDatePicker({ jobId, dueDate, compact }: DueDatePickerProps) {
  const [open, setOpen] = useState(false);
  const { updateJob } = useJobs();
  const current = dueDate ? new Date(dueDate) : undefined;

  const handleSelect = (date: Date | undefined) => {
    updateJob.mutate({
      id: jobId,
      due_date: date ? date.toISOString() : null,
    } as any);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto p-0 font-normal hover:underline",
            compact ? "text-[10px]" : "text-xs",
            !dueDate && "text-muted-foreground"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <CalendarIcon className={cn("mr-1", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          {dueDate ? `Due ${format(new Date(dueDate), 'MMM d, yyyy')}` : 'Set due date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Calendar
          mode="single"
          selected={current}
          onSelect={handleSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {dueDate && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(undefined);
              }}
            >
              Clear due date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
