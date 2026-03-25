import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, User, Plus } from 'lucide-react';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useWorkers } from '@/hooks/useWorkers';
import { useJobs } from '@/hooks/useJobs';

interface TimeEntryFormProps {
  jobId: string;
  onSuccess?: () => void;
}

export function TimeEntryForm({ jobId, onSuccess }: TimeEntryFormProps) {
  const { activeWorkers, isLoading: loadingTeam } = useWorkers();
  const { createTimeEntry } = useTimeEntries(jobId);
  const { updateJob } = useJobs();
  
  const [workerId, setWorkerId] = useState<string>('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workerId) return;
    
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const totalMinutes = (h * 60) + m;
    if (totalMinutes <= 0) return;
    
    await createTimeEntry.mutateAsync({
      job_id: jobId,
      worker_id: workerId,
      duration: totalMinutes,
      notes: notes || undefined,
    });
    
    // Reset form
    setHours('0');
    setMinutes('0');
    setNotes('');
    onSuccess?.();
  };

  if (loadingTeam) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock className="h-4 w-4" />
        Log Time
      </div>

      <div className="space-y-3">
        {/* Worker Selection */}
        <div>
          <Label className="text-sm">Who did the work?</Label>
          <Select value={workerId} onValueChange={setWorkerId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent>
              {activeWorkers.map((worker) => (
                <SelectItem key={worker.id} value={worker.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    {worker.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Time Input */}
        <div>
          <Label className="text-sm">Time Spent</Label>
          <div className="flex items-center gap-2 mt-1">
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

        {/* Notes */}
        <div>
          <Label className="text-sm">Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was done..."
            className="mt-1 resize-none"
            rows={2}
          />
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full"
        disabled={!workerId || (hours === 0 && minutes === 0) || createTimeEntry.isPending}
      >
        {createTimeEntry.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        Log Time
      </Button>
    </form>
  );
}
