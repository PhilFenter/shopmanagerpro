import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHandoffs, JobHandoff } from '@/hooks/useHandoffs';
import { useJobs } from '@/hooks/useJobs';
import { HANDOFF_DEPTS, DEPT_EMOJI, DEPT_LABEL, HandoffDept } from '@/lib/handoff-constants';
import { HandoffDetailSheet } from '@/components/handoffs/HandoffDetailSheet';
import { ArrowRight, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Handoffs() {
  const { handoffs, isLoading } = useHandoffs();
  const { jobs } = useJobs();
  const [selected, setSelected] = useState<JobHandoff | null>(null);
  const [tab, setTab] = useState<HandoffDept | 'all'>('all');

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    HANDOFF_DEPTS.forEach(d => (map[d.value] = 0));
    handoffs.forEach(h => {
      if (h.status === 'completed') return;
      map[h.to_dept] = (map[h.to_dept] ?? 0) + 1;
      map.all += 1;
    });
    return map;
  }, [handoffs]);

  const filtered = useMemo(() => {
    if (tab === 'all') return handoffs;
    return handoffs.filter(h => h.to_dept === tab);
  }, [handoffs, tab]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Inbox className="h-6 w-6" /> Department Handoffs
        </h1>
        <p className="text-sm text-muted-foreground">
          Inboxes for inter-department job communication.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all" className="gap-2">
            All
            {counts.all > 0 && <Badge variant="secondary">{counts.all}</Badge>}
          </TabsTrigger>
          {HANDOFF_DEPTS.map(d => (
            <TabsTrigger key={d.value} value={d.value} className="gap-2">
              <span>{d.emoji}</span>
              {d.label}
              {counts[d.value] > 0 && <Badge variant="secondary">{counts[d.value]}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No handoffs in this inbox.</p>
            </Card>
          )}
          {filtered.map(h => {
            const job = jobs.find(j => j.id === h.job_id);
            return (
              <Card
                key={h.id}
                onClick={() => setSelected(h)}
                className={cn(
                  'p-3 cursor-pointer hover:bg-accent transition-colors',
                  h.status === 'pending' && 'border-l-4 border-l-primary',
                  h.status === 'completed' && 'opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>{DEPT_EMOJI[h.from_dept]} {DEPT_LABEL[h.from_dept]}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-medium text-foreground">
                        {DEPT_EMOJI[h.to_dept]} {DEPT_LABEL[h.to_dept]}
                      </span>
                      {h.priority !== 'normal' && (
                        <Badge variant={h.priority === 'urgent' ? 'destructive' : 'default'} className="text-[10px]">
                          {h.priority}
                        </Badge>
                      )}
                      <span className="ml-auto">
                        {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">
                      {job ? `${job.order_number ?? 'Job'} · ${job.customer_name}` : 'Job'}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{h.message}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">{h.status}</Badge>
                </div>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      <HandoffDetailSheet handoff={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
