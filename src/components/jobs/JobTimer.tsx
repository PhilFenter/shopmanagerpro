import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, CheckCircle } from 'lucide-react';
import { Job, useJobs } from '@/hooks/useJobs';
import { cn } from '@/lib/utils';

interface JobTimerProps {
  job: Job;
  compact?: boolean;
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function JobTimer({ job, compact = false }: JobTimerProps) {
  const { startTimer, stopTimer, completeJob } = useJobs();
  const [displayTime, setDisplayTime] = useState(job.time_tracked);
  const isRunning = !!job.timer_started_at;

  useEffect(() => {
    if (!isRunning) {
      setDisplayTime(job.time_tracked);
      return;
    }

    const startTime = new Date(job.timer_started_at!).getTime();
    
    const updateDisplay = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDisplayTime(job.time_tracked + elapsed);
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 1000);
    return () => clearInterval(interval);
  }, [job.timer_started_at, job.time_tracked, isRunning]);

  const handleToggle = async () => {
    if (isRunning) {
      await stopTimer.mutateAsync(job);
    } else {
      await startTimer.mutateAsync(job.id);
    }
  };

  const handleComplete = async () => {
    await completeJob.mutateAsync(job);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={cn(
          "font-mono text-sm",
          isRunning && "text-primary font-bold"
        )}>
          {formatTime(displayTime)}
        </span>
        {job.status !== 'completed' && (
          <Button
            size="icon"
            variant={isRunning ? "default" : "outline"}
            className="h-8 w-8"
            onClick={handleToggle}
            disabled={startTimer.isPending || stopTimer.isPending}
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-muted/50">
      <div className={cn(
        "text-3xl font-mono font-bold",
        isRunning && "text-primary"
      )}>
        {formatTime(displayTime)}
      </div>
      
      <div className="flex gap-2">
        {job.status !== 'completed' ? (
          <>
            <Button
              size="lg"
              variant={isRunning ? "destructive" : "default"}
              onClick={handleToggle}
              disabled={startTimer.isPending || stopTimer.isPending}
              className="min-w-[120px]"
            >
              {isRunning ? (
                <>
                  <Pause className="mr-2 h-5 w-5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Start
                </>
              )}
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              onClick={handleComplete}
              disabled={completeJob.isPending}
            >
              <CheckCircle className="mr-2 h-5 w-5" />
              Complete
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Completed</span>
          </div>
        )}
      </div>
    </div>
  );
}
