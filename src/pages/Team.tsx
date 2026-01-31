import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useWorkers, Worker } from '@/hooks/useWorkers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2, User, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function Team() {
  const { role, loading } = useAuth();
  const { workers, isLoading, monthlyLaborCost, totalMonthlyHours, createWorker, updateWorker, deleteWorker } = useWorkers();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const handleAddWorker = () => {
    if (!newName.trim()) return;
    createWorker.mutate({ name: newName.trim() });
    setNewName('');
    setIsAddOpen(false);
  };

  const handleUpdate = (worker: Worker, updates: Partial<Worker>) => {
    updateWorker.mutate({ id: worker.id, ...updates });
  };

  const formatCurrency = (value: number) => 
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">Manage workers and pay rates for labor cost calculations</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Worker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Enter name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddWorker()}
                />
              </div>
              <Button onClick={handleAddWorker} disabled={!newName.trim()} className="w-full">
                Add Worker
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workers.filter(w => w.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Labor</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthlyLaborCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMonthlyHours.toFixed(0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Workers List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Set hourly rates or salaries to calculate labor costs for job costing and break-even tracking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : workers.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No workers yet. Add your team to track labor costs.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workers.map((worker) => (
                <div
                  key={worker.id}
                  className={`p-4 border rounded-lg space-y-4 ${!worker.is_active ? 'opacity-50' : ''}`}
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Input
                        value={worker.name}
                        onChange={(e) => handleUpdate(worker, { name: e.target.value })}
                        className="font-medium w-48"
                      />
                      {!worker.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground">Active</Label>
                        <Switch
                          checked={worker.is_active}
                          onCheckedChange={(checked) => handleUpdate(worker, { is_active: checked })}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteWorker.mutate(worker.id)}
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
                          onCheckedChange={(checked) => handleUpdate(worker, { is_salary: checked })}
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
                            onChange={(e) => handleUpdate(worker, { monthly_salary: parseFloat(e.target.value) || 0 })}
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
                            onChange={(e) => handleUpdate(worker, { hourly_rate: parseFloat(e.target.value) || 0 })}
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
                        onChange={(e) => handleUpdate(worker, { weekly_hours: parseFloat(e.target.value) || 40 })}
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
