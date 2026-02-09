import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useWorkers, Worker } from '@/hooks/useWorkers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WorkerCard } from '@/components/team/WorkerCard';
import { OverheadSection } from '@/components/team/OverheadSection';
import { CostDashboard } from '@/components/team/CostDashboard';

export default function Team() {
  const { role, loading } = useAuth();
  const { workers, isLoading, createWorker, updateWorker, deleteWorker } = useWorkers();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
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

  const handleDelete = (id: string) => {
    deleteWorker.mutate(id);
  };

  const formatCurrency = (value: number) => 
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team & Costs</h1>
        <p className="text-muted-foreground">Manage workers, overhead, and see your cost breakdown</p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="overhead">Overhead</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <CostDashboard />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Team Member
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
                    Add Team Member
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Set hourly rates or salaries to calculate labor costs for job costing.
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
                    <WorkerCard
                      key={worker.id}
                      worker={worker}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overhead">
          <OverheadSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
