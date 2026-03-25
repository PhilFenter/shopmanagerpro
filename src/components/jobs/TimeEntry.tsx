import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle } from 'lucide-react';
import { Job, useJobs } from '@/hooks/useJobs';

interface TimeEntryProps {
  job: Job;
  compact?: boolean;
}

export function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

export function TimeEntry({ job, compact = false }: TimeEntryProps) {
  const { updateJob, completeJob } = useJobs();
  const currentMinutes = job.time_tracked;
  const [hours, setHours] = useState(String(Math.floor(currentMinutes / 60)));
  const [minutes, setMinutes] = useState(String(currentMinutes % 60));

  const handleSaveTime = async () => {
    const totalMinutes = (hours * 60) + minutes;
    await updateJob.mutateAsync({
      id: job.id,
      time_tracked: totalMinutes,
    });
  };

  const handleComplete = async () => {
    const totalMinutes = (hours * 60) + minutes;
    await updateJob.mutateAsync({
      id: job.id,
      time_tracked: totalMinutes,
    });
    await completeJob.mutateAsync({ ...job, time_tracked: totalMinutes });
  };

  if (job.status === 'completed') {
    return (
      <div className="flex items-center gap-2 text-primary">
        <CheckCircle className="h-5 w-5" />
        <span className="font-medium">
          Completed • {formatTime(job.time_tracked)}
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">
          {job.time_tracked > 0 ? formatTime(job.time_tracked) : '—'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 rounded-lg bg-muted/50">
      <div>
        <Label className="text-sm font-medium mb-2 block">Time Spent</Label>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={999}
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value) || 0)}
              className="w-16 text-center"
            />
            <span className="text-sm text-muted-foreground">hrs</span>
          </div>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(Math.min(59, parseInt(e.target.value) || 0))}
              className="w-16 text-center"
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleSaveTime}
          disabled={updateJob.isPending}
          className="flex-1"
        >
          Save Time
        </Button>
        <Button
          onClick={handleComplete}
          disabled={completeJob.isPending || updateJob.isPending}
          className="flex-1"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Complete Job
        </Button>
      </div>
    </div>
  );
}
