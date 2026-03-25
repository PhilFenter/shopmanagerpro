import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
  FileText, Trash2, Edit, Eye, ChevronRight, AlertTriangle, Lightbulb,
  Video, Image as ImageIcon, Camera, Upload, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  useSOPs, useSOPSteps, useChecklistTemplates, useTrainingPlans,
  useTrainingAssignments, DEPARTMENTS, CATEGORIES,
  type Sop, type SopStep, type ChecklistTemplate, type TrainingPlan,
} from '@/hooks/useKnowledge';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { cn } from '@/lib/utils';

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
              <Button size="sm" variant="outline" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" /> Add Step
              </Button>
            </div>

            {isEditing && steps.map((step, i) => (
              <StepEditor key={step.id} step={step} index={i} onSave={(s) => upsertStep.mutateAsync({ ...s, sop_id: sop.id })} onDelete={() => deleteStep.mutateAsync(step.id)} />
            ))}

            {localSteps.map((step, i) => (
              <StepEditor
                key={`new-${i}`}
                step={step as SopStep}
                index={(isEditing ? steps.length : 0) + i}
                onSave={(s) => setLocalSteps(prev => prev.map((p, j) => j === i ? { ...p, ...s } : p))}
                onDelete={() => setLocalSteps(prev => prev.filter((_, j) => j !== i))}
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
  step, index, onSave, onDelete,
}: {
  step: Partial<SopStep>;
  index: number;
  onSave: (s: Partial<SopStep>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(!step.id);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 text-left text-sm font-medium"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{index + 1}</span>
        <span className="flex-1">{step.title || 'Untitled Step'}</span>
        <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          <Input placeholder="Step title" value={step.title ?? ''} onChange={e => onSave({ ...step, title: e.target.value })} />
          <Textarea placeholder="Step instructions..." value={step.content ?? ''} onChange={e => onSave({ ...step, content: e.target.value })} rows={3} />

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
              <Input placeholder="Optional tip..." value={step.tip ?? ''} onChange={e => onSave({ ...step, tip: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Warning</Label>
              <Input placeholder="Optional warning..." value={step.warning ?? ''} onChange={e => onSave({ ...step, warning: e.target.value })} />
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

  const addItem = () => setItems(prev => [...prev, { text: '', required: false }]);

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
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                <Input
                  className="flex-1"
                  value={item.text}
                  onChange={e => setItems(prev => prev.map((p, j) => j === i ? { ...p, text: e.target.value } : p))}
                  placeholder="Checklist item..."
                />
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
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
  const [saving, setSaving] = useState(false);

  const toggleSop = (id: string) => setSelectedSops(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleChecklist = (id: string) => setSelectedChecklists(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = { title, description, department, role, sop_ids: selectedSops, checklist_template_ids: selectedChecklists };
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
export default function Knowledge() {
  const { sops, isLoading: sopsLoading, deleteSop } = useSOPs();
  const { templates, isLoading: templatesLoading, deleteTemplate } = useChecklistTemplates();
  const { plans, isLoading: plansLoading, deletePlan } = useTrainingPlans();
  const { assignments } = useTrainingAssignments();
  const { teamMembers } = useTeamMembers();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [sopEditorOpen, setSopEditorOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<Sop | null>(null);
  const [viewingSop, setViewingSop] = useState<Sop | null>(null);
  const [checklistEditorOpen, setChecklistEditorOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<ChecklistTemplate | null>(null);
  const [trainingEditorOpen, setTrainingEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TrainingPlan | null>(null);

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

      <Tabs defaultValue="sops">
        <TabsList>
          <TabsTrigger value="sops" className="gap-1.5"><BookOpen className="h-4 w-4" /> SOPs</TabsTrigger>
          <TabsTrigger value="checklists" className="gap-1.5"><CheckSquare className="h-4 w-4" /> Checklists</TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5"><GraduationCap className="h-4 w-4" /> Training</TabsTrigger>
        </TabsList>

        {/* SOPs Tab */}
        <TabsContent value="sops" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setEditingSop(null); setSopEditorOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New SOP
            </Button>
          </div>
          {sopsLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredSops.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No SOPs yet</p>
                <p className="text-sm text-muted-foreground mt-1">Start by documenting Rachael's embroidery procedures!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredSops.map(sop => (
                <Card key={sop.id} className="hover:shadow-md transition-shadow">
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
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewingSop(sop)}><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingSop(sop); setSopEditorOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteSop.mutateAsync(sop.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Checklists Tab */}
        <TabsContent value="checklists" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setEditingChecklist(null); setChecklistEditorOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New Checklist
            </Button>
          </div>
          {templatesLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No checklists yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create daily task lists to keep the team on point.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map(t => (
                <Card key={t.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t.title}</CardTitle>
                    {t.description && <CardDescription className="line-clamp-2">{t.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-1 flex-wrap mb-2">
                      {t.department && <Badge variant="outline" className="text-xs">{t.department}</Badge>}
                      <Badge variant="outline" className="text-xs">{t.items.length} items</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingChecklist(t); setChecklistEditorOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteTemplate.mutateAsync(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                <Card key={p.id} className="hover:shadow-md transition-shadow">
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
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingPlan(p); setTrainingEditorOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deletePlan.mutateAsync(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
    </div>
  );
}
