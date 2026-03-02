import { useState, useEffect } from 'react';
import { ActionItem } from '@/hooks/useActionItems';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Save, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { QuoteLineItemsSummary } from './QuoteLineItemsSummary';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface ActionItemDetailSheetProps {
  item: ActionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<ActionItem>) => void;
}

export function ActionItemDetailSheet({ item, open, onOpenChange, onSave }: ActionItemDetailSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [priority, setPriority] = useState<string>('normal');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newStep, setNewStep] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || '');
      setCustomerName(item.customer_name || '');
      setPriority(item.priority || 'normal');
      setDueDate(item.due_date ? format(new Date(item.due_date), 'yyyy-MM-dd') : '');
      setNotes((item as any).notes || '');
      setChecklist(Array.isArray((item as any).checklist) ? (item as any).checklist : []);
      setDirty(false);
    }
  }, [item]);

  const markDirty = () => setDirty(true);

  const handleAddStep = () => {
    if (!newStep.trim()) return;
    setChecklist(prev => [...prev, { id: crypto.randomUUID(), text: newStep.trim(), done: false }]);
    setNewStep('');
    markDirty();
  };

  const handleToggleStep = (id: string) => {
    setChecklist(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));
    markDirty();
  };

  const handleRemoveStep = (id: string) => {
    setChecklist(prev => prev.filter(s => s.id !== id));
    markDirty();
  };

  const handleUpdateStepText = (id: string, text: string) => {
    setChecklist(prev => prev.map(s => s.id === id ? { ...s, text } : s));
    markDirty();
  };

  const handleSave = () => {
    if (!item || !title.trim()) return;
    onSave(item.id, {
      title: title.trim(),
      description: description.trim() || null,
      customer_name: customerName.trim() || null,
      priority: priority as ActionItem['priority'],
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      notes: notes.trim() || null,
      checklist: checklist,
    } as any);
    setDirty(false);
    toast.success('Action item updated');
  };

  if (!item) return null;

  const completedSteps = checklist.filter(s => s.done).length;
  const totalSteps = checklist.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Edit Action Item
            {item.source !== 'manual' && (
              <Badge variant="outline" className="text-xs">{item.source}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ai-title">Title</Label>
            <Input
              id="ai-title"
              value={title}
              onChange={e => { setTitle(e.target.value); markDirty(); }}
            />
          </div>

          {/* Customer */}
          <div className="space-y-1.5">
            <Label htmlFor="ai-customer">Customer</Label>
            <Input
              id="ai-customer"
              value={customerName}
              onChange={e => { setCustomerName(e.target.value); markDirty(); }}
              placeholder="Optional"
            />
          </div>

          {/* Priority + Due Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => { setPriority(v); markDirty(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-due">Due Date</Label>
              <Input
                id="ai-due"
                type="date"
                value={dueDate}
                onChange={e => { setDueDate(e.target.value); markDirty(); }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ai-desc">Description</Label>
            <Textarea
              id="ai-desc"
              value={description}
              onChange={e => { setDescription(e.target.value); markDirty(); }}
              placeholder="Details, context, requirements..."
              rows={3}
            />
          </div>

          {/* Quote Details */}
          {item.quote_id && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-base font-semibold">Quote Details</Label>
                <QuoteLineItemsSummary quoteId={item.quote_id} compact={false} />
              </div>
            </>
          )}

          <Separator />

          {/* Checklist / Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                Steps / Checklist
              </Label>
              {totalSteps > 0 && (
                <span className="text-xs text-muted-foreground">
                  {completedSteps}/{totalSteps} done
                </span>
              )}
            </div>

            {totalSteps > 0 && (
              <div className="w-full bg-muted/30 rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {checklist.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5 group"
                >
                  <Checkbox
                    checked={step.done}
                    onCheckedChange={() => handleToggleStep(step.id)}
                  />
                  <Input
                    value={step.text}
                    onChange={e => handleUpdateStepText(step.id, e.target.value)}
                    className={cn(
                      'border-0 shadow-none h-7 px-1 focus-visible:ring-0',
                      step.done && 'line-through text-muted-foreground'
                    )}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemoveStep(step.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={newStep}
                onChange={e => setNewStep(e.target.value)}
                placeholder="Add a step..."
                className="h-8"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep(); } }}
              />
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={handleAddStep} disabled={!newStep.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ai-notes">Notes / Challenges</Label>
            <Textarea
              id="ai-notes"
              value={notes}
              onChange={e => { setNotes(e.target.value); markDirty(); }}
              placeholder="Log challenges, updates, or decisions..."
              rows={4}
            />
          </div>

          {/* Save */}
          <Button onClick={handleSave} disabled={!dirty || !title.trim()} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
