import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, CheckCircle2, Circle, Expand, Loader2, Play, Printer, RotateCcw, Shrink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useChecklistInstances, useChecklistTemplates, useSOPs } from '@/hooks/useKnowledge';
import { checklistProgress, toggleChecklistItem, type RunItem } from '@/lib/printCard';
import { cn } from '@/lib/utils';

// Full-screen checklist views for iPads at the stations (no sidebar).
//   /checklists/:id      – the checklist itself: Start / Resume / Print
//   /checklists/run/:id  – a running checklist: big tap targets to tick items off

function useFullscreen() {
  const [isFull, setIsFull] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  const supported = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch {
      // Some browsers refuse; the page already fills the screen without the sidebar.
    }
  };
  return { supported, isFull, toggle };
}

function TopBar({ title, children }: { title: string; children?: React.ReactNode }) {
  const fs = useFullscreen();
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);

  return (
    <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
        <Button variant="ghost" size="lg" className="px-3" asChild>
          <Link to="/knowledge"><ArrowLeft className="mr-1 h-5 w-5" /> Back</Link>
        </Button>
        <div className="flex-1" />
        {children}
        {fs.supported && (
          <Button variant="outline" size="lg" onClick={fs.toggle} title={fs.isFull ? 'Exit full screen' : 'Full screen'}>
            {fs.isFull ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">{children}</div>;
}

function Missing({ what }: { what: string }) {
  return (
    <Centered>
      <p className="text-lg">That {what} wasn't found. It may have been deleted.</p>
      <Button variant="outline" asChild><Link to="/knowledge">Back to Shop Knowledge</Link></Button>
    </Centered>
  );
}

function Spinner() {
  return <Centered><Loader2 className="h-8 w-8 animate-spin text-primary" /></Centered>;
}

// ─── The checklist (template) ───
export function ChecklistView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { templates, isLoading } = useChecklistTemplates();
  const { instances, createInstance } = useChecklistInstances();
  const { sops } = useSOPs();
  const [starting, setStarting] = useState(false);
  const template = templates.find(t => t.id === id);

  if (isLoading) return <Spinner />;
  if (!template) return <Missing what="checklist" />;

  const open = instances.filter(i => i.template_id === template.id && i.status !== 'completed');
  const linkedSop = template.sop_id ? sops.find(s => s.id === template.sop_id) : undefined;

  const start = async () => {
    setStarting(true);
    try {
      const created = await createInstance.mutateAsync({
        template_id: template.id,
        title: template.title,
        items: template.items.map(item => ({ ...item, done: false })),
        status: 'in_progress',
      });
      navigate(`/checklists/run/${(created as { id: string }).id}`);
    } catch (e) {
      toast({ title: "Couldn't start the checklist", description: String((e as Error)?.message ?? e), variant: 'destructive' });
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar title={template.title}>
        <Button variant="outline" size="lg" onClick={() => navigate(`/print/checklist/${template.id}`)}>
          <Printer className="mr-2 h-5 w-5" /> Print
        </Button>
      </TopBar>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div>
          {(template.department || template.category) && (
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {template.department || template.category}
            </p>
          )}
          <h1 className="text-3xl font-bold leading-tight">{template.title}</h1>
          {template.description && <p className="mt-2 text-lg text-muted-foreground">{template.description}</p>}
          {linkedSop && (
            <Button variant="link" className="mt-1 h-auto px-0 text-base" asChild>
              <Link to={`/knowledge?sop=${linkedSop.id}`}><BookOpen className="mr-1.5 h-4 w-4" /> SOP: {linkedSop.title}</Link>
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="h-14 flex-1 text-lg" onClick={start} disabled={starting || template.items.length === 0}>
            {starting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
            Start checklist
          </Button>
        </div>

        {open.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">In progress</p>
            {open.map(inst => {
              const p = checklistProgress(inst.items);
              return (
                <Button
                  key={inst.id}
                  variant="outline"
                  className="h-14 w-full justify-between text-base"
                  onClick={() => navigate(`/checklists/run/${inst.id}`)}
                >
                  <span>Resume · started {new Date(inst.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  <Badge variant="secondary" className="text-sm">{p.done}/{p.total}</Badge>
                </Button>
              );
            })}
          </div>
        )}

        <ol className="divide-y rounded-xl border">
          {template.items.map((item, i) => (
            <li key={i} className="flex items-start gap-4 px-4 py-4">
              <Circle className="mt-0.5 h-7 w-7 shrink-0 text-muted-foreground" />
              <span className={cn('flex-1 text-lg leading-snug', item.required && 'font-semibold')}>{item.text}</span>
              {item.required && <Badge variant="outline">Required</Badge>}
            </li>
          ))}
          {template.items.length === 0 && <li className="p-6 text-center text-muted-foreground">No items yet.</li>}
        </ol>
      </main>
    </div>
  );
}

// ─── A running checklist ───
export function ChecklistRun() {
  const { id = '' } = useParams();
  const { toast } = useToast();
  const { instances, isLoading, updateInstance } = useChecklistInstances();
  const instance = instances.find(i => i.id === id);
  // Local copy so taps feel instant; saved in the background.
  const [items, setItems] = useState<RunItem[] | null>(null);
  const saving = updateInstance.isPending;
  useEffect(() => {
    // Don't overwrite quick taps with a refetch that's still catching up.
    if (instance && !saving) setItems(instance.items as RunItem[]);
  }, [instance, saving]);

  if (isLoading && !instance) return <Spinner />;
  if (!instance || !items) return <Missing what="checklist" />;

  const p = checklistProgress(items);
  const complete = p.total > 0 && p.done === p.total;

  const save = (update: { items: RunItem[]; status: string; completed_at: string | null }) => {
    setItems(update.items);
    updateInstance.mutate(
      { id: instance.id, ...update },
      {
        onError: (e) => {
          setItems(instance.items as RunItem[]);
          toast({ title: "Couldn't save that tick", description: String((e as Error)?.message ?? e), variant: 'destructive' });
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar title={instance.title}>
        {instance.template_id && (
          <Button variant="outline" size="lg" asChild>
            <Link to={`/print/checklist/${instance.template_id}`}><Printer className="mr-2 h-5 w-5" /> Print</Link>
          </Button>
        )}
      </TopBar>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <div>
          <h1 className="text-3xl font-bold leading-tight">{instance.title}</h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-3 rounded-full transition-all', complete ? 'bg-green-600' : 'bg-primary')}
                style={{ width: `${p.percent}%` }}
              />
            </div>
            <span className="text-lg font-semibold tabular-nums">{p.done} of {p.total}</span>
          </div>
        </div>

        {complete && (
          <div className="flex items-center gap-3 rounded-xl border border-green-600/40 bg-green-600/10 p-4 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-7 w-7 shrink-0" />
            <div>
              <p className="text-lg font-bold">Checklist complete</p>
              {instance.completed_at && (
                <p className="text-sm">{new Date(instance.completed_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}

        <ul className="divide-y overflow-hidden rounded-xl border">
          {items.map((item, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={() => save(toggleChecklistItem(items, idx))}
                className={cn(
                  'flex min-h-[4.5rem] w-full items-center gap-4 px-4 py-4 text-left transition-colors active:bg-accent',
                  item.done ? 'bg-muted/40' : 'hover:bg-accent/50',
                )}
              >
                {item.done
                  ? <CheckCircle2 className="h-9 w-9 shrink-0 text-primary" />
                  : <Circle className="h-9 w-9 shrink-0 text-muted-foreground" />}
                <span className={cn(
                  'flex-1 text-xl leading-snug',
                  item.required && 'font-semibold',
                  item.done && 'text-muted-foreground line-through',
                )}>
                  {item.text}
                </span>
                {item.required && !item.done && <Badge variant="outline">Required</Badge>}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex justify-between gap-3 pt-2">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => save({ items: items.map(it => ({ ...it, done: false })), status: 'in_progress', completed_at: null })}
          >
            <RotateCcw className="mr-2 h-5 w-5" /> Reset all
          </Button>
          <Button size="lg" variant={complete ? 'default' : 'outline'} asChild>
            <Link to="/knowledge">{complete ? 'Done' : 'Finish later'}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
