import { useMemo, useState } from 'react';
import { useRecipeTemplates, RecipeTemplate, RecipeTemplateInput } from '@/hooks/useRecipeTemplates';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BookOpen, Search, Trash2 } from 'lucide-react';

const canManage = (role: string | null | undefined) => role === 'admin' || role === 'manager';

function qtyLabel(t: RecipeTemplate) {
  if (t.min_qty != null && t.max_qty != null) return `${t.min_qty}–${t.max_qty} pcs`;
  if (t.min_qty != null) return `${t.min_qty}+ pcs`;
  if (t.max_qty != null) return `up to ${t.max_qty} pcs`;
  return null;
}

interface LibraryProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  serviceType?: string;
  /** Optional current job quantity, used to highlight matching templates */
  quantity?: number | null;
  onApply: (template: RecipeTemplate) => void;
}

export function RecipeTemplateLibraryDialog({
  open,
  onOpenChange,
  serviceType = 'screen_print',
  quantity,
  onApply,
}: LibraryProps) {
  const { role } = useAuth();
  const { templates, isLoading, remove } = useRecipeTemplates(serviceType);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) =>
      [t.name, t.description, t.ink_color, t.garment_color, t.notes]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [templates, search]);

  const matchesQty = (t: RecipeTemplate) =>
    quantity != null &&
    (t.min_qty == null || quantity >= t.min_qty) &&
    (t.max_qty == null || quantity <= t.max_qty);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Standard Recipe Library
          </DialogTitle>
          <DialogDescription>
            Pick a proven standard setup (ink color, garment color, run size) and apply it to this print.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search e.g. black on safety yellow, white under 75…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1 max-h-[55vh] pr-3">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No standard recipes yet. Dial in a setup, then use “Save to Library”.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className={
                    'rounded-lg border p-3 ' + (matchesQty(t) ? 'border-primary/60 bg-primary/5' : '')
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{t.name}</span>
                        {matchesQty(t) && <Badge>Matches run size</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {t.ink_color && <Badge variant="secondary">{t.ink_color} ink</Badge>}
                        {t.garment_color && <Badge variant="outline">on {t.garment_color}</Badge>}
                        {qtyLabel(t) && <Badge variant="outline">{qtyLabel(t)}</Badge>}
                        {t.screens != null && <Badge variant="outline">{t.screens} screen{t.screens === 1 ? '' : 's'}</Badge>}
                        {t.strokes != null && <Badge variant="outline">{t.strokes} stroke{t.strokes === 1 ? '' : 's'}</Badge>}
                        <Badge variant="outline">{t.rotations} rotation{t.rotations === 1 ? '' : 's'}</Badge>
                        {t.use_flash && <Badge variant="outline">Flash</Badge>}
                        {t.use_stampinator && <Badge variant="outline">Stamp</Badge>}
                        {t.low_cure && <Badge variant="outline">Low cure</Badge>}
                      </div>
                      {t.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                      )}
                      {(t.dryer_temp_1 != null || t.dryer_temp_2 != null || t.belt_speed != null) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.dryer_temp_1 != null && <>Dryer 1: {t.dryer_temp_1}°C </>}
                          {t.dryer_temp_2 != null && <>Dryer 2: {t.dryer_temp_2}°C </>}
                          {t.belt_speed != null && <>Belt: {t.belt_speed}</>}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          onApply(t);
                          onOpenChange(false);
                        }}
                      >
                        Use
                      </Button>
                      {canManage(role) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Remove from library"
                          onClick={() => confirm(`Remove "${t.name}" from the library?`) && remove.mutate(t.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface SaveProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  serviceType?: string;
  /** Snapshot of the current press setup + environment */
  buildPayload: () => Omit<RecipeTemplateInput, 'name'>;
  defaultName?: string;
}

export function SaveRecipeTemplateDialog({
  open,
  onOpenChange,
  serviceType = 'screen_print',
  buildPayload,
  defaultName = '',
}: SaveProps) {
  const { create } = useRecipeTemplates(serviceType);
  const [form, setForm] = useState({
    name: defaultName,
    description: '',
    ink_color: '',
    garment_color: '',
    min_qty: '',
    max_qty: '',
    screens: '',
    strokes: '',
    low_cure: false,
  });

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    await create.mutateAsync({
      ...buildPayload(),
      service_type: serviceType,
      name: form.name.trim(),
      description: form.description || null,
      ink_color: form.ink_color || null,
      garment_color: form.garment_color || null,
      min_qty: num(form.min_qty),
      max_qty: num(form.max_qty),
      screens: num(form.screens),
      strokes: num(form.strokes),
      low_cure: form.low_cure,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save to Recipe Library</DialogTitle>
          <DialogDescription>
            Saves the current press setup, dryer settings and rotations as a reusable standard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Black on Safety Yellow — 1 rotation"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ink Color</Label>
              <Input
                value={form.ink_color}
                onChange={(e) => setForm({ ...form, ink_color: e.target.value })}
                placeholder="Black"
              />
            </div>
            <div>
              <Label>Garment Color</Label>
              <Input
                value={form.garment_color}
                onChange={(e) => setForm({ ...form, garment_color: e.target.value })}
                placeholder="Safety Yellow"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Min Qty</Label>
              <Input
                type="number"
                value={form.min_qty}
                onChange={(e) => setForm({ ...form, min_qty: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Max Qty</Label>
              <Input
                type="number"
                value={form.max_qty}
                onChange={(e) => setForm({ ...form, max_qty: e.target.value })}
                placeholder="75"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Screens</Label>
              <Input
                type="number"
                value={form.screens}
                onChange={(e) => setForm({ ...form, screens: e.target.value })}
                placeholder="1"
              />
            </div>
            <div>
              <Label>Strokes</Label>
              <Input
                type="number"
                value={form.strokes}
                onChange={(e) => setForm({ ...form, strokes: e.target.value })}
                placeholder="2"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Low cure ink</Label>
              <p className="text-xs text-muted-foreground">Keeps dryer temps down to avoid scorching.</p>
            </div>
            <Switch
              checked={form.low_cure}
              onCheckedChange={(v) => setForm({ ...form, low_cure: v })}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="One rotation, print 2 strokes, flash, no stamp."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || create.isPending}>
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
