import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useJobs, Job, ServiceType, hasFinancialAccess } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { JobStage, STAGE_ORDER, STAGE_LABELS, useAdvanceStage } from '@/hooks/useJobStages';
import { JobCard } from '@/components/jobs/JobCard';
import { JobForm } from '@/components/jobs/JobForm';
import { KanbanBoard } from '@/components/jobs/KanbanBoard';
import { TimeEntryForm } from '@/components/jobs/TimeEntryForm';
import { TimeEntriesList } from '@/components/jobs/TimeEntriesList';
import { JobTimer } from '@/components/jobs/JobTimer';
import { JobCostSummary } from '@/components/jobs/JobCostSummary';
import { JobPhotoUpload } from '@/components/jobs/JobPhotoUpload';
import { StageProgress } from '@/components/jobs/StageProgress';
import { AdvanceStageButton } from '@/components/jobs/AdvanceStageButton';
import { JobRecipesList } from '@/components/jobs/JobRecipesList';

import { JobGarmentsList } from '@/components/jobs/JobGarmentsList';
import { GarmentSearchDialog } from '@/components/jobs/GarmentSearchDialog';
import { MockupBuilder } from '@/components/jobs/MockupBuilder';
import { JobChecklistPanel } from '@/components/jobs/JobChecklistPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Search, Plus, Phone, Mail, Package, DollarSign, Calendar, LayoutGrid, Columns, Trash2, CreditCard, AlertTriangle, Shirt, Send } from 'lucide-react';
import { getUrgencyLevel, getUrgencyLabel, URGENCY_TEXT_COLORS } from '@/lib/job-urgency';
import { HandoffDialog } from '@/components/handoffs/HandoffDialog';

import { SERVICE_TYPE_LABELS } from '@/lib/constants';

