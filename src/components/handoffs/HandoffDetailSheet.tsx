import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import { JobHandoff, useHandoffComments, useHandoffs } from '@/hooks/useHandoffs';
import { DEPT_EMOJI, DEPT_LABEL } from '@/lib/handoff-constants';
import { useJobs } from '@/hooks/useJobs';
import { ArrowRight, CheckCircle2, Clock, ExternalLink, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  handoff: JobHandoff | null;
  onClose: () => void;
}

export function HandoffDetailSheet({ handoff, onClose }: Props) {
  const { jobs } = useJobs();
  const { updateStatus, deleteHandoff } = useHandoffs();
  const { comments, addComment } = useHandoffComments(handoff?.id ?? null);
  const [reply, setReply] = useState('');
  const { role } = useAuth();

  if (!handoff) return null;
  const job = jobs.find(j => j.id === handoff.job_id);

  const send = async () => {
    if (!reply.trim()) return;
    await addComment.mutateAsync(reply.trim());
    setReply('');
  };

  const priorityColor =
    handoff.priority === 'urgent' ? 'destructive' :
    handoff.priority === 'high' ? 'default' : 'secondary';

  return (
    <Sheet open={!!handoff} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            {DEPT_EMOJI[handoff.from_dept]} {DEPT_LABEL[handoff.from_dept]}
            <ArrowRight className="h-4 w-4" />
            {DEPT_EMOJI[handoff.to_dept]} {DEPT_LABEL[handoff.to_dept]}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={priorityColor as any}>{handoff.priority}</Badge>
            <Badge variant="outline">{handoff.status}</Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(handoff.created_at), { addSuffix: true })}
            </span>
          </div>

          {job && (
            <Link to={`/jobs/${job.id}`} className="block rounded-lg border p-3 hover:bg-accent">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ExternalLink className="h-3.5 w-3.5" />
                {job.order_number ?? 'Job'} · {job.customer_name}
              </div>
              {job.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{job.description}</p>
              )}
            </Link>
          )}

          <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
            {handoff.message}
          </div>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-2 py-2">
            {comments.map(c => (
              <div key={c.id} className="rounded-md border p-2 text-sm">
                <p className="whitespace-pre-wrap">{c.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No replies yet.</p>
            )}
          </div>
        </ScrollArea>

        <div className="space-y-2 border-t pt-3">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply..."
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={send} disabled={!reply.trim()}>Reply</Button>
            {handoff.status === 'pending' && (
              <Button size="sm" variant="secondary"
                onClick={() => updateStatus.mutate({ id: handoff.id, status: 'acknowledged' })}>
                <Clock className="h-4 w-4 mr-1" /> Acknowledge
              </Button>
            )}
            {handoff.status !== 'completed' && (
              <Button size="sm" variant="default"
                onClick={() => { updateStatus.mutate({ id: handoff.id, status: 'completed' }); onClose(); }}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Done
              </Button>
            )}
            {role === 'admin' && (
              <Button size="sm" variant="ghost" className="ml-auto"
                onClick={() => { deleteHandoff.mutate(handoff.id); onClose(); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
