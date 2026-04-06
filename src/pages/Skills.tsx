import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useSkills, useSkillRecords, useObservations, SKILL_LEVELS, type Skill, type Observation } from '@/hooks/useSkills';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useAuth } from '@/hooks/useAuth';
import { DEPARTMENTS } from '@/hooks/useKnowledge';
import { DraftStandardDialog } from '@/components/skills/DraftStandardDialog';
import {
  Plus, ClipboardCheck, LayoutGrid, BookOpen, ChevronRight,
  CheckCircle2, XCircle, Clock, AlertTriangle, Pencil, Trash2,
  User, CalendarDays, FileText, Shield, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: number }) {
  const l = SKILL_LEVELS[level] ?? SKILL_LEVELS[0];
  return <Badge className={cn('text-xs font-medium', l.color)}>{l.label}</Badge>;
}

function levelFromRecord(records: ReturnType<typeof useSkillRecords>['records'], userId: string, skillId: string) {
  return records.find(r => r.user_id === userId && r.skill_id === skillId)?.level ?? 0;
}

// ─── Skill Editor Dialog ──────────────────────────────────────────────────────
function SkillEditorDialog({
  skill, open, onOpenChange,
}: { skill: Skill | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { createSkill, updateSkill } = useSkills();
  const { toast } = useToast();
  const isNew = !skill;

  const [name, setName] = useState(skill?.name ?? '');
  const [department, setDepartment] = useState(skill?.department ?? DEPARTMENTS[0]);
  const [description, setDescription] = useState(skill?.description ?? '');
  const [standard, setStandard] = useState(skill?.minimum_acceptable_standard ?? '');
  const [conditions, setConditions] = useState(skill?.conditions ?? '');
  const [saving, setSaving] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);

  const handleDraftApplied = ({ standard: s, conditions: c }: { standard: string; conditions: string }) => {
    setStandard(s);
    setConditions(c);
  };

  const handleSave = async () => {
    if (!name.trim() || !standard.trim()) return;
    setSaving(true);
    try {
      const payload = { name, department, description, minimum_acceptable_standard: standard, conditions, is_active: true, sort_order: 0 };
      if (isNew) {
        await createSkill.mutateAsync(payload);
      } else {
        await updateSkill.mutateAsync({ id: skill.id, ...payload });
      }
      toast({ title: isNew ? 'Skill created' : 'Skill updated' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New Skill' : 'Edit Skill'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Skill Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Barudan Left-Chest Hooping" />
            </div>
            <div className="col-span-2">
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>What this covers</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of the skill" rows={2} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" />
                Minimum Acceptable Standard
              </Label>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setDraftOpen(true)}
                disabled={!name.trim()}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Draft from SOP
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              What does a passing observation look like? Be specific — this is what you'll be evaluating against.
            </p>
            <Textarea
              value={standard}
              onChange={e => setStandard(e.target.value)}
              placeholder="e.g., Candidate hoops a left-chest garment independently, centered within 1/8 inch, correct tension, no distortion, in under 4 minutes. First attempt, no coaching."
              rows={4}
            />
          </div>

          <div>
            <Label>Observation Conditions</Label>
            <p className="text-xs text-muted-foreground mb-1">Equipment, setup, or constraints that must be in place.</p>
            <Textarea
              value={conditions}
              onChange={e => setConditions(e.target.value)}
              placeholder="e.g., Barudan BEKY-1501-6, standard left-chest frame, production garment (not scrap)"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !standard.trim()}>
              {saving ? 'Saving…' : isNew ? 'Create Skill' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <DraftStandardDialog
          open={draftOpen}
          onOpenChange={setDraftOpen}
          skillName={name}
          department={department}
          onApply={handleDraftApplied}
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Conduct Observation Sheet ────────────────────────────────────────────────
function ObservationSheet({
  open, onOpenChange, preselectedSkillId, preselectedCandidateId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preselectedSkillId?: string;
  preselectedCandidateId?: string;
}) {
  const { skills } = useSkills();
  const { teamMembers } = useTeamMembers();
  const { conductObservation } = useObservations();
  const { user } = useAuth();
  const { toast } = useToast();

  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');
  const [candidateId, setCandidateId] = useState(preselectedCandidateId ?? '');
  const [result, setResult] = useState<'pass' | 'no_pass' | 'incomplete'>('pass');
  const [levelAwarded, setLevelAwarded] = useState<number>(2);
  const [conditionsNotes, setConditionsNotes] = useState('');
  const [evaluatorNotes, setEvaluatorNotes] = useState('');
  const [recheckRequired, setRecheckRequired] = useState(false);
  const [recheckBy, setRecheckBy] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedSkill = skills.find(s => s.id === skillId);

  const handleSubmit = async () => {
    if (!skillId || !candidateId || !user) return;
    if (result !== 'pass' && !evaluatorNotes.trim()) {
      toast({ variant: 'destructive', title: 'Notes required', description: 'Explain what standard was not met.' });
      return;
    }
    setSaving(true);
    try {
      await conductObservation.mutateAsync({
        skill_id: skillId,
        candidate_id: candidateId,
        evaluator_id: user.id,
        conducted_at: new Date().toISOString(),
        result,
        level_awarded: result === 'pass' ? levelAwarded as any : null,
        conditions_notes: conditionsNotes || null,
        evaluator_notes: evaluatorNotes,
        recheck_required: recheckRequired,
        recheck_by: recheckRequired && recheckBy ? new Date(recheckBy).toISOString() : null,
      });
      toast({ title: result === 'pass' ? '✓ Skills check passed — credential recorded' : 'Skills check recorded — no credential awarded' });
      onOpenChange(false);
      setSkillId(preselectedSkillId ?? '');
      setCandidateId(preselectedCandidateId ?? '');
      setResult('pass');
      setLevelAwarded(2);
      setConditionsNotes('');
      setEvaluatorNotes('');
      setRecheckRequired(false);
      setRecheckBy('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Conduct Skills Check
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Record the result of a live performance evaluation.
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 py-4">
          <div className="space-y-5 pr-2">
            <div>
              <Label>Skill Being Evaluated</Label>
              <Select value={skillId} onValueChange={setSkillId}>
                <SelectTrigger><SelectValue placeholder="Select skill…" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(dept => {
                    const deptSkills = skills.filter(s => s.department === dept);
                    if (!deptSkills.length) return null;
                    return (
                      <div key={dept}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{dept}</div>
                        {deptSkills.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedSkill?.minimum_acceptable_standard && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" /> Minimum Acceptable Standard
                </p>
                <p className="text-sm">{selectedSkill.minimum_acceptable_standard}</p>
                {selectedSkill.conditions && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2">Required Conditions</p>
                    <p className="text-sm text-muted-foreground">{selectedSkill.conditions}</p>
                  </>
                )}
              </div>
            )}

            <div>
              <Label>Candidate</Label>
              <Select value={candidateId} onValueChange={setCandidateId}>
                <SelectTrigger><SelectValue placeholder="Select team member…" /></SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name ?? m.user_id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Result</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(['pass', 'no_pass', 'incomplete'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setResult(r)}
                    className={cn(
                      'rounded-lg border p-3 text-sm font-medium transition-all text-left',
                      result === r
                        ? r === 'pass' ? 'border-green-500 bg-green-50 text-green-800'
                          : r === 'no_pass' ? 'border-red-400 bg-red-50 text-red-800'
                          : 'border-yellow-400 bg-yellow-50 text-yellow-800'
                        : 'border-muted hover:border-muted-foreground/40'
                    )}
                  >
                    {r === 'pass' && <CheckCircle2 className="h-4 w-4 mb-1 text-green-600" />}
                    {r === 'no_pass' && <XCircle className="h-4 w-4 mb-1 text-red-500" />}
                    {r === 'incomplete' && <Clock className="h-4 w-4 mb-1 text-yellow-600" />}
                    {r === 'pass' ? 'Pass' : r === 'no_pass' ? 'No Pass' : 'Incomplete'}
                  </button>
                ))}
              </div>
            </div>

            {result === 'pass' && (
              <div>
                <Label>Level Awarded</Label>
                <Select value={String(levelAwarded)} onValueChange={v => setLevelAwarded(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SKILL_LEVELS.filter(l => l.level >= 1).map(l => (
                      <SelectItem key={l.level} value={String(l.level)}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Conditions on the Day</Label>
              <p className="text-xs text-muted-foreground mb-1">Any deviations from standard conditions? Normal production run?</p>
              <Textarea value={conditionsNotes} onChange={e => setConditionsNotes(e.target.value)} placeholder="e.g., Normal production run, 2xl gildan, standard frame" rows={2} />
            </div>

            <div>
              <Label>
                Evaluator Notes
                {result !== 'pass' && <span className="text-destructive ml-1">*</span>}
              </Label>
              <p className="text-xs text-muted-foreground mb-1">
                {result === 'pass'
                  ? 'Optional — anything worth noting for the record.'
                  : 'Required — what standard was not met, what needs work.'}
              </p>
              <Textarea value={evaluatorNotes} onChange={e => setEvaluatorNotes(e.target.value)} placeholder={result === 'pass' ? "Solid performance, no issues." : "Describe what fell short of the minimum standard…"} rows={3} />
            </div>

            {result !== 'pass' && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={recheckRequired} onChange={e => setRecheckRequired(e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium">Recheck required by a specific date</span>
                </label>
                {recheckRequired && (
                  <Input type="date" value={recheckBy} onChange={e => setRecheckBy(e.target.value)} />
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={saving || !skillId || !candidateId}
          >
            {saving ? 'Recording…' : 'Record Observation'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Skill Detail Sheet ───────────────────────────────────────────────────────
function SkillDetailSheet({
  skill, open, onOpenChange, onObservation,
}: {
  skill: Skill;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onObservation: (skillId: string) => void;
}) {
  const { records } = useSkillRecords();
  const { observations } = useObservations();
  const { teamMembers } = useTeamMembers();

  const skillRecords = records.filter(r => r.skill_id === skill.id);
  const skillRides = observations.filter(r => r.skill_id === skill.id);

  const getMemberName = (userId: string) =>
    teamMembers.find(m => m.user_id === userId)?.full_name ?? userId.slice(0, 8);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle>{skill.name}</SheetTitle>
          <Badge variant="outline" className="w-fit">{skill.department}</Badge>
        </SheetHeader>

        <ScrollArea className="flex-1 py-4">
          <div className="space-y-5 pr-2">
            {skill.description && (
              <p className="text-sm text-muted-foreground">{skill.description}</p>
            )}

            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" /> Minimum Acceptable Standard
              </p>
              <p className="text-sm">{skill.minimum_acceptable_standard ?? 'Not defined yet.'}</p>
              {skill.conditions && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide mt-3">Required Conditions</p>
                  <p className="text-sm text-muted-foreground">{skill.conditions}</p>
                </>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Team Status</p>
              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members found.</p>
              ) : (
                <div className="space-y-2">
                  {teamMembers.map(m => {
                    const rec = skillRecords.find(r => r.user_id === m.user_id);
                    const level = rec?.level ?? 0;
                    return (
                      <div key={m.user_id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{m.full_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <LevelBadge level={level} />
                          {rec?.verified_at && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(rec.verified_at), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {skillRides.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Observation History</p>
                <div className="space-y-2">
                  {skillRides.map(ride => (
                    <div key={ride.id} className={cn(
                      'p-3 rounded-lg border text-sm',
                      ride.result === 'pass' ? 'border-green-200 bg-green-50/50' :
                      ride.result === 'no_pass' ? 'border-red-200 bg-red-50/50' :
                      'border-yellow-200 bg-yellow-50/50'
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{getMemberName(ride.candidate_id)}</span>
                        <div className="flex items-center gap-1.5">
                          {ride.result === 'pass'
                            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                            : ride.result === 'no_pass'
                            ? <XCircle className="h-4 w-4 text-red-500" />
                            : <Clock className="h-4 w-4 text-yellow-600" />}
                          <span className="capitalize text-xs">{ride.result.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ride.conducted_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      {ride.evaluator_notes && (
                        <p className="text-xs mt-1.5 italic">"{ride.evaluator_notes}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t">
          <Button className="w-full" onClick={() => { onOpenChange(false); onObservation(skill.id); }}>
            <ClipboardCheck className="h-4 w-4 mr-2" /> Conduct Observation
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Skills Matrix ────────────────────────────────────────────────────────────
function SkillsMatrix() {
  const { skills } = useSkills();
  const { records } = useSkillRecords();
  const { teamMembers } = useTeamMembers();
  const [observationSkillId, setObservationSkillId] = useState<string | null>(null);
  const [viewingSkill, setViewingSkill] = useState<Skill | null>(null);
  const [deptFilter, setDeptFilter] = useState('all');

  const departments = [...new Set(skills.map(s => s.department))].sort();
  const filteredSkills = deptFilter === 'all' ? skills : skills.filter(s => s.department === deptFilter);

  const getLevel = (userId: string, skillId: string) =>
    records.find(r => r.user_id === userId && r.skill_id === skillId)?.level ?? 0;

  const cellClass = (level: number) => cn(
    'h-9 w-full rounded text-xs font-medium flex items-center justify-center transition-colors cursor-pointer',
    level === 0 ? 'bg-muted/50 text-muted-foreground hover:bg-muted' :
    level === 1 ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' :
    level === 2 ? 'bg-green-100 text-green-800 hover:bg-green-200' :
    level === 3 ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                  'bg-purple-100 text-purple-800 hover:bg-purple-200'
  );

  if (!skills.length || !teamMembers.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nothing to show yet</p>
        <p className="text-sm mt-1">Add skills and team members to see the matrix.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
          {SKILL_LEVELS.map(l => (
            <span key={l.level} className={cn('px-2 py-0.5 rounded', l.color)}>{l.label}</span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-semibold w-48 min-w-[12rem]">Skill</th>
              <th className="text-left p-3 font-semibold text-xs text-muted-foreground w-32">Dept</th>
              {teamMembers.map(m => (
                <th key={m.user_id} className="text-center p-3 font-medium min-w-[7rem]">
                  {m.full_name?.split(' ')[0] ?? '—'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {departments.filter(d => deptFilter === 'all' || d === deptFilter).map(dept => {
              const deptSkills = filteredSkills.filter(s => s.department === dept);
              if (!deptSkills.length) return null;
              return [
                <tr key={`hdr-${dept}`} className="bg-muted/30 border-t">
                  <td colSpan={2 + teamMembers.length} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {dept}
                  </td>
                </tr>,
                ...deptSkills.map(skill => (
                  <tr key={skill.id} className="border-t hover:bg-accent/20 group">
                    <td className="p-3">
                      <button
                        onClick={() => setViewingSkill(skill)}
                        className="text-left font-medium hover:text-primary transition-colors flex items-center gap-1 group-hover:underline"
                      >
                        {skill.name}
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{skill.department}</td>
                    {teamMembers.map(m => {
                      const level = getLevel(m.user_id, skill.id);
                      return (
                        <td key={m.user_id} className="p-2">
                          <button
                            onClick={() => { setObservationSkillId(skill.id); }}
                            className={cellClass(level)}
                            title={`${m.full_name} — ${SKILL_LEVELS[level].label}`}
                          >
                            {level === 0 ? '—' : SKILL_LEVELS[level].label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>

      {viewingSkill && (
        <SkillDetailSheet
          skill={viewingSkill}
          open={!!viewingSkill}
          onOpenChange={open => { if (!open) setViewingSkill(null); }}
          onObservation={id => { setObservationSkillId(id); setViewingSkill(null); }}
        />
      )}

      {observationSkillId && (
        <ObservationSheet
          open={!!observationSkillId}
          onOpenChange={open => { if (!open) setObservationSkillId(null); }}
          preselectedSkillId={observationSkillId}
        />
      )}
    </div>
  );
}

// ─── Skills Check Log ─────────────────────────────────────────────────────────
function SkillsCheckLog() {
  const { observations } = useObservations();
  const { skills } = useSkills();
  const { teamMembers } = useTeamMembers();

  const getName = (userId: string) =>
    teamMembers.find(m => m.user_id === userId)?.full_name ?? userId.slice(0, 8);
  const getSkillName = (skillId: string) =>
    skills.find(s => s.id === skillId)?.name ?? 'Unknown Skill';

  if (!observations.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No skills checks recorded yet</p>
        <p className="text-sm mt-1">Skills check records will appear here once you start evaluating.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {observations.map(ride => (
        <Card key={ride.id} className={cn(
          'border',
          ride.result === 'pass' ? 'border-green-200' :
          ride.result === 'no_pass' ? 'border-red-200' : 'border-yellow-200'
        )}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {ride.result === 'pass'
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    : ride.result === 'no_pass'
                    ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    : <Clock className="h-4 w-4 text-yellow-600 shrink-0" />}
                  <span className="font-semibold">{getName(ride.candidate_id)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground truncate">{getSkillName(ride.skill_id)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {format(new Date(ride.conducted_at), 'MMM d, yyyy h:mm a')}
                  </span>
                  {ride.result === 'pass' && ride.level_awarded !== null && (
                    <LevelBadge level={ride.level_awarded} />
                  )}
                  {ride.recheck_required && ride.recheck_by && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <AlertTriangle className="h-3 w-3" />
                      Recheck by {format(new Date(ride.recheck_by), 'MMM d')}
                    </span>
                  )}
                </div>
                {ride.evaluator_notes && (
                  <p className="text-sm text-muted-foreground italic">"{ride.evaluator_notes}"</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Skills List (Admin) ──────────────────────────────────────────────────────
function SkillsList() {
  const { skills, deleteSkill } = useSkills();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [viewingSkill, setViewingSkill] = useState<Skill | null>(null);
  const [skillsCheckOpen, setSkillsCheckOpen] = useState(false);
  const [skillsCheckSkillId, setSkillsCheckSkillId] = useState<string | undefined>();
  const { toast } = useToast();

  const departments = [...new Set(skills.map(s => s.department))].sort();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingSkill(null); setEditorOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Skill
        </Button>
      </div>

      {!skills.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No skills defined yet</p>
          <p className="text-sm mt-1">Start by defining the skills your team needs to operate the shop.</p>
        </div>
      ) : (
        departments.map(dept => (
          <div key={dept}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">{dept}</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {skills.filter(s => s.department === dept).map(skill => (
                <Card key={skill.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{skill.name}</p>
                        {skill.description && (
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{skill.description}</p>
                        )}
                        {skill.minimum_acceptable_standard && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                            Standard: {skill.minimum_acceptable_standard}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setViewingSkill(skill)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingSkill(skill); setEditorOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          await deleteSkill.mutateAsync(skill.id);
                          toast({ title: 'Skill removed' });
                        }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <SkillEditorDialog skill={editingSkill} open={editorOpen} onOpenChange={setEditorOpen} />

      {viewingSkill && (
        <SkillDetailSheet
          skill={viewingSkill}
          open={!!viewingSkill}
          onOpenChange={open => { if (!open) setViewingSkill(null); }}
          onObservation={id => { setSkillsCheckSkillId(id); setSkillsCheckOpen(true); setViewingSkill(null); }}
        />
      )}

      <ObservationSheet
        open={skillsCheckOpen}
        onOpenChange={setSkillsCheckOpen}
        preselectedSkillId={skillsCheckSkillId}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Skills() {
  const [skillsCheckOpen, setSkillsCheckOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skills & Credentials</h1>
          <p className="text-muted-foreground">
            Define what good looks like. Run skills checks. Know who can do what.
          </p>
        </div>
        <Button onClick={() => setSkillsCheckOpen(true)}>
          <ClipboardCheck className="h-4 w-4 mr-1.5" /> Conduct Skills Check
        </Button>
      </div>

      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix" className="gap-1.5"><LayoutGrid className="h-4 w-4" /> Matrix</TabsTrigger>
          <TabsTrigger value="skills" className="gap-1.5"><BookOpen className="h-4 w-4" /> Skills</TabsTrigger>
          <TabsTrigger value="log" className="gap-1.5"><FileText className="h-4 w-4" /> Skills Check Log</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="mt-4">
          <SkillsMatrix />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillsList />
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <SkillsCheckLog />
        </TabsContent>
      </Tabs>

      <ObservationSheet open={skillsCheckOpen} onOpenChange={setSkillsCheckOpen} />
    </div>
  );
}