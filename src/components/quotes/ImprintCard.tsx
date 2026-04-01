import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, X, Check } from 'lucide-react';
import { DECORATION_TYPES, type QuoteImprint } from '@/hooks/useQuoteImprints';

interface ImprintCardProps {
  imprint: QuoteImprint;
  index: number;
  onUpdate: (id: string, updates: Partial<QuoteImprint>) => void;
  onDelete: (id: string) => void;
}

const DECORATION_BADGE_COLORS: Record<string, string> = {
  screen_print: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  dtf: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  embroidery: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  leather_patch: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  uv_patch: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  vinyl: 'bg-pink-500/15 text-pink-700 dark:text-pink-400',
  other: 'bg-muted text-muted-foreground',
};

export function ImprintCard({ imprint, index, onUpdate, onDelete }: ImprintCardProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    decoration_type: imprint.decoration_type,
    column_value: imprint.column_value || '',
    placement: imprint.placement || '',
    description: imprint.description || '',
  });

  const decoLabel = DECORATION_TYPES.find(d => d.value === imprint.decoration_type)?.label || imprint.decoration_type;
  const badgeColor = DECORATION_BADGE_COLORS[imprint.decoration_type] || DECORATION_BADGE_COLORS.other;

  const handleSave = () => {
    onUpdate(imprint.id, {
      decoration_type: form.decoration_type,
      column_value: form.column_value || null,
      placement: form.placement || null,
      description: form.description || null,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Edit Imprint #{index + 1}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Decoration Type</Label>
              <Select value={form.decoration_type} onValueChange={v => setForm(f => ({ ...f, decoration_type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DECORATION_TYPES.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Column / Variant</Label>
              <Input
                value={form.column_value}
                onChange={e => setForm(f => ({ ...f, column_value: e.target.value }))}
                placeholder="e.g. 1 color, 4x4, 8000 stitches"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Placement</Label>
              <Input
                value={form.placement}
                onChange={e => setForm(f => ({ ...f, placement: e.target.value }))}
                placeholder="e.g. Left Chest, Back Print"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Additional details"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const details = [
    form.column_value || imprint.column_value,
    imprint.description,
  ].filter(Boolean).join(' · ');

  return (
    <Card className="hover:border-primary/20 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                IMPRINT #{index + 1}
              </span>
              <Badge className={badgeColor} variant="secondary">
                {decoLabel}
              </Badge>
            </div>
            {details && (
              <p className="text-sm font-medium">{details}</p>
            )}
            {imprint.placement && (
              <p className="text-sm text-muted-foreground">{imprint.placement}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
              setForm({
                decoration_type: imprint.decoration_type,
                column_value: imprint.column_value || '',
                placement: imprint.placement || '',
                description: imprint.description || '',
              });
              setEditing(true);
            }}>
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(imprint.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
