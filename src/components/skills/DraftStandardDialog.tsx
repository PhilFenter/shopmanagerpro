import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Shield, AlertTriangle, CheckCircle2, ChevronRight, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSOPs, useSOPSteps } from '@/hooks/useKnowledge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface DraftResult {
  minimum_acceptable_standard: string;
  conditions: string;
  suggested_skill_name?: string;
  key_tolerances: string[];
  common_failure_points: string[];
}

interface DraftStandardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillName: string;
  department: string;
  onApply: (result: { standard: string; conditions: string }) => void;
}

function SOPStepsFetcher({ sopId, onStepsLoaded }: { sopId: string; onStepsLoaded: (steps: any[]) => void }) {
  const { steps, isLoading } = useSOPSteps(sopId);
  if (!isLoading && steps.length > 0) onStepsLoaded(steps);
  return null;
}

export function DraftStandardDialog({ open, onOpenChange, skillName, department, onApply }: DraftStandardDialogProps) {
  const { sops } = useSOPs();
  const { toast } = useToast();

  const [selectedSopId, setSelectedSopId] = useState('');
  const [evaluatorNotes, setEvaluatorNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [sopSteps, setSopSteps] = useState<any[]>([]);

  const selectedSop = sops.find(s => s.id === selectedSopId);
  const publishedSops = sops.filter(s => s.status === 'published');
  const deptSops = publishedSops.filter(s => s.department === department);
  const otherSops = publishedSops.filter(s => s.department !== department);

  const handleGenerate = async () => {
    if (!selectedSopId || !selectedSop || !sopSteps.length) {
      toast({ variant: 'destructive', title: 'Select a SOP with steps first.' });
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-draft-standard', {
        body: {
          sop_title: selectedSop.title,
          sop_description: selectedSop.description,
          steps: sopSteps,
          skill_name: skillName,
          department,
          evaluator_notes: evaluatorNotes,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Draft failed', description: e.message });
    }
    setGenerating(false);
  };

  const handleApply = () => {
    if (!result) return;
    onApply({ standard: result.minimum_acceptable_standard, conditions: result.conditions });
    toast({ title: 'Standard applied — review and edit before saving.' });
    onOpenChange(false);
    setResult(null);
    setSelectedSopId('');
    setEvaluatorNotes('');
    setSopSteps([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Draft Standard from SOP
          </DialogTitle>
          <DialogDescription>
            Pick the SOP that teaches this skill. The AI reads the steps and drafts a minimum acceptable standard in PTS language — specific, observable, measurable. You review and edit before it saves.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 pr-2">
            {!result && (
              <>
                <div>
                  <Label>Reference SOP</Label>
                  <p className="text-xs text-muted-foreground mb-1">The SOP that teaches this task — your Advisory Circular.</p>
                  <Select value={selectedSopId} onValueChange={v => { setSelectedSopId(v); setSopSteps([]); }}>
                    <SelectTrigger><SelectValue placeholder="Select a published SOP…" /></SelectTrigger>
                    <SelectContent>
                      {deptSops.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{department}</div>
                          {deptSops.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                        </>
                      )}
                      {otherSops.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1">Other Departments</div>
                          {otherSops.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                        </>
                      )}
                      {publishedSops.length === 0 && (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">No published SOPs yet</div>
                      )}
                    </SelectContent>
                  </Select>

                  {selectedSopId && <SOPStepsFetcher sopId={selectedSopId} onStepsLoaded={setSopSteps} />}

                  {selectedSopId && sopSteps.length === 0 && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> This SOP has no steps — add steps before drafting a standard.
                    </p>
                  )}
                  {selectedSopId && sopSteps.length > 0 && (
                    <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {sopSteps.length} steps loaded
                    </p>
                  )}
                </div>

                {sopSteps.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">SOP Preview</p>
                    <div className="space-y-1.5">
                      {sopSteps.map((step, i) => (
                        <div key={step.id} className="flex items-start gap-2 text-xs">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px]">{i + 1}</span>
                          <div>
                            <span className="font-medium">{step.title}</span>
                            {step.content && <span className="text-muted-foreground"> — {step.content.slice(0, 80)}{step.content.length > 80 ? '…' : ''}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label>Additional Context (optional)</Label>
                  <p className="text-xs text-muted-foreground mb-1">Time constraints, equipment quirks, common issues you've seen on the floor.</p>
                  <Textarea
                    value={evaluatorNotes}
                    onChange={e => setEvaluatorNotes(e.target.value)}
                    placeholder="e.g., Tension and centering are where most people struggle. Time matters — we run production, not practice."
                    rows={3}
                  />
                </div>
              </>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Draft ready — review before applying.
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Start over
                  </Button>
                </div>

                {result.suggested_skill_name && result.suggested_skill_name !== skillName && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3 text-sm">
                    <p className="font-medium text-yellow-800">Suggested skill name: "{result.suggested_skill_name}"</p>
                    <p className="text-xs text-yellow-600 mt-1">Update the skill name separately if this is more precise.</p>
                  </div>
                )}

                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" /> Minimum Acceptable Standard
                  </p>
                  <p className="text-sm leading-relaxed">{result.minimum_acceptable_standard}</p>
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required Conditions</p>
                  <p className="text-sm leading-relaxed">{result.conditions}</p>
                </div>

                {result.key_tolerances?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Key Tolerances</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.key_tolerances.map((t, i) => <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>)}
                    </div>
                  </div>
                )}

                <Separator />

                {result.common_failure_points?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> Common Failure Points
                    </p>
                    <div className="space-y-1.5">
                      {result.common_failure_points.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <ChevronRight className="h-4 w-4 shrink-0 text-orange-400 mt-0.5" />{f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { onOpenChange(false); setResult(null); }}>Cancel</Button>
          {!result ? (
            <Button className="flex-1" onClick={handleGenerate} disabled={generating || !selectedSopId || sopSteps.length === 0}>
              {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Drafting…</> : <><Sparkles className="h-4 w-4 mr-2" /> Draft Standard</>}
            </Button>
          ) : (
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleApply}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Apply to Skill
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
