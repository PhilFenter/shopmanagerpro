import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useJobs } from '@/hooks/useJobs';
import { Plus, Trash2, Loader2, DollarSign } from 'lucide-react';

const COST_CATEGORIES = [
  { value: 'garments', label: 'Garments' },
  { value: 'digitizing', label: 'Digitizing' },
  { value: 'art', label: 'Art/Design' },
  { value: 'blanks', label: 'Blanks' },
  { value: 'ink', label: 'Ink/Thread' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'other', label: 'Other' },
] as const;

interface CostItem {
  id: string;
  category: string;
  description: string;
  amount: number;
}

interface MaterialCostInputProps {
  jobId: string;
  currentValue: number | null | undefined;
}

// Parse stored material_cost into structured items (stored as JSON string in description or simple number)
function parseCostItems(value: number | null | undefined): CostItem[] {
  // For now, if there's a simple number value with no structured data, show it as a single "other" item
  if (value && value > 0) {
    return [{
      id: crypto.randomUUID(),
      category: 'other',
      description: 'Material cost',
      amount: value,
    }];
  }
  return [];
}

export function MaterialCostInput({ jobId, currentValue }: MaterialCostInputProps) {
  const { updateJob } = useJobs();
  const [items, setItems] = useState<CostItem[]>(() => parseCostItems(currentValue));
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<CostItem>>({
    category: 'garments',
    description: '',
    amount: 0,
  });

  const totalCost = items.reduce((sum, item) => sum + item.amount, 0);

  const saveItems = (updatedItems: CostItem[]) => {
    const total = updatedItems.reduce((sum, item) => sum + item.amount, 0);
    updateJob.mutate({ id: jobId, material_cost: total });
  };

  const handleAddItem = () => {
    if (!newItem.amount || newItem.amount <= 0) return;
    
    const item: CostItem = {
      id: crypto.randomUUID(),
      category: newItem.category || 'other',
      description: newItem.description || COST_CATEGORIES.find(c => c.value === newItem.category)?.label || 'Other',
      amount: newItem.amount,
    };
    
    const updatedItems = [...items, item];
    setItems(updatedItems);
    saveItems(updatedItems);
    setNewItem({ category: 'garments', description: '', amount: 0 });
    setIsAdding(false);
  };

  const handleRemoveItem = (id: string) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    saveItems(updatedItems);
  };

  const getCategoryLabel = (value: string) => {
    return COST_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Material Costs
        </Label>
        <span className="text-sm font-medium">
          Total: ${totalCost.toFixed(2)}
        </span>
      </div>

      {/* Existing items */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center justify-between gap-2 p-2 rounded bg-background border"
            >
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">
                  {getCategoryLabel(item.category)}
                </span>
                {item.description && item.description !== getCategoryLabel(item.category) && (
                  <p className="text-sm truncate">{item.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-sm">${item.amount.toFixed(2)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleRemoveItem(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new item form */}
      {isAdding ? (
        <div className="space-y-2 p-3 rounded border-2 border-dashed border-primary/30 bg-primary/5">
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={newItem.category}
              onValueChange={(value) => setNewItem({ ...newItem, category: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {COST_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={newItem.amount || ''}
                onChange={(e) => setNewItem({ ...newItem, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="h-9 pl-7"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddItem();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
            </div>
          </div>
          <Input
            value={newItem.description || ''}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            placeholder="Description (optional)"
            className="h-9"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAddItem}
              disabled={!newItem.amount || newItem.amount <= 0 || updateJob.isPending}
              className="flex-1"
            >
              {updateJob.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Add Cost'
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Cost Item
        </Button>
      )}
    </div>
  );
}
