import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { useOverheadItems } from '@/hooks/useOverheadItems';

export function OverheadSettings() {
  const { items, isLoading, totalMonthlyOverhead, createItem, updateItem, deleteItem } = useOverheadItems();
  const [newName, setNewName] = useState('');
  const [newCost, setNewCost] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    createItem.mutate({
      name: newName.trim(),
      monthly_cost: parseFloat(newCost) || 0,
      category: null,
      notes: null,
    });
    setNewName('');
    setNewCost('');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Overhead</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Overhead</CardTitle>
        <CardDescription>
          Fixed monthly costs like rent, utilities, insurance. These are allocated hourly across jobs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new item form */}
        <div className="flex gap-2">
          <Input
            placeholder="Item name (e.g., Rent)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <div className="flex items-center w-32">
            <span className="text-muted-foreground mr-1">$</span>
            <Input
              type="number"
              placeholder="0"
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <Button onClick={handleAdd} disabled={!newName.trim() || createItem.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* List of items */}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No overhead items yet. Add rent, utilities, insurance, etc.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-3 border rounded-lg"
              >
                <Input
                  value={item.name}
                  onChange={(e) => updateItem.mutate({ id: item.id, name: e.target.value })}
                  className="flex-1 h-8"
                />
                <div className="flex items-center w-28">
                  <span className="text-muted-foreground mr-1">$</span>
                  <Input
                    type="number"
                    value={item.monthly_cost || ''}
                    onChange={(e) => updateItem.mutate({ id: item.id, monthly_cost: parseFloat(e.target.value) || 0 })}
                    className="h-8"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => deleteItem.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center pt-4 border-t font-medium">
          <span>Total Monthly Overhead</span>
          <span className="text-lg">${totalMonthlyOverhead.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
