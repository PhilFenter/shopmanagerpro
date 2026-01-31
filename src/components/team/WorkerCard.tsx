import { Worker } from '@/hooks/useWorkers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface WorkerCardProps {
  worker: Worker;
  onUpdate: (worker: Worker, updates: Partial<Worker>) => void;
  onDelete: (id: string) => void;
  formatCurrency: (value: number) => string;
}

export function WorkerCard({ worker, onUpdate, onDelete, formatCurrency }: WorkerCardProps) {
  return (
    <div className={`p-4 border rounded-lg space-y-4 ${!worker.is_active ? 'opacity-50' : ''}`}>
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Input
            value={worker.name}
            onChange={(e) => onUpdate(worker, { name: e.target.value })}
            className="font-medium w-48"
          />
          {!worker.is_active && <Badge variant="secondary">Inactive</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Active</Label>
            <Switch
              checked={worker.is_active}
              onCheckedChange={(checked) => onUpdate(worker, { is_active: checked })}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(worker.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Pay Settings Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Salary</Label>
            <Switch
              checked={worker.is_salary}
              onCheckedChange={(checked) => onUpdate(worker, { is_salary: checked })}
            />
          </div>
        </div>

        {worker.is_salary ? (
          <div className="space-y-1">
            <Label className="text-xs">Monthly Salary</Label>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1">$</span>
              <Input
                type="number"
                value={worker.monthly_salary || ''}
                onChange={(e) => onUpdate(worker, { monthly_salary: parseFloat(e.target.value) || 0 })}
                className="h-8"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs">Hourly Rate</Label>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1">$</span>
              <Input
                type="number"
                step="0.01"
                value={worker.hourly_rate || ''}
                onChange={(e) => onUpdate(worker, { hourly_rate: parseFloat(e.target.value) || 0 })}
                className="h-8"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Weekly Hours</Label>
          <Input
            type="number"
            value={worker.weekly_hours || 40}
            onChange={(e) => onUpdate(worker, { weekly_hours: parseFloat(e.target.value) || 40 })}
            className="h-8"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Monthly Cost</Label>
          <div className="h-8 flex items-center text-sm font-medium">
            {formatCurrency(
              worker.is_salary 
                ? (worker.monthly_salary || 0)
                : (worker.hourly_rate || 0) * (worker.weekly_hours || 40) * 4.33
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