export default function Jobs() {
  const { jobs, isLoading, deleteJob, updateJob } = useJobs();
  const { role } = useAuth();
  const advanceStage = useAdvanceStage();
  const { id: jobIdParam } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'grid'>('kanban');
  const [garmentSearchOpen, setGarmentSearchOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);

  const selectedJobId = jobIdParam ?? null;
  const setSelectedJobId = (id: string | null) => {
    if (id) {
      navigate(`/jobs/${id}`, { replace: true });
    } else {
      navigate('/jobs', { replace: true });
    }
  };

  // Always get fresh job data from the query
  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) ?? null : null;

  const filteredJobs = jobs.filter((job) => {
    const normalizedSearch = search.toLowerCase();
    const matchesSearch =
      job.customer_name.toLowerCase().includes(normalizedSearch) ||
      job.order_number?.toLowerCase().includes(normalizedSearch) ||
      job.invoice_number?.toLowerCase().includes(normalizedSearch) ||
      job.description?.toLowerCase().includes(normalizedSearch);

    const jobStage = ((job as any).stage as JobStage) || 'received';
    const matchesStage =
      stageFilter === 'all' ||
      stageFilter === 'overdue' ||
      stageFilter === 'due_soon' ||
      jobStage === stageFilter;

    // Urgency filters
    if (stageFilter === 'overdue') {
      const urgency = getUrgencyLevel(job.due_date, job.status);
      if (urgency !== 'overdue' && urgency !== 'red') return false;
    }
    if (stageFilter === 'due_soon') {
      const urgency = getUrgencyLevel(job.due_date, job.status);
      if (urgency === 'none' || urgency === 'green') return false;
    }

    return matchesSearch && matchesStage;
  });

  const isCompletedJob = (job: Job) => {
    const stage = (job as any).stage as JobStage | undefined;
    return job.status === 'completed' || stage === 'picked_up' || stage === 'shipped' || stage === 'delivered';
  };

  // Count jobs by status/stage for tabs
  const activeJobs = filteredJobs.filter((job) => !isCompletedJob(job));
  const completedJobs = filteredJobs.filter(isCompletedJob);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", viewMode === 'kanban' && "h-[calc(100vh-2rem)] flex flex-col overflow-hidden")}>
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
            <SelectItem value="overdue" className="text-red-600 font-medium">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Overdue / Urgent
              </span>
            </SelectItem>
            <SelectItem value="due_soon">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Due Soon
              </span>
            </SelectItem>
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
      <Tabs defaultValue="active" className={cn("space-y-4", viewMode === 'kanban' && "flex-1 min-h-0 flex flex-col [&>div[role=tabpanel]]:flex-1 [&>div[role=tabpanel]]:min-h-0")}>
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
            <KanbanBoard jobs={activeJobs} onSelectJob={(job) => setSelectedJobId(job.id)} />
          ) : (
            activeJobs.length === 0 ? (
              <EmptyState message="No active jobs." />
            ) : (
              <JobGrid jobs={activeJobs} onSelect={(job) => setSelectedJobId(job.id)} />
            )
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedJobs.length === 0 ? (
            <EmptyState message="No completed jobs yet." />
          ) : (
            <JobGrid jobs={completedJobs} onSelect={(job) => setSelectedJobId(job.id)} />
          )}
        </TabsContent>
      </Tabs>

      {/* Job Detail Sheet — Printavo-style */}
      <Sheet open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJobId(null)}>
        <SheetContent className="sm:max-w-[66vw] overflow-y-auto p-0">
          {selectedJob && (
            <div className="flex flex-col">
              {/* Header bar */}
              <div className="border-b px-6 py-4 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedJob.order_number && (
                    <Badge variant="outline" className="font-mono text-sm">#{selectedJob.order_number}</Badge>
                  )}
                  {(selectedJob as any).invoice_number && (
                    <Badge variant="secondary" className="font-mono text-sm">INV-{(selectedJob as any).invoice_number}</Badge>
                  )}
                  <Select 
                    value={selectedJob.service_type} 
                    onValueChange={(value: ServiceType) => {
                      updateJob.mutate({ id: selectedJob.id, service_type: value });
                    }}
                  >
                    <SelectTrigger className="h-7 w-auto gap-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Payment status */}
                  {(selectedJob as any).paid_at ? (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30 ml-auto">
                      Paid {new Date((selectedJob as any).paid_at).toLocaleDateString()}
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 text-xs"
                      onClick={() => {
                        updateJob.mutate({ 
                          id: selectedJob.id, 
                          paid_at: new Date().toISOString(),
                        } as any);
                      }}
                    >
                      <CreditCard className="mr-1 h-3 w-3" />
                      Mark Paid
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setHandoffOpen(true)}
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Hand off
                  </Button>
                </div>
                <h2 className="text-xl font-bold">{selectedJob.customer_name}</h2>
              </div>

              {/* Two-column info grid — Printavo style */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-4 border-b">
                {/* Left: Contact & details */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Quantity</p>
                      <p className="font-medium">{selectedJob.quantity}</p>
                    </div>
                    {selectedJob.sale_price && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Sale Price</p>
                        <p className="font-medium">${Number(selectedJob.sale_price).toFixed(2)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Created</p>
                      <p className="font-medium">{new Date(selectedJob.created_at).toLocaleDateString()}</p>
                    </div>
                    {(selectedJob as any).due_date && (() => {
                      const urgency = getUrgencyLevel((selectedJob as any).due_date, selectedJob.status);
                      const label = getUrgencyLabel((selectedJob as any).due_date, selectedJob.status);
                      return (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</p>
                          <p className={cn("font-medium", URGENCY_TEXT_COLORS[urgency])}>
                            {new Date((selectedJob as any).due_date).toLocaleDateString()}
                          </p>
                          <p className={cn("text-xs", URGENCY_TEXT_COLORS[urgency])}>{label}</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Right: Contact info */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Contact</p>
                  {selectedJob.customer_phone && (
                    <a 
                      href={`tel:${selectedJob.customer_phone}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {selectedJob.customer_phone}
                    </a>
                  )}
                  {selectedJob.customer_email && (
                    <a 
                      href={`mailto:${selectedJob.customer_email}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {selectedJob.customer_email}
                    </a>
                  )}
                  {selectedJob.description && (
                    <div className="pt-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Notes</p>
                      <p className="text-sm">{selectedJob.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Stage Progress */}
              <div className="px-6 py-4 border-b">
                <StageProgress 
                  currentStage={(selectedJob as any).stage || 'received'} 
                  onStageClick={(stage) => {
                    advanceStage.mutate({
                      jobId: selectedJob.id,
                      currentStage: (selectedJob as any).stage || 'received',
                      targetStage: stage,
                      source: (selectedJob as any).source,
                      customerName: selectedJob.customer_name,
                      customerEmail: selectedJob.customer_email,
                      orderNumber: selectedJob.order_number,
                    });
                  }}
                />
              </div>

              {/* Garments table — Printavo line-items style */}
              <div className="px-6 py-4 border-b space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Shirt className="h-4 w-4" />
                    Line Items
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGarmentSearchOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <JobGarmentsList jobId={selectedJob.id} />
              </div>

              {/* Garment Search Dialog */}
              <GarmentSearchDialog
                open={garmentSearchOpen}
                onOpenChange={setGarmentSearchOpen}
                jobId={selectedJob.id}
                jobQuantity={selectedJob.quantity}
                jobServiceType={selectedJob.service_type}
              />

              <div className="px-6 py-4 space-y-6">

                {/* Cost Summary - Admin/Manager only */}
                {hasFinancialAccess(role) && <JobCostSummary job={selectedJob} />}

                {/* Time Tracking */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Time Tracking</h4>
                  <JobTimer job={selectedJob} />
                  <TimeEntryForm jobId={selectedJob.id} />
                  <TimeEntriesList jobId={selectedJob.id} />
                </div>

                {/* Production Recipes */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Production Recipes</h4>
                  <JobRecipesList jobId={selectedJob.id} />
                </div>

                {/* Photos */}
                <JobPhotoUpload 
                  jobId={selectedJob.id} 
                  customerEmail={selectedJob.customer_email}
                  customerName={selectedJob.customer_name}
                  orderNumber={selectedJob.order_number}
                />

                {/* Checklists */}
                <JobChecklistPanel jobId={selectedJob.id} serviceType={selectedJob.service_type} />

                {/* Mockup Builder */}
                <MockupBuilder
                  jobId={selectedJob.id}
                  customerEmail={selectedJob.customer_email}
                  customerName={selectedJob.customer_name}
                  orderNumber={selectedJob.order_number}
                />

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
                            setSelectedJobId(null);
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
            </div>
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
