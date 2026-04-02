import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Square, User, Clock } from 'lucide-react';
import { useJobs, Job } from '@/hooks/useJobs';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useWorkers } from '@/hooks/useWorkers';
import { formatTime } from './TimeEntry';

interface JobTimerProps {
  job: Job;
}

export function JobTimer({ job }: JobTimerProps) {
  const { updateJob } = useJobs();
  const { createTimeEntry } = useTimeEntries(job.id);
  const { activeWorkers } = useWorkers();
  const [workerId, setWorkerId] = useState<string>('');
  const [elapsed, setElapsed] = useState(0); // seconds
  const [notes, setNotes] = useState('');
  const [stopping, setStopping] = useState(false);

  const isRunning = !!job.timer_started_at;

  // Live tick while timer is running
  useEffect(() => {
    if (!isRunning || !job.timer_started_at) {
      setElapsed(0);
      return;
    }

    const calc = () => {
      const start = new Date(job.timer_started_at!).getTime();
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [isRunning, job.timer_started_at]);

  const handleStart = useCallback(async () => {
    if (!workerId) return;
    await updateJob.mutateAsync({
      id: job.id,
      timer_started_at: new Date().toISOString(),
    });
  }, [workerId, job.id, updateJob]);

  const handleStop = useCallback(async () => {
    if (!job.timer_started_at || stopping) return;
    setStopping(true);
    try {
      const start = new Date(job.timer_started_at).getTime();
      const elapsedMinutes = Math.max(1, Math.round((Date.now() - start) / 60000));

      // Create time entry for the worker
      if (workerId) {
        await createTimeEntry.mutateAsync({
          job_id: job.id,
          worker_id: workerId,
          duration: elapsedMinutes,
          notes: notes.trim() || undefined,
        });
      }

      // Clear timer and add to tracked time
      await updateJob.mutateAsync({
        id: job.id,
        timer_started_at: null,
        time_tracked: job.time_tracked + elapsedMinutes,
      });
    } finally {
      setStopping(false);
    }
  }, [job, workerId, stopping, createTimeEntry, updateJob]);

  // Format elapsed seconds as HH:MM:SS
  const formatElapsed = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock className="h-4 w-4" />
        Timer
        {job.time_tracked > 0 && (
          <span className="text-muted-foreground ml-auto">
            Total: {formatTime(job.time_tracked)}
          </span>
        )}
      </div>

      {/* Worker select */}
      {!isRunning && (
        <Select value={workerId} onValueChange={setWorkerId}>
          <SelectTrigger>
            <SelectValue placeholder="Who's working?" />
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
      )}

      {/* What are you doing? */}
      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What are you working on?"
        className="h-12 text-base"
      />

      {/* Timer display */}
      {isRunning && (
        <div className="text-center">
          <div className="font-mono text-4xl font-bold tabular-nums text-primary">
            {formatElapsed(elapsed)}
          </div>
          {workerId && (
            <p className="text-sm text-muted-foreground mt-1">
              {activeWorkers.find(w => w.id === workerId)?.name}
            </p>
          )}
        </div>
      )}

      {/* Start / Stop button — large for mobile */}
      {isRunning ? (
        <Button
          onClick={handleStop}
          disabled={stopping}
          variant="destructive"
          className="w-full h-14 text-lg gap-3"
        >
          <Square className="h-6 w-6" />
          {stopping ? 'Saving…' : 'Stop'}
        </Button>
      ) : (
        <Button
          onClick={handleStart}
          disabled={!workerId || updateJob.isPending}
          className="w-full h-14 text-lg gap-3"
        >
          <Play className="h-6 w-6" />
          Start Timer
        </Button>
      )}
    </div>
  );
}
