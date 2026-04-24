import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HANDOFF_DEPTS, HandoffDept } from '@/lib/handoff-constants';
import { useHandoffs } from '@/hooks/useHandoffs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobLabel?: string;
  defaultFromDept?: HandoffDept;
}

export function HandoffDialog({ open, onOpenChange, jobId, jobLabel, defaultFromDept }: Props) {
  const { createHandoff } = useHandoffs();
  const [fromDept, setFromDept] = useState<HandoffDept>(defaultFromDept ?? 'production');
  const [toDept, setToDept] = useState<HandoffDept>('embroidery');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normal');

  const handleSubmit = async () => {
    if (!message.trim()) return;
    await createHandoff.mutateAsync({
      job_id: jobId,
      from_dept: fromDept,
      to_dept: toDept,
      message: message.trim(),
      priority,
    });
    setMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hand off job{jobLabel ? ` · ${jobLabel}` : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From</Label>
              <Select value={fromDept} onValueChange={(v) => setFromDept(v as HandoffDept)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HANDOFF_DEPTS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.emoji} {d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To</Label>
              <Select value={toDept} onValueChange={(v) => setToDept(v as HandoffDept)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HANDOFF_DEPTS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.emoji} {d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What needs to happen next?"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!message.trim() || createHandoff.isPending}>
            Send Handoff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
