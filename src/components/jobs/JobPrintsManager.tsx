import { useState } from 'react';
import { useJobPrints, JobPrint, PRINT_LOCATIONS } from '@/hooks/useJobPrints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Copy, Trash2, Palette, MapPin, Layers } from 'lucide-react';

interface Props {
  jobId: string;
}

const EMPTY: any = {
  design_name: '',
  location: 'Left Chest',
  artwork_url: '',
  width_in: '',
  height_in: '',
  garment_color: '',
  notes: '',
};

export function JobPrintsManager({ jobId }: Props) {
  const { prints, isLoading, create, update, remove, duplicate } = useJobPrints(jobId);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (p: JobPrint) => {
    setEditingId(p.id);
    setForm({
      design_name: p.design_name,
      location: p.location,
      artwork_url: p.artwork_url || '',
      width_in: p.width_in ?? '',
      height_in: p.height_in ?? '',
      garment_color: p.garment_color || '',
      notes: p.notes || '',
    });
    setOpen(true);
  };

  const num = (v: any) => (v === '' || v == null ? null : Number(v));

  const handleSave = async () => {
    if (!form.design_name.trim() || !form.location) return;
    const payload = {
      design_name: form.design_name.trim(),
      location: form.location,
      artwork_url: form.artwork_url || null,
      width_in: num(form.width_in),
      height_in: num(form.height_in),
      garment_color: form.garment_color || null,
      notes: form.notes || null,
    };
    if (editingId) {
      await update.mutateAsync({ id: editingId, ...payload });
    } else {
      await create.mutateAsync(payload as any);
    }
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" /> Prints on this Job
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            One row per Design + Location + Ink/Garment combo. Each is its own screen-setup recipe.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add Print
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : prints.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No prints yet. Add one for each design + location on this job.
          </div>
        ) : (
          <div className="space-y-2">
            {prints.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 hover:bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.design_name}</span>
                      <Badge variant="secondary" className="gap-1">
                        <MapPin className="h-3 w-3" /> {p.location}
                      </Badge>
                      {p.garment_color && (
                        <Badge variant="outline">on {p.garment_color}</Badge>
                      )}
                      {(p.ink_colors || []).length > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <Palette className="h-3 w-3" /> {(p.ink_colors || []).join(' / ')}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {p.width_in && p.height_in && <span>{p.width_in}" × {p.height_in}"</span>}
                      {p.mesh_count != null && <span>Mesh {p.mesh_count}</span>}
                      {p.strokes != null && <span>{p.strokes} stroke{p.strokes === 1 ? '' : 's'}</span>}
                      {p.squeegee_durometer != null && <span>{p.squeegee_durometer} duro</span>}
                      {p.underbase && <span>Underbase</span>}
                      {p.flash && <span>Flash</span>}
                      {p.cure_temp != null && <span>Cure {p.cure_temp}°</span>}
                    </div>
                    {p.notes && <p className="mt-1 text-xs italic">{p.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => duplicate.mutate(p.id)} title="Duplicate">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => confirm(`Delete "${p.design_name} • ${p.location}"?`) && remove.mutate(p.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Print' : 'Add Print'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Design Name *</Label>
                <Input
                  value={form.design_name}
                  onChange={(e) => setForm({ ...form, design_name: e.target.value })}
                  placeholder="e.g. Seekins Skull"
                />
              </div>
              <div>
                <Label>Location *</Label>
                <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRINT_LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Width (in)</Label>
                <Input type="number" step="0.25" value={form.width_in}
                  onChange={(e) => setForm({ ...form, width_in: e.target.value })} />
              </div>
              <div>
                <Label>Height (in)</Label>
                <Input type="number" step="0.25" value={form.height_in}
                  onChange={(e) => setForm({ ...form, height_in: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Artwork URL</Label>
              <Input value={form.artwork_url}
                onChange={(e) => setForm({ ...form, artwork_url: e.target.value })}
                placeholder="https://..." />
            </div>

            <div className="border-t pt-3">
              <h4 className="text-sm font-semibold mb-2">Substrate & Inks</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Garment Color</Label>
                  <Input value={form.garment_color}
                    onChange={(e) => setForm({ ...form, garment_color: e.target.value })}
                    placeholder="e.g. Black" />
                </div>
                <div>
                  <Label>Ink Colors (comma-separated)</Label>
                  <Input value={form.ink_colors_text}
                    onChange={(e) => setForm({ ...form, ink_colors_text: e.target.value })}
                    placeholder="White, Grey" />
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <h4 className="text-sm font-semibold mb-2">Screen Setup</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Mesh Count</Label>
                  <Input type="number" value={form.mesh_count}
                    onChange={(e) => setForm({ ...form, mesh_count: e.target.value })} />
                </div>
                <div>
                  <Label>Squeegee Duro</Label>
                  <Input type="number" value={form.squeegee_durometer}
                    onChange={(e) => setForm({ ...form, squeegee_durometer: e.target.value })} />
                </div>
                <div>
                  <Label>Strokes</Label>
                  <Input type="number" value={form.strokes}
                    onChange={(e) => setForm({ ...form, strokes: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="flex items-center justify-between rounded border p-2">
                  <Label className="cursor-pointer">Underbase</Label>
                  <Switch checked={form.underbase}
                    onCheckedChange={(c) => setForm({ ...form, underbase: c })} />
                </div>
                <div className="flex items-center justify-between rounded border p-2">
                  <Label className="cursor-pointer">Flash</Label>
                  <Switch checked={form.flash}
                    onCheckedChange={(c) => setForm({ ...form, flash: c })} />
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <h4 className="text-sm font-semibold mb-2">Flash & Cure</h4>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Flash °F</Label>
                  <Input type="number" value={form.flash_temp}
                    onChange={(e) => setForm({ ...form, flash_temp: e.target.value })} />
                </div>
                <div>
                  <Label>Flash sec</Label>
                  <Input type="number" value={form.flash_time}
                    onChange={(e) => setForm({ ...form, flash_time: e.target.value })} />
                </div>
                <div>
                  <Label>Cure °F</Label>
                  <Input type="number" value={form.cure_temp}
                    onChange={(e) => setForm({ ...form, cure_temp: e.target.value })} />
                </div>
                <div>
                  <Label>Belt sec</Label>
                  <Input type="number" value={form.cure_time}
                    onChange={(e) => setForm({ ...form, cure_time: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}
              disabled={!form.design_name.trim() || create.isPending || update.isPending}>
              {editingId ? 'Save Changes' : 'Add Print'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
