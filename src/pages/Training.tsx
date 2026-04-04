import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSOPs, useSOPSteps, useChecklistTemplates, useTrainingPlans, useTrainingAssignments } from '@/hooks/useKnowledge';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen, CheckSquare, GraduationCap, ChevronRight, CheckCircle2, Circle,
  Lightbulb, AlertTriangle, Trophy, Clock, Play, ArrowLeft, ArrowRight,
  Loader2, Video,
} from 'lucide-react';

// ─── SOP Step-by-Step Reader ───
function SOPReader({
  sopId,
  sopTitle,
  isCompleted,
  onComplete,
  onClose,
}: {
  sopId: string;
  sopTitle: string;
  isCompleted: boolean;
  onComplete: () => void;
  onClose: () => void;
}) {
  const { steps, isLoading } = useSOPSteps(sopId);
  const [currentStep, setCurrentStep] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));

  const step = steps[currentStep];
  const allVisited = steps.length > 0 && visitedSteps.size >= steps.length;

  const goToStep = (idx: number) => {
    setCurrentStep(idx);
    setVisitedSteps(prev => new Set(prev).add(idx));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>This SOP has no steps defined yet.</p>
        <Button variant="outline" className="mt-4" onClick={onClose}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h2 className="font-semibold">{sopTitle}</h2>
            <p className="text-xs text-muted-foreground">Step {currentStep + 1} of {steps.length}</p>
          </div>
        </div>
        {isCompleted && (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
          </Badge>
        )}
      </div>

      {/* Step Progress Dots */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b overflow-x-auto">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => goToStep(i)}
            className={`h-3 w-3 rounded-full shrink-0 transition-all ${
              i === currentStep
                ? 'bg-primary ring-2 ring-primary/30 scale-125'
                : visitedSteps.has(i)
                ? 'bg-primary/50'
                : 'bg-muted-foreground/20'
            }`}
            title={`Step ${i + 1}: ${steps[i].title}`}
          />
        ))}
      </div>

      {/* Step Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto space-y-4">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
              {currentStep + 1}
            </span>
            <div className="flex-1 space-y-3">
              <h3 className="text-xl font-semibold">{step.title}</h3>
              {step.content && (
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{step.content}</p>
              )}
            </div>
          </div>

          {step.image_url && (
            <img
              src={step.image_url}
              alt={step.title}
              className="rounded-lg max-h-80 w-full object-cover border"
            />
          )}

          {step.video_url && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted border">
              <iframe
                src={step.video_url.replace('watch?v=', 'embed/')}
                className="w-full h-full"
                allowFullScreen
              />
            </div>
          )}

          {step.tip && (
            <div className="flex items-start gap-2 bg-primary/10 text-primary rounded-lg p-4 text-sm">
              <Lightbulb className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-0.5">Pro Tip</p>
                <p>{step.tip}</p>
              </div>
            </div>
          )}

          {step.warning && (
            <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-0.5">Warning</p>
                <p>{step.warning}</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Navigation Footer */}
      <div className="border-t p-4 flex items-center justify-between">
        <Button
          variant="outline"
          disabled={currentStep === 0}
          onClick={() => goToStep(currentStep - 1)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Previous
        </Button>

        <span className="text-sm text-muted-foreground">
          {visitedSteps.size}/{steps.length} viewed
        </span>

        {currentStep < steps.length - 1 ? (
          <Button onClick={() => goToStep(currentStep + 1)}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : !isCompleted && allVisited ? (
          <Button onClick={onComplete} className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Complete
          </Button>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Checklist Interactive Runner ───
function ChecklistRunner({
  checklist,
  isCompleted,
  onComplete,
}: {
  checklist: { id: string; title: string; items: { text: string; required: boolean }[] };
  isCompleted: boolean;
  onComplete: () => void;
}) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const allRequired = checklist.items
    .map((item, idx) => ({ ...item, idx }))
    .filter(i => i.required);
  const allRequiredDone = allRequired.every(i => checkedItems.has(i.idx));
  const allDone = checkedItems.size === checklist.items.length;

  const toggle = (idx: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{checklist.title}</p>
        {isCompleted ? (
          <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Done
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            {checkedItems.size}/{checklist.items.length}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {checklist.items.map((item, idx) => (
          <button
            key={idx}
            disabled={isCompleted}
            className="flex items-center gap-2 text-sm w-full text-left hover:bg-accent/50 rounded p-2 transition-colors disabled:opacity-70"
            onClick={() => toggle(idx)}
          >
            {checkedItems.has(idx) || isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className={checkedItems.has(idx) || isCompleted ? 'line-through text-muted-foreground' : ''}>
              {item.text}
            </span>
            {item.required && !checkedItems.has(idx) && !isCompleted && (
              <Badge variant="outline" className="text-[10px] ml-auto">Required</Badge>
            )}
          </button>
        ))}
      </div>

      {!isCompleted && allRequiredDone && (
        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={onComplete}>
          <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Checklist Complete
        </Button>
      )}
    </div>
  );
}

// ─── Training Plan Detail View ───
function PlanDetail({
  plan,
  assignment,
  sops,
  templates,
  onUpdateAssignment,
}: {
  plan: any;
  assignment: any;
  sops: any[];
  templates: any[];
  onUpdateAssignment: (updates: any) => Promise<void>;
}) {
  const [readingSopId, setReadingSopId] = useState<string | null>(null);
  const { toast } = useToast();

  const linkedSops = sops.filter((s: any) => plan.sop_ids.includes(s.id));
  const linkedChecklists = templates.filter((t: any) => plan.checklist_template_ids.includes(t.id));
  const completedSopIds: string[] = assignment?.completed_sop_ids ?? [];
  const completedChecklistIds: string[] = assignment?.completed_checklist_ids ?? [];

  const totalItems = plan.sop_ids.length + plan.checklist_template_ids.length;
  const doneItems = completedSopIds.length + completedChecklistIds.length;
  const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const readingSop = linkedSops.find((s: any) => s.id === readingSopId);

  const markSopComplete = async (sopId: string) => {
    if (completedSopIds.includes(sopId)) return;
    const newCompletedSops = [...completedSopIds, sopId];
    const newTotal = newCompletedSops.length + completedChecklistIds.length;
    const isFullyComplete = newTotal >= totalItems;

    await onUpdateAssignment({
      completed_sop_ids: newCompletedSops,
      status: isFullyComplete ? 'completed' : 'in_progress',
      started_at: assignment?.started_at || new Date().toISOString(),
      completed_at: isFullyComplete ? new Date().toISOString() : null,
    });
    toast({ title: 'SOP completed! ✓' });
    setReadingSopId(null);
  };

  const markChecklistComplete = async (checklistId: string) => {
    if (completedChecklistIds.includes(checklistId)) return;
    const newCompletedChecklists = [...completedChecklistIds, checklistId];
    const newTotal = completedSopIds.length + newCompletedChecklists.length;
    const isFullyComplete = newTotal >= totalItems;

    await onUpdateAssignment({
      completed_checklist_ids: newCompletedChecklists,
      status: isFullyComplete ? 'completed' : 'in_progress',
      started_at: assignment?.started_at || new Date().toISOString(),
      completed_at: isFullyComplete ? new Date().toISOString() : null,
    });
    toast({ title: 'Checklist completed! ✓' });
  };

  // Full-screen SOP reader
  if (readingSop) {
    return (
      <SOPReader
        sopId={readingSop.id}
        sopTitle={readingSop.title}
        isCompleted={completedSopIds.includes(readingSop.id)}
        onComplete={() => markSopComplete(readingSop.id)}
        onClose={() => setReadingSopId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">{plan.title}</h3>
          {progress === 100 ? (
            <Badge className="bg-green-100 text-green-800 border-green-300">
              <Trophy className="h-3 w-3 mr-1" /> Complete!
            </Badge>
          ) : (
            <Badge variant="secondary">{progress}%</Badge>
          )}
        </div>
        {plan.description && <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>}
        <div className="w-full bg-muted rounded-full h-3">
          <div
            className="bg-primary rounded-full h-3 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{doneItems} of {totalItems} completed</p>
      </div>

      {/* SOPs */}
      {linkedSops.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> SOPs to Read ({completedSopIds.filter(id => plan.sop_ids.includes(id)).length}/{linkedSops.length})
          </h4>
          <div className="space-y-2">
            {linkedSops.map((s: any) => {
              const done = completedSopIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setReadingSopId(s.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  ) : (
                    <Play className="h-5 w-5 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${done ? 'text-muted-foreground line-through' : ''}`}>
                      {s.title}
                    </p>
                    {s.department && <p className="text-xs text-muted-foreground">{s.department}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Checklists */}
      {linkedChecklists.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <CheckSquare className="h-4 w-4" /> Checklists ({completedChecklistIds.filter(id => plan.checklist_template_ids.includes(id)).length}/{linkedChecklists.length})
          </h4>
          <div className="space-y-4">
            {linkedChecklists.map((t: any) => {
              const done = completedChecklistIds.includes(t.id);
              return (
                <div key={t.id} className="border rounded-lg p-4 bg-card">
                  <ChecklistRunner
                    checklist={t}
                    isCompleted={done}
                    onComplete={() => markChecklistComplete(t.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Training Page ───
export default function Training() {
  const { user } = useAuth();
  const { sops } = useSOPs();
  const { templates } = useChecklistTemplates();
  const { plans } = useTrainingPlans();
  const { assignments, updateAssignment } = useTrainingAssignments();

  const myAssignments = assignments.filter(a => a.assigned_to === user?.id);
  const activePlans = myAssignments.filter(a => a.status !== 'completed');
  const completedPlans = myAssignments.filter(a => a.status === 'completed');

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const selectedAssignment = myAssignments.find(a => a.training_plan_id === selectedPlanId);
  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  const qualifications = completedPlans
    .map(a => plans.find(p => p.id === a.training_plan_id))
    .filter(Boolean);

  if (selectedPlan && selectedAssignment) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedPlanId(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to My Training
        </Button>
        <PlanDetail
          plan={selectedPlan}
          assignment={selectedAssignment}
          sops={sops}
          templates={templates}
          onUpdateAssignment={async (updates) => {
            await updateAssignment.mutateAsync({ id: selectedAssignment.id, ...updates });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Training</h1>
        <p className="text-muted-foreground">Complete SOPs and checklists to earn qualifications</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Play className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{activePlans.length}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{completedPlans.length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{qualifications.length}</p>
              <p className="text-xs text-muted-foreground">Qualifications</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{myAssignments.length}</p>
              <p className="text-xs text-muted-foreground">Total Plans</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Training */}
      {activePlans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Active Training
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {activePlans.map(a => {
              const plan = plans.find(p => p.id === a.training_plan_id);
              if (!plan) return null;
              const totalItems = plan.sop_ids.length + plan.checklist_template_ids.length;
              const doneItems = (a.completed_sop_ids?.length ?? 0) + (a.completed_checklist_ids?.length ?? 0);
              const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

              return (
                <Card
                  key={a.id}
                  className="hover:shadow-md transition-shadow cursor-pointer border-primary/20"
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{plan.title}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{progress}%</Badge>
                    </div>
                    {plan.description && <CardDescription className="line-clamp-2">{plan.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="w-full bg-muted rounded-full h-2 mb-2">
                      <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                      <span>{plan.sop_ids.length} SOPs</span>
                      <span>•</span>
                      <span>{plan.checklist_template_ids.length} Checklists</span>
                      <span>•</span>
                      <span>{doneItems}/{totalItems} done</span>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-primary text-sm font-medium">
                      Continue <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Qualifications Earned */}
      {qualifications.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-green-600" /> Qualifications Earned
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {qualifications.map((plan: any) => {
              const assignment = completedPlans.find(a => a.training_plan_id === plan.id);
              return (
                <Card key={plan.id} className="border-green-200 bg-green-50/30">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                        <Trophy className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{plan.title}</p>
                        {plan.department && <p className="text-xs text-muted-foreground">{plan.department}</p>}
                        {assignment?.completed_at && (
                          <p className="text-xs text-muted-foreground">
                            Completed {new Date(assignment.completed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {myAssignments.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-1">No training assigned yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              When your manager assigns you a training plan, it will appear here with SOPs to read, checklists to complete, and qualifications to earn.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}