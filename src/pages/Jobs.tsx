import { useState } from 'react';
import { useJobs, Job, ServiceType } from '@/hooks/useJobs';
import { JobStage, STAGE_ORDER, STAGE_LABELS } from '@/hooks/useJobStages';
import { JobCard } from '@/components/jobs/JobCard';
import { JobForm } from '@/components/jobs/JobForm';
import { KanbanBoard } from '@/components/jobs/KanbanBoard';
import { TimeEntryForm } from '@/components/jobs/TimeEntryForm';
import { TimeEntriesList } from '@/components/jobs/TimeEntriesList';
import { JobCostSummary } from '@/components/jobs/JobCostSummary';
import { JobPhotoUpload } from '@/components/jobs/JobPhotoUpload';
import { StageProgress } from '@/components/jobs/StageProgress';
import { AdvanceStageButton } from '@/components/jobs/AdvanceStageButton';
import { JobRecipesList } from '@/components/jobs/JobRecipesList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Search, Plus, Phone, Mail, Package, DollarSign, Calendar, LayoutGrid, Columns, Trash2 } from 'lucide-react';

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF',
  leather_patch: 'Leather',
  other: 'Other',
};

export default function Jobs() {
  const { jobs, isLoading, deleteJob } = useJobs();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'grid'>('kanban');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = 
      job.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      job.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      job.description?.toLowerCase().includes(search.toLowerCase());
    
    const jobStage = (job as any).stage as JobStage || 'received';
    const matchesStage = stageFilter === 'all' || jobStage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

  // Count jobs by stage for tabs
  const activeJobs = filteredJobs.filter(j => {
    const stage = (j as any).stage as JobStage;
    return stage && stage !== 'picked_up' && stage !== 'shipped';
  });
  const completedJobs = filteredJobs.filter(j => {
    const stage = (j as any).stage as JobStage;
    return stage === 'picked_up' || stage === 'shipped';
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">Manage and track all production jobs</p>
        </div>
        <JobForm />
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by customer, order #, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGE_ORDER.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* View Toggle */}
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
            className="rounded-r-none"
          >
            <Columns className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-l-none"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Active {activeJobs.length > 0 && `(${activeJobs.length})`}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed {completedJobs.length > 0 && `(${completedJobs.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {viewMode === 'kanban' ? (
            <KanbanBoard jobs={activeJobs} onSelectJob={setSelectedJob} />
          ) : (
            activeJobs.length === 0 ? (
              <EmptyState message="No active jobs." />
            ) : (
              <JobGrid jobs={activeJobs} onSelect={setSelectedJob} />
            )
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedJobs.length === 0 ? (
            <EmptyState message="No completed jobs yet." />
          ) : (
            <JobGrid jobs={completedJobs} onSelect={setSelectedJob} />
          )}
        </TabsContent>
      </Tabs>

      {/* Job Detail Sheet */}
      <Sheet open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedJob && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  {selectedJob.order_number && (
                    <Badge variant="outline">#{selectedJob.order_number}</Badge>
                  )}
                  <Badge variant="secondary">
                    {SERVICE_TYPE_LABELS[selectedJob.service_type]}
                  </Badge>
                </div>
                <SheetTitle className="text-left">{selectedJob.customer_name}</SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Stage Progress */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Job Progress</h4>
                  <StageProgress currentStage={(selectedJob as any).stage || 'received'} />
                  <AdvanceStageButton 
                    jobId={selectedJob.id} 
                    currentStage={(selectedJob as any).stage || 'received'} 
                  />
                </div>

                {/* Time Tracking */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Time Tracking</h4>
                  <TimeEntryForm jobId={selectedJob.id} />
                  <TimeEntriesList jobId={selectedJob.id} />
                </div>

                {/* Production Recipes */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Production Recipes</h4>
                  <JobRecipesList jobId={selectedJob.id} />
                </div>

                {/* Cost Summary */}
                <JobCostSummary job={selectedJob} />

                {/* Photos */}
                <JobPhotoUpload jobId={selectedJob.id} />
                {selectedJob.description && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Description</h4>
                    <p className="text-sm text-muted-foreground">{selectedJob.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Quantity</p>
                      <p className="font-medium">{selectedJob.quantity}</p>
                    </div>
                  </div>
                  
                  {selectedJob.sale_price && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Sale Price</p>
                        <p className="font-medium">${Number(selectedJob.sale_price).toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {(selectedJob.customer_phone || selectedJob.customer_email) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Contact Info</h4>
                    {selectedJob.customer_phone && (
                      <a 
                        href={`tel:${selectedJob.customer_phone}`}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Phone className="h-4 w-4" />
                        {selectedJob.customer_phone}
                      </a>
                    )}
                    {selectedJob.customer_email && (
                      <a 
                        href={`mailto:${selectedJob.customer_email}`}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Mail className="h-4 w-4" />
                        {selectedJob.customer_email}
                      </a>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Created {new Date(selectedJob.created_at).toLocaleDateString()}
                </div>

                {/* Delete Job */}
                <div className="pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Job
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{selectedJob.customer_name}" 
                          {selectedJob.order_number && ` (#${selectedJob.order_number})`} 
                          and all associated time entries, photos, and recipes. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => {
                            deleteJob.mutate(selectedJob.id);
                            setSelectedJob(null);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function JobGrid({ jobs, onSelect }: { jobs: Job[]; onSelect: (job: Job) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onClick={() => onSelect(job)} />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-muted-foreground">{message}</p>
      <JobForm 
        trigger={
          <Button className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        }
      />
    </div>
  );
}
