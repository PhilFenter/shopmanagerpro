import { useState } from 'react';
import { useJobChecklists, ChecklistItem } from '@/hooks/useJobChecklists';
import { useChecklistTemplates } from '@/hooks/useKnowledge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ClipboardList, Plus, ChevronDown, CheckCircle2, Trash2 } from 'lucide-react';
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
                        {cl.items.map((item, idx) => (
                          <label
                            key={idx}
                            className="flex items-start gap-2 cursor-pointer group"
                          >
                            <Checkbox
                              checked={item.done}
                              onCheckedChange={() => handleToggleItem(cl, idx)}
                              className="mt-0.5"
                            />
                            <span className={`text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>
                              {item.text}
                              {item.required && <span className="text-destructive ml-1">*</span>}
                            </span>
                          </label>
                        ))}
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
