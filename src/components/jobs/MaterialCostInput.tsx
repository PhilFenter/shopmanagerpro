import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useJobs } from '@/hooks/useJobs';
import { Check, X, Loader2, DollarSign } from 'lucide-react';

interface MaterialCostInputProps {
  jobId: string;
  currentValue: number | null | undefined;
}

export function MaterialCostInput({ jobId, currentValue }: MaterialCostInputProps) {
  const { updateJob } = useJobs();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentValue?.toString() ?? '');

  useEffect(() => {
    setValue(currentValue?.toString() ?? '');
  }, [currentValue]);

  const handleSave = () => {
    const numValue = parseFloat(value) || 0;
    updateJob.mutate(
      { id: jobId, material_cost: numValue },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const handleCancel = () => {
    setValue(currentValue?.toString() ?? '');
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Material Cost</Label>
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 px-3 py-2 w-full text-left rounded-md border border-dashed border-muted-foreground/30 hover:border-primary hover:bg-muted/50 transition-colors"
        >
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          {currentValue ? (
            <span className="font-medium">${Number(currentValue).toFixed(2)}</span>
          ) : (
            <span className="text-muted-foreground">Add material cost...</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Material Cost</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            className="pl-9"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSave}
          disabled={updateJob.isPending}
        >
          {updateJob.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 text-primary" />
          )}
        </Button>
        <Button size="icon" variant="ghost" onClick={handleCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
