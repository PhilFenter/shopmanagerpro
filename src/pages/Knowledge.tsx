import { useState, useRef, useCallback } from "react";
import { useSkills } from '@/hooks/useSkills';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Search, BookOpen, CheckSquare, GraduationCap,
  FileText, Trash2, Edit, Eye, ChevronRight, ChevronLeft, AlertTriangle, Lightbulb,
  Video, Image as ImageIcon, Camera, Upload, Loader2, Play, CheckCircle2, Circle,
  ArrowUp, ArrowDown, PlusCircle, FolderOpen,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import {
  useSOPs, useSOPSteps, useChecklistTemplates, useChecklistInstances, useTrainingPlans,
  useTrainingAssignments, DEPARTMENTS, CATEGORIES,
  type Sop, type SopStep, type ChecklistTemplate, type TrainingPlan, type TrainingAssignment,
} from '@/hooks/useKnowledge';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { cn } from '@/lib/utils';
import { AIGenerateDialog } from '@/components/knowledge/AIGenerateDialog';
import { Sparkles } from 'lucide-react';

// ─── SOP Editor Dialog ───
function SOPEditorDialog({
  sop,
  open,
  onOpenChange,
}: {
  sop: Sop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createSop, updateSop } = useSOPs();
  const { steps, upsertStep, deleteStep } = useSOPSteps(sop?.id ?? null);
  const { toast } = useToast();
  const [title, setTitle] = useState(sop?.title ?? '');
  const [description, setDescription] = useState(sop?.description ?? '');
  const [category, setCategory] = useState(sop?.category ?? 'General');
  const [department, setDepartment] = useState(sop?.department ?? '');
  const [status, setStatus] = useState(sop?.status ?? 'draft');
  const [localSteps, setLocalSteps] = useState<Partial<SopStep>[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const isEditing = !!sop;

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isEditing) {
        await updateSop.mutateAsync({ id: sop.id, title, description, category, department, status });
        // Save steps
        for (const step of localSteps) {
          await upsertStep.mutateAsync({ ...step, sop_id: sop.id } as any);
        }
      } else {
        const result = await createSop.mutateAsync({ title, description, category, department, status });
        for (let i = 0; i < localSteps.length; i++) {
          await upsertStep.mutateAsync({ ...localSteps[i], sop_id: (result as any).id, sort_order: i } as any);
        }
      }
      toast({ title: isEditing ? 'SOP updated' : 'SOP created' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
    setSaving(false);
  };

  const addStep = () => {
    setLocalSteps(prev => [...prev, { title: '', content: '', sort_order: (sop ? steps.length : 0) + prev.length, image_url: '', video_url: '', tip: '', warning: '' }]);
  };

  const moveLocalStep = (from: number, dir: -1 | 1) => {
    setLocalSteps(prev => {
      const to = from + dir;
      if (to < 0 || to >= prev.length) return prev;
      const arr = [...prev];
      [arr[from], arr[to]] = [arr[to], arr[from]];
      return arr;
    });
  };

  const moveExistingStep = async (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= steps.length) return;
    const a = steps[from];
    const b = steps[to];
    await upsertStep.mutateAsync({ ...a, sort_order: b.sort_order, sop_id: sop!.id });
    await upsertStep.mutateAsync({ ...b, sort_order: a.sort_order, sop_id: sop!.id });
  };

  const allSteps = [...(isEditing ? steps : []), ...localSteps];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit SOP' : 'New SOP'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Barudan Left-Chest Logo Setup" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this SOP cover?" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Steps</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-1" /> AI Generate
                </Button>
                <Button size="sm" variant="outline" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-1" /> Add Step
                </Button>
              </div>
            </div>

            <AIGenerateDialog
              open={aiOpen}
              onOpenChange={setAiOpen}
              type="sop"
              department={department}
              category={category}
              onGenerated={(result) => {
                if (result.title && !title) setTitle(result.title);
                if (result.description && !description) setDescription(result.description);
                if (result.steps?.length) {
                  const newSteps = result.steps.map((s: any, i: number) => ({
                    title: s.title,
                    content: s.content,
                    tip: s.tip || '',
                    warning: s.warning || '',
                    sort_order: (isEditing ? steps.length : 0) + localSteps.length + i,
                    image_url: '',
                    video_url: '',
                  }));
                  setLocalSteps(prev => [...prev, ...newSteps]);
                }
              }}
            />

            {isEditing && steps.map((step, i) => (
              <StepEditor
                key={step.id}
                step={step}
                index={i}
                onSave={(s) => upsertStep.mutateAsync({ ...s, sop_id: sop.id })}
                onDelete={() => deleteStep.mutateAsync(step.id)}
                onMoveUp={i > 0 ? () => moveExistingStep(i, -1) : undefined}
                onMoveDown={i < steps.length - 1 ? () => moveExistingStep(i, 1) : undefined}
              />
            ))}

            {localSteps.map((step, i) => (
              <StepEditor
                key={`new-${i}`}
                step={step as SopStep}
                index={(isEditing ? steps.length : 0) + i}
                onSave={(s) => setLocalSteps(prev => prev.map((p, j) => j === i ? { ...p, ...s } : p))}
                onDelete={() => setLocalSteps(prev => prev.filter((_, j) => j !== i))}
                onMoveUp={i > 0 ? () => moveLocalStep(i, -1) : undefined}
                onMoveDown={i < localSteps.length - 1 ? () => moveLocalStep(i, 1) : undefined}
              />
            ))}

            {allSteps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No steps yet. Add your first step above.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create SOP'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function uploadSopMedia(file: File, folder: 'images' | 'videos'): Promise<string> {
  const ext = file.name.split('.').pop() || (folder === 'images' ? 'jpg' : 'mp4');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('sop-media').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('sop-media').getPublicUrl(path);
  return data.publicUrl;
}

function StepEditor({
  step, index, onSave, onDelete, onMoveUp, onMoveDown,
}: {
  step: Partial<SopStep>;
  index: number;
  onSave: (s: Partial<SopStep>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [expanded, setExpanded] = useState(!step.id);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Local state for text fields — sync to parent on blur
  const [localTitle, setLocalTitle] = useState(step.title ?? '');
  const [localContent, setLocalContent] = useState(step.content ?? '');
  const [localTip, setLocalTip] = useState(step.tip ?? '');
  const [localWarning, setLocalWarning] = useState(step.warning ?? '');

  const flushField = useCallback((field: string, value: string) => {
    onSave({ ...step, [field]: value });
  }, [step, onSave]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadSopMedia(file, 'images');
      onSave({ ...step, image_url: url });
      toast({ title: 'Photo uploaded' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    }
    setUploadingImage(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const url = await uploadSopMedia(file, 'videos');
      onSave({ ...step, video_url: url });
      toast({ title: 'Video uploaded' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    }
    setUploadingVideo(false);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  return (
    <div className="border rounded-lg mb-2 bg-card">
      <div className="flex items-center gap-1 p-2">
        <div className="flex flex-col">
          <Button size="icon" variant="ghost" className="h-5 w-5" disabled={!onMoveUp} onClick={onMoveUp}>
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-5 w-5" disabled={!onMoveDown} onClick={onMoveDown}>
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-2 p-1 text-left text-sm font-medium"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{index + 1}</span>
          <span className="flex-1">{localTitle || 'Untitled Step'}</span>
          <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          <Input
            placeholder="Step title"
            value={localTitle}
            onChange={e => setLocalTitle(e.target.value)}
            onBlur={() => flushField('title', localTitle)}
          />
          <Textarea
            placeholder="Step instructions..."
            value={localContent}
            onChange={e => setLocalContent(e.target.value)}
            onBlur={() => flushField('content', localContent)}
            rows={3}
          />

          {/* Photo upload */}
          <div>
            <Label className="text-xs flex items-center gap-1 mb-1"><Camera className="h-3 w-3" /> Photo</Label>
            {step.image_url ? (
              <div className="relative">
                <img src={step.image_url} alt="Step" className="rounded-lg max-h-40 object-cover" />
                <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-7 w-7 p-0" onClick={() => onSave({ ...step, image_url: '' })}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input ref={imageInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                <Button size="sm" variant="outline" disabled={uploadingImage} onClick={() => imageInputRef.current?.click()}>
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Camera className="h-4 w-4 mr-1" />}
                  Take Photo
                </Button>
                <input id={`img-file-${index}`} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <Button size="sm" variant="outline" disabled={uploadingImage} onClick={() => document.getElementById(`img-file-${index}`)?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Upload
                </Button>
              </div>
            )}
          </div>

          {/* Video upload */}
          <div>
            <Label className="text-xs flex items-center gap-1 mb-1"><Video className="h-3 w-3" /> Video</Label>
            {step.video_url ? (
              <div className="relative">
                <video src={step.video_url} controls className="rounded-lg max-h-40 w-full" />
                <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-7 w-7 p-0" onClick={() => onSave({ ...step, video_url: '' })}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input ref={videoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleVideoUpload} />
                <Button size="sm" variant="outline" disabled={uploadingVideo} onClick={() => videoInputRef.current?.click()}>
                  {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Video className="h-4 w-4 mr-1" />}
                  Record Video
                </Button>
                <input id={`vid-file-${index}`} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                <Button size="sm" variant="outline" disabled={uploadingVideo} onClick={() => document.getElementById(`vid-file-${index}`)?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Upload
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Pro Tip</Label>
              <Textarea
                placeholder="Optional tip..."
                value={localTip}
                onChange={e => setLocalTip(e.target.value)}
                onBlur={() => flushField('tip', localTip)}
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Warning</Label>
              <Textarea
                placeholder="Optional warning..."
                value={localWarning}
                onChange={e => setLocalWarning(e.target.value)}
                onBlur={() => flushField('warning', localWarning)}
                rows={2}
              />
            </div>
          </div>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Remove Step
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── SOP Viewer ───
function SOPViewer({ sop, onClose }: { sop: Sop; onClose: () => void }) {
  const { steps, isLoading } = useSOPSteps(sop.id);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {sop.title}
          </DialogTitle>
        </DialogHeader>
        {sop.description && <p className="text-sm text-muted-foreground">{sop.description}</p>}
        <div className="flex gap-2 flex-wrap">
          {sop.department && <Badge variant="secondary">{sop.department}</Badge>}
          <Badge variant="outline">{sop.category}</Badge>
          <Badge className={sop.status === 'published' ? 'bg-green-100 text-green-800' : ''}>{sop.status}</Badge>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading steps...</p>
        ) : (
          <div className="space-y-4 mt-4">
            {steps.map((step, i) => (
              <div key={step.id} className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <h4 className="font-semibold">{step.title}</h4>
                    {step.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{step.content}</p>}
                    {step.image_url && <img src={step.image_url} alt={step.title} className="rounded-lg max-h-64 object-cover" />}
                    {step.video_url && (
                      <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                        <iframe src={step.video_url.replace('watch?v=', 'embed/')} className="w-full h-full" allowFullScreen />
                      </div>
                    )}
                    {step.tip && (
                      <div className="flex items-start gap-2 bg-primary/10 text-primary rounded-lg p-3 text-sm">
                        <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{step.tip}</span>
                      </div>
                    )}
                    {step.warning && (
                      <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{step.warning}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {steps.length === 0 && <p className="text-center text-muted-foreground">No steps defined yet.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Checklist Template Editor Dialog ───
function ChecklistEditorDialog({
  template,
  open,
  onOpenChange,
}: {
  template: ChecklistTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createTemplate, updateTemplate } = useChecklistTemplates();
  const { sops } = useSOPs();
  const { toast } = useToast();
  const [title, setTitle] = useState(template?.title ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [category, setCategory] = useState(template?.category ?? 'General');
  const [department, setDepartment] = useState(template?.department ?? '');
  const [sopId, setSopId] = useState(template?.sop_id ?? 'none');
  const [items, setItems] = useState<{ text: string; required: boolean }[]>(template?.items ?? []);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const addItem = () => setItems(prev => [...prev, { text: '', required: false }]);
  const insertItemAt = (idx: number) => setItems(prev => [...prev.slice(0, idx + 1), { text: '', required: false }, ...prev.slice(idx + 1)]);
  const moveItem = (from: number, dir: -1 | 1) => {
    setItems(prev => {
      const to = from + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = { title, description, category, department, sop_id: sopId === 'none' ? null : sopId, items: items.filter(i => i.text.trim()) };
      if (template) {
        await updateTemplate.mutateAsync({ id: template.id, ...payload });
      } else {
        await createTemplate.mutateAsync(payload);
      }
      toast({ title: template ? 'Checklist updated' : 'Checklist created' });
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
          <DialogTitle>{template ? 'Edit Checklist' : 'New Checklist Template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., End of Day Press Shutdown" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="When to use this checklist" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Linked SOP (optional)</Label>
            <Select value={sopId} onValueChange={setSopId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {sops.filter(s => s.status === 'published').map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Items</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-1" /> AI Generate
                </Button>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
              </div>
            </div>

            <AIGenerateDialog
              open={aiOpen}
              onOpenChange={setAiOpen}
              type="checklist"
              department={department}
              category={category}
              onGenerated={(result) => {
                if (result.title && !title) setTitle(result.title);
                if (result.description && !description) setDescription(result.description);
                if (result.items?.length) {
                  setItems(prev => [...prev, ...result.items]);
                }
              }}
            />
            <TooltipProvider delayDuration={200}>
            {items.map((item, i) => (
              <div key={i} className="group">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                  <div className="flex flex-col">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={i === 0} onClick={() => moveItem(i, -1)}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Move up</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={i === items.length - 1} onClick={() => moveItem(i, 1)}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Move down</TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    className="flex-1"
                    value={item.text}
                    onChange={e => setItems(prev => prev.map((p, j) => j === i ? { ...p, text: e.target.value } : p))}
                    placeholder="Checklist item..."
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => insertItemAt(i)}>
                        <PlusCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insert item below</TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            </TooltipProvider>
            {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No items yet.</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? 'Saving...' : template ? 'Save Changes' : 'Create Checklist'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Training Plan Editor ───
function TrainingPlanDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: TrainingPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createPlan, updatePlan } = useTrainingPlans();
  const { sops } = useSOPs();
  const { templates } = useChecklistTemplates();
  const { toast } = useToast();
  const [title, setTitle] = useState(plan?.title ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [department, setDepartment] = useState(plan?.department ?? '');
  const [role, setRole] = useState(plan?.role ?? '');
  const [selectedSops, setSelectedSops] = useState<string[]>(plan?.sop_ids ?? []);
  const [selectedChecklists, setSelectedChecklists] = useState<string[]>(plan?.checklist_template_ids ?? []);
  const [selectedSkillId, setSelectedSkillId] = useState<string>(plan?.skill_id ?? '');
  const [preparesForLevel, setPreparesForLevel] = useState<number>(plan?.prepares_for_level ?? 2);
  const [saving, setSaving] = useState(false);

  const { skills } = useSkills();

  const toggleSop = (id: string) => setSelectedSops(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleChecklist = (id: string) => setSelectedChecklists(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        title, description, department, role,
        sop_ids: selectedSops,
        checklist_template_ids: selectedChecklists,
        skill_id: selectedSkillId || null,
        prepares_for_level: selectedSkillId ? preparesForLevel : null,
      };
      if (plan) {
        await updatePlan.mutateAsync({ id: plan.id, ...payload });
      } else {
        await createPlan.mutateAsync(payload);
      }
      toast({ title: plan ? 'Plan updated' : 'Plan created' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
    setSaving(false);
  };

  const SKILL_LEVELS = [
    { level: 1, label: 'In Training' },
    { level: 2, label: 'Qualified' },
    { level: 3, label: 'Lead' },
    { level: 4, label: 'Evaluator' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit Training Plan' : 'New Training Plan'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., New Embroidery Operator Onboarding" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What this training covers" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g., Operator" />
            </div>
          </div>

          {/* Skill Link Section */}
          {skills.length > 0 && (
            <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                🎯 Prepares For Skill
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Optionally link this plan to a skill — when completed, it signals readiness for a check ride.
              </p>
              <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
                <SelectTrigger><SelectValue placeholder="None (no skill linked)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {skills.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.department})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSkillId && (
                <div>
                  <Label className="text-sm">Target Level</Label>
                  <Select value={String(preparesForLevel)} onValueChange={v => setPreparesForLevel(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SKILL_LEVELS.map(l => (
                        <SelectItem key={l.level} value={String(l.level)}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-base font-semibold">SOPs to Complete</Label>
            <div className="mt-1 space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
              {sops.filter(s => s.status === 'published').map(s => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded p-1">
                  <input type="checkbox" checked={selectedSops.includes(s.id)} onChange={() => toggleSop(s.id)} className="rounded" />
                  <span>{s.title}</span>
                  {s.department && <Badge variant="outline" className="text-xs">{s.department}</Badge>}
                </label>
              ))}
              {sops.filter(s => s.status === 'published').length === 0 && <p className="text-xs text-muted-foreground">No published SOPs yet</p>}
            </div>
          </div>

          <div>
            <Label className="text-base font-semibold">Checklists to Complete</Label>
            <div className="mt-1 space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
              {templates.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded p-1">
                  <input type="checkbox" checked={selectedChecklists.includes(t.id)} onChange={() => toggleChecklist(t.id)} className="rounded" />
                  <span>{t.title}</span>
                </label>
              ))}
              {templates.length === 0 && <p className="text-xs text-muted-foreground">No checklists yet</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? 'Saving...' : plan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───
// ─── Training Plan Detail Sheet ───
function TrainingPlanDetailSheet({
  plan,
  sops,
  templates,
  assignments: allAssignments,
  teamMembers,
  onClose,
  onEdit,
}: {
  plan: TrainingPlan;
  sops: Sop[];
  templates: ChecklistTemplate[];
  assignments: TrainingAssignment[];
  teamMembers: { id: string; user_id: string; full_name: string | null }[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const { createAssignment } = useTrainingAssignments();
  const { toast } = useToast();
  const [assigning, setAssigning] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');

  const linkedSops = sops.filter(s => plan.sop_ids.includes(s.id));
  const linkedChecklists = templates.filter(t => plan.checklist_template_ids.includes(t.id));
  const planAssignments = allAssignments.filter(a => a.training_plan_id === plan.id);

  const getMemberName = (userId: string) => {
    const m = teamMembers.find(t => t.user_id === userId);
    return m?.full_name || userId.slice(0, 8);
  };

  const alreadyAssigned = planAssignments.map(a => a.assigned_to);
  const availableMembers = teamMembers.filter(m => !alreadyAssigned.includes(m.user_id));

  const handleAssign = async () => {
    if (!selectedMember) return;
    setAssigning(true);
    try {
      await createAssignment.mutateAsync({
        training_plan_id: plan.id,
        assigned_to: selectedMember,
        status: 'not_started',
        completed_sop_ids: [],
        completed_checklist_ids: [],
      });
      toast({ title: 'Team member assigned' });
      setSelectedMember('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
    setAssigning(false);
  };

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{plan.title}</SheetTitle>
              {plan.description && (
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {plan.department && <Badge variant="outline">{plan.department}</Badge>}
            {plan.role && <Badge variant="secondary">{plan.role}</Badge>}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          {/* SOPs Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> SOPs ({linkedSops.length})
            </h3>
            {linkedSops.length === 0 ? (
              <p className="text-sm text-muted-foreground">No SOPs linked to this plan.</p>
            ) : (
              <div className="space-y-2">
                {linkedSops.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                    <BookOpen className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      {s.department && <p className="text-xs text-muted-foreground">{s.department}</p>}
                    </div>
                    <Badge variant={s.status === 'published' ? 'default' : 'secondary'} className="text-xs shrink-0">
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="mb-6" />

          {/* Checklists Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> Checklists ({linkedChecklists.length})
            </h3>
            {linkedChecklists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No checklists linked to this plan.</p>
            ) : (
              <div className="space-y-2">
                {linkedChecklists.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                    <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.items.length} items</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="mb-6" />

          {/* Assignments Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> Assigned ({planAssignments.length})
            </h3>

            {planAssignments.length > 0 && (
              <div className="space-y-2 mb-4">
                {planAssignments.map(a => {
                  const completedSops = a.completed_sop_ids?.length ?? 0;
                  const completedChecklists = a.completed_checklist_ids?.length ?? 0;
                  const totalItems = plan.sop_ids.length + plan.checklist_template_ids.length;
                  const doneItems = completedSops + completedChecklists;
                  const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

                  return (
                    <div key={a.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{getMemberName(a.assigned_to)}</p>
                        <Badge
                          variant={a.status === 'completed' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {a.status === 'completed' ? 'Complete' : a.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                        </Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary rounded-full h-1.5 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {doneItems}/{totalItems} completed
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Assign new member */}
            {availableMembers.length > 0 && (
              <div className="flex gap-2">
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMembers.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name || m.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAssign} disabled={!selectedMember || assigning}>
                  {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
                </Button>
              </div>
            )}

            {availableMembers.length === 0 && planAssignments.length > 0 && (
              <p className="text-xs text-muted-foreground">All team members are assigned.</p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─── SOP Card with Hover Preview ───
function SOPCardWithPreview({ sop, onView, onEdit, onDelete }: { sop: Sop; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { steps, isLoading } = useSOPSteps(expanded ? sop.id : null);
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  return (
    <Card
      className="hover:shadow-md transition-all cursor-pointer"
      onMouseEnter={() => { if (!isTouchDevice) setExpanded(true); }}
      onMouseLeave={() => { if (!isTouchDevice) setExpanded(false); }}
      onClick={onView}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{sop.title}</CardTitle>
          <Badge variant={sop.status === 'published' ? 'default' : 'secondary'} className="text-xs">{sop.status}</Badge>
        </div>
        {sop.description && <CardDescription className="line-clamp-2">{sop.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 flex-wrap mb-3">
          {sop.department && <Badge variant="outline" className="text-xs">{sop.department}</Badge>}
          <Badge variant="outline" className="text-xs">{sop.category}</Badge>
        </div>

        {/* Hover preview of steps */}
        <div className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          expanded ? 'max-h-60 opacity-100 mb-3' : 'max-h-0 opacity-0'
        )}>
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-2">Loading steps...</p>
          ) : steps.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No steps defined yet.</p>
          ) : (
            <div className="space-y-1.5 border-t pt-2 max-h-52 overflow-y-auto">
              {steps.map((step, i) => (
                <div key={step.id} className="flex items-start gap-2 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px]">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{step.title}</p>
                    {step.content && <p className="text-muted-foreground line-clamp-1">{step.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={onEdit}><Edit className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Checklist Card with Hover Preview ───
function ChecklistCardWithPreview({ template, onStart, onEdit, onDelete }: { template: ChecklistTemplate; onStart: () => void; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  return (
    <>
      <Card
        className="hover:shadow-md transition-all cursor-pointer"
        onMouseEnter={() => { if (!isTouchDevice) setExpanded(true); }}
        onMouseLeave={() => { if (!isTouchDevice) setExpanded(false); }}
        onClick={() => setSheetOpen(true)}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{template.title}</CardTitle>
          {template.description && <CardDescription className="line-clamp-2">{template.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 flex-wrap mb-2">
            {template.department && <Badge variant="outline" className="text-xs">{template.department}</Badge>}
            <Badge variant="outline" className="text-xs">{template.items.length} items</Badge>
          </div>

          {/* Hover preview of items */}
          <div className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            expanded ? 'max-h-60 opacity-100 mb-3' : 'max-h-0 opacity-0'
          )}>
            {template.items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No items defined.</p>
            ) : (
              <div className="space-y-1 border-t pt-2 max-h-52 overflow-y-auto">
                {template.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className={cn("flex-1", item.required && "font-medium")}>{item.text}</span>
                    {item.required && <Badge variant="outline" className="text-[10px] px-1 py-0">Required</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="default" onClick={onStart}>
              <Play className="h-4 w-4 mr-1" /> Start
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit}><Edit className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Full-height detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col h-full">
          <SheetHeader className="pb-4">
            <SheetTitle>{template.title}</SheetTitle>
            {template.description && (
              <p className="text-sm text-muted-foreground">{template.description}</p>
            )}
            <div className="flex gap-1.5 flex-wrap pt-1">
              {template.department && <Badge variant="outline">{template.department}</Badge>}
              <Badge variant="outline">{template.items.length} items</Badge>
            </div>
          </SheetHeader>
          <Separator />
          <ScrollArea className="flex-1 py-4">
            {template.items.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No items defined.</p>
            ) : (
              <div className="space-y-3 pr-4">
                {template.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <div className="mt-0.5">
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className={cn("text-sm", item.required && "font-semibold")}>{item.text}</p>
                      {item.required && (
                        <Badge variant="secondary" className="text-xs mt-1">Required</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5">#{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <Separator />
          <div className="flex gap-2 pt-4">
            <Button className="flex-1" onClick={() => { setSheetOpen(false); onStart(); }}>
              <Play className="h-4 w-4 mr-1" /> Start Checklist
            </Button>
            <Button variant="outline" onClick={() => { setSheetOpen(false); onEdit(); }}>
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function Knowledge() {
  const { sops, isLoading: sopsLoading, deleteSop } = useSOPs();
  const { templates, isLoading: templatesLoading, deleteTemplate } = useChecklistTemplates();
  const { instances, createInstance, updateInstance } = useChecklistInstances();
  const { plans, isLoading: plansLoading, deletePlan } = useTrainingPlans();
  const { assignments } = useTrainingAssignments();
  const { teamMembers } = useTeamMembers();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sopEditorOpen, setSopEditorOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<Sop | null>(null);
  const [viewingSop, setViewingSop] = useState<Sop | null>(null);
  const [checklistEditorOpen, setChecklistEditorOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<ChecklistTemplate | null>(null);
  const [trainingEditorOpen, setTrainingEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TrainingPlan | null>(null);
  const [viewingPlan, setViewingPlan] = useState<TrainingPlan | null>(null);

  const filteredSops = sops.filter(s => {
    const matchesSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'all' || s.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'all' || t.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const filteredPlans = plans.filter(p => {
    const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'all' || p.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shop Knowledge</h1>
          <p className="text-muted-foreground">SOPs, checklists, and training for your team</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 w-56" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{sops.length}</p>
              <p className="text-xs text-muted-foreground">SOPs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-xs text-muted-foreground">Checklists</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{plans.length}</p>
              <p className="text-xs text-muted-foreground">Training Plans</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{sops.filter(s => s.status === 'published').length}</p>
              <p className="text-xs text-muted-foreground">Published</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="knowledge">
        <TabsList>
          <TabsTrigger value="knowledge" className="gap-1.5"><FolderOpen className="h-4 w-4" /> Knowledge Base</TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5"><GraduationCap className="h-4 w-4" /> Training</TabsTrigger>
        </TabsList>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge" className="mt-4">
          {selectedCategory === null ? (
            <div>
              <div className="flex justify-end mb-4 gap-2">
                <Button variant="outline" onClick={() => { setEditingChecklist(null); setChecklistEditorOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> New Checklist
                </Button>
                <Button onClick={() => { setEditingSop(null); setSopEditorOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> New SOP
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CATEGORIES.map(cat => {
                  const catSops = filteredSops.filter(s => (s.category || s.department || 'Uncategorized') === cat);
                  const catChecklists = filteredTemplates.filter(t => (t.category || t.department || 'Uncategorized') === cat);
                  const total = catSops.length + catChecklists.length;
                  if (total === 0 && search) return null;
                  return (
                    <Card
                      key={cat}
                      className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                      onClick={() => setSelectedCategory(cat)}
                    >
                      <CardContent className="pt-6 pb-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <FolderOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{cat}</p>
                              <p className="text-xs text-muted-foreground">
                                {catSops.length} SOP{catSops.length !== 1 ? 's' : ''} · {catChecklists.length} checklist{catChecklists.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Button variant="ghost" className="gap-1.5" onClick={() => setSelectedCategory(null)}>
                  <ChevronLeft className="h-4 w-4" /> All Categories
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setEditingChecklist(null); setChecklistEditorOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> New Checklist
                  </Button>
                  <Button onClick={() => { setEditingSop(null); setSopEditorOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> New SOP
                  </Button>
                </div>
              </div>

              <h2 className="text-xl font-bold flex items-center gap-2">
                <FolderOpen className="h-6 w-6 text-primary" />
                {selectedCategory}
              </h2>

              {/* Active Checklists for this category */}
              {(() => {
                const activeCategoryInstances = instances.filter(i => {
                  if (i.status === 'completed') return false;
                  const tmpl = templates.find(t => t.id === i.template_id);
                  return tmpl && (tmpl.category || tmpl.department || 'Uncategorized') === selectedCategory;
                });
                if (activeCategoryInstances.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Play className="h-5 w-5 text-primary" /> Active Checklists
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {activeCategoryInstances.map(inst => {
                        const totalItems = inst.items.length;
                        const doneItems = inst.items.filter((item: any) => item.done).length;
                        const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
                        return (
                          <Card key={inst.id} className="border-primary/30">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{inst.title}</CardTitle>
                                <Badge variant="secondary" className="text-xs">{doneItems}/{totalItems}</Badge>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2 mt-1">
                                <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {inst.items.map((item: any, idx: number) => (
                                  <button
                                    key={idx}
                                    className="flex items-center gap-2 text-sm w-full text-left hover:bg-accent/50 rounded p-1"
                                    onClick={() => {
                                      const updatedItems = inst.items.map((it: any, i: number) =>
                                        i === idx ? { ...it, done: !it.done } : it
                                      );
                                      const allDone = updatedItems.every((it: any) => it.done);
                                      updateInstance.mutateAsync({
                                        id: inst.id,
                                        items: updatedItems,
                                        status: allDone ? 'completed' : 'in_progress',
                                        completed_at: allDone ? new Date().toISOString() : null,
                                      });
                                    }}
                                  >
                                    {item.done
                                      ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                      : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                                    <span className={item.done ? 'line-through text-muted-foreground' : ''}>{item.text}</span>
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-1 mt-3 pt-2 border-t">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs"
                                  onClick={() => {
                                    updateInstance.mutateAsync({
                                      id: inst.id,
                                      items: inst.items.map((it: any) => ({ ...it, done: false })),
                                      status: 'in_progress',
                                      completed_at: null,
                                    });
                                  }}
                                >
                                  <ArrowDown className="h-3 w-3 mr-1 rotate-180" /> Reset All
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* SOPs */}
              {(() => {
                const catSops = filteredSops.filter(s => (s.category || s.department || 'Uncategorized') === selectedCategory);
                const catChecklists = filteredTemplates.filter(t => (t.category || t.department || 'Uncategorized') === selectedCategory);
                if (catSops.length === 0 && catChecklists.length === 0) {
                  return (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="font-medium">No content in {selectedCategory} yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Add SOPs or checklists to get started.</p>
                      </CardContent>
                    </Card>
                  );
                }
                if (catSops.length > 0) {
                  return (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" /> SOPs
                        <Badge variant="secondary">{catSops.length}</Badge>
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {catSops.map(sop => (
                          <SOPCardWithPreview
                            key={sop.id}
                            sop={sop}
                            onView={() => setViewingSop(sop)}
                            onEdit={() => { setEditingSop(sop); setSopEditorOpen(true); }}
                            onDelete={() => deleteSop.mutateAsync(sop.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Checklists */}
              {(() => {
                const catChecklists = filteredTemplates.filter(t => (t.category || t.department || 'Uncategorized') === selectedCategory);
                if (catChecklists.length > 0) {
                  return (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-primary" /> Checklists
                        <Badge variant="secondary">{catChecklists.length}</Badge>
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {catChecklists.map(t => (
                          <ChecklistCardWithPreview
                            key={t.id}
                            template={t}
                            onStart={() => {
                              createInstance.mutateAsync({
                                template_id: t.id,
                                title: t.title,
                                items: t.items.map(item => ({ ...item, done: false })),
                                status: 'in_progress',
                              });
                            }}
                            onEdit={() => { setEditingChecklist(t); setChecklistEditorOpen(true); }}
                            onDelete={() => deleteTemplate.mutateAsync(t.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </TabsContent>

        {/* Training Tab */}
        <TabsContent value="training" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setEditingPlan(null); setTrainingEditorOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New Training Plan
            </Button>
          </div>
          {plansLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredPlans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No training plans yet</p>
                <p className="text-sm text-muted-foreground mt-1">Bundle SOPs and checklists into onboarding paths for new hires.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredPlans.map(p => (
                <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewingPlan(p)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{p.title}</CardTitle>
                      {p.role && <Badge variant="secondary" className="text-xs">{p.role}</Badge>}
                    </div>
                    {p.description && <CardDescription className="line-clamp-2">{p.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {p.department && <Badge variant="outline" className="text-xs">{p.department}</Badge>}
                      <Badge variant="outline" className="text-xs">{p.sop_ids.length} SOPs</Badge>
                      <Badge variant="outline" className="text-xs">{p.checklist_template_ids.length} Checklists</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {assignments.filter(a => a.training_plan_id === p.id).length} assigned
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingPlan(p); setTrainingEditorOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deletePlan.mutateAsync(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {sopEditorOpen && <SOPEditorDialog sop={editingSop} open={sopEditorOpen} onOpenChange={setSopEditorOpen} />}
      {viewingSop && <SOPViewer sop={viewingSop} onClose={() => setViewingSop(null)} />}
      {checklistEditorOpen && <ChecklistEditorDialog template={editingChecklist} open={checklistEditorOpen} onOpenChange={setChecklistEditorOpen} />}
      {trainingEditorOpen && <TrainingPlanDialog plan={editingPlan} open={trainingEditorOpen} onOpenChange={setTrainingEditorOpen} />}

      {/* Training Plan Detail Sheet */}
      {viewingPlan && (
        <TrainingPlanDetailSheet
          plan={viewingPlan}
          sops={sops}
          templates={templates}
          assignments={assignments}
          teamMembers={teamMembers}
          onClose={() => setViewingPlan(null)}
          onEdit={() => { setEditingPlan(viewingPlan); setTrainingEditorOpen(true); setViewingPlan(null); }}
        />
      )}
    </div>
  );
}
