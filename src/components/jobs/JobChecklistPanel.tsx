import { useState } from 'react';
import { useJobChecklists, ChecklistItem } from '@/hooks/useJobChecklists';
import { useChecklistTemplates } from '@/hooks/useKnowledge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ClipboardList, Plus, ChevronDown, CheckCircle2, Trash2, ArrowUp, ArrowDown, PlusCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ServiceType } from '@/hooks/useJobs';

// Map service types to departments for auto-suggest
const SERVICE_DEPT_MAP: Record<string, string[]> = {
  embroidery: ['Embroidery'],
  screen_print: ['Screen Print'],
  dtf: ['DTF'],
  leather_patch: ['Leather'],
  laser_engraving: ['Leather'],
};

interface JobChecklistPanelProps {
  jobId: string;
  serviceType?: ServiceType;
}

export function JobChecklistPanel({ jobId, serviceType }: JobChecklistPanelProps) {
  const { checklists, attachChecklist, updateChecklist, removeChecklist } = useJobChecklists(jobId);
  const { templates } = useChecklistTemplates();
  const [attachOpen, setAttachOpen] = useState(false);

  const handleToggleItem = (checklist: typeof checklists[0], idx: number) => {
    const updatedItems = checklist.items.map((it, i) =>
      i === idx ? { ...it, done: !it.done } : it
    );
    const allDone = updatedItems.every(it => it.done);
    updateChecklist.mutate({
      id: checklist.id,
      items: updatedItems,
      status: allDone ? 'completed' : 'in_progress',
      completed_at: allDone ? new Date().toISOString() : null,
    });
  };

  const handleMoveItem = (checklist: typeof checklists[0], idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= checklist.items.length) return;
    const next = [...checklist.items];
    [next[idx], next[to]] = [next[to], next[idx]];
    updateChecklist.mutate({ id: checklist.id, items: next });
  };

  const handleInsertItem = (checklist: typeof checklists[0], afterIdx: number) => {
    const next = [...checklist.items];
    next.splice(afterIdx + 1, 0, { text: '', required: false, done: false });
    updateChecklist.mutate({ id: checklist.id, items: next });
    setEditingItem({ checklistId: checklist.id, idx: afterIdx + 1 });
  };

  const handleUpdateItemText = (checklist: typeof checklists[0], idx: number, text: string) => {
    const next = checklist.items.map((it, i) => i === idx ? { ...it, text } : it);
    updateChecklist.mutate({ id: checklist.id, items: next });
    setEditingItem(null);
  };

  const handleDeleteItem = (checklist: typeof checklists[0], idx: number) => {
    const next = checklist.items.filter((_, i) => i !== idx);
    const allDone = next.length > 0 && next.every(it => it.done);
    updateChecklist.mutate({
      id: checklist.id,
      items: next,
      status: allDone ? 'completed' : 'in_progress',
      completed_at: allDone ? new Date().toISOString() : null,
    });
  };

  const [editingItem, setEditingItem] = useState<{ checklistId: string; idx: number } | null>(null);
  const [editText, setEditText] = useState('');

  const handleAttach = (template: { id: string; title: string; items: { text: string; required: boolean }[] }) => {
    attachChecklist.mutate({
      templateId: template.id,
      templateTitle: template.title,
      items: template.items,
    });
    setAttachOpen(false);
  };

  // Sort: suggested (matching department) first
  const suggestedDepts = serviceType ? SERVICE_DEPT_MAP[serviceType] ?? [] : [];
  const sortedTemplates = [...templates].sort((a, b) => {
    const aMatch = suggestedDepts.includes(a.department ?? '') ? 0 : 1;
    const bMatch = suggestedDepts.includes(b.department ?? '') ? 0 : 1;
    return aMatch - bMatch;
  });

  // Already attached template IDs
  const attachedTemplateIds = new Set(checklists.map(cl => cl.template_id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <ClipboardList className="h-4 w-4" />
          Checklists
        </h4>
        <Button variant="outline" size="sm" onClick={() => setAttachOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Attach
        </Button>
      </div>

      {checklists.length === 0 ? (
        <p className="text-sm text-muted-foreground">No checklists attached to this job.</p>
      ) : (
        <div className="space-y-2">
          {checklists.map(cl => {
            const done = cl.items.filter(it => it.done).length;
            const total = cl.items.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const isComplete = cl.status === 'completed';

            return (
              <Collapsible key={cl.id} defaultOpen={!isComplete}>
                <div className="border rounded-lg overflow-hidden">
                  <CollapsibleTrigger className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left">
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium flex-1 truncate">{cl.title}</span>
                    <Badge variant={isComplete ? 'default' : 'secondary'} className="text-xs">
                      {done}/{total}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-2">
                      <Progress value={pct} className="h-1.5" />
                      <div className="space-y-1.5">
                        <TooltipProvider delayDuration={200}>
                        {cl.items.map((item, idx) => {
                          const isEditing = editingItem?.checklistId === cl.id && editingItem?.idx === idx;
                          return (
                            <div key={idx} className="flex items-center gap-1 group">
                              <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-4 w-4" disabled={idx === 0} onClick={() => handleMoveItem(cl, idx, -1)}>
                                      <ArrowUp className="h-2.5 w-2.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">Move up</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-4 w-4" disabled={idx === cl.items.length - 1} onClick={() => handleMoveItem(cl, idx, 1)}>
                                      <ArrowDown className="h-2.5 w-2.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">Move down</TooltipContent>
                                </Tooltip>
                              </div>
                              <Checkbox
                                checked={item.done}
                                onCheckedChange={() => handleToggleItem(cl, idx)}
                                className="mt-0.5"
                              />
                              {isEditing ? (
                                <Input
                                  autoFocus
                                  className="flex-1 h-7 text-sm"
                                  defaultValue={item.text}
                                  onBlur={e => handleUpdateItemText(cl, idx, e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleUpdateItemText(cl, idx, (e.target as HTMLInputElement).value);
                                    if (e.key === 'Escape') setEditingItem(null);
                                  }}
                                />
                              ) : (
                                <span
                                  className={`text-sm flex-1 cursor-text ${item.done ? 'line-through text-muted-foreground' : ''}`}
                                  onClick={() => { setEditingItem({ checklistId: cl.id, idx }); setEditText(item.text); }}
                                >
                                  {item.text || <span className="text-muted-foreground italic">Empty item</span>}
                                  {item.required && <span className="text-destructive ml-1">*</span>}
                                </span>
                              )}
                              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleInsertItem(cl, idx)}>
                                      <PlusCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Insert below</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeleteItem(cl, idx)}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove item</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          );
                        })}
                        </TooltipProvider>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 text-xs"
                        onClick={() => removeChecklist.mutate(cl.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Attach Dialog */}
      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Checklist</DialogTitle>
            <DialogDescription>Choose a checklist template to attach to this job.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {sortedTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No checklist templates yet. Create them in the Knowledge module.
              </p>
            ) : (
              sortedTemplates.map(t => {
                const isSuggested = suggestedDepts.includes(t.department ?? '');
                const alreadyAttached = attachedTemplateIds.has(t.id);
                return (
                  <button
                    key={t.id}
                    disabled={alreadyAttached}
                    onClick={() => handleAttach(t)}
                    className="w-full text-left px-3 py-2 rounded-md border hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium flex-1">{t.title}</span>
                      {isSuggested && (
                        <Badge variant="secondary" className="text-xs">Suggested</Badge>
                      )}
                      {alreadyAttached && (
                        <Badge variant="outline" className="text-xs">Attached</Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.items.length} items · {t.department ?? 'General'} · {t.category}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
