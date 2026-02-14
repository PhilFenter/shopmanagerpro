import { useState } from 'react';
import { Job } from '@/hooks/useJobs';
import { JobStage, STAGE_ORDER, STAGE_LABELS, STAGE_ICONS, FINAL_STAGES, useAdvanceStage, getNextStage, isAtFinalChoice, isFinalStage } from '@/hooks/useJobStages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Loader2, ShoppingBag, Printer, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
}

const SERVICE_TYPE_COLORS: Record<string, string> = {
  embroidery: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  screen_print: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  dtf: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  leather_patch: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  shopify: { label: 'Shopify', icon: <ShoppingBag className="h-3 w-3" />, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  printavo: { label: 'Printavo', icon: <Printer className="h-3 w-3" />, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  manual: { label: 'Manual', icon: <FileText className="h-3 w-3" />, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

type SourceFilter = 'all' | 'printavo' | 'shopify' | 'manual';

// All stages to display in kanban (main + final)
const ALL_KANBAN_STAGES: JobStage[] = [...STAGE_ORDER, ...FINAL_STAGES];

export function KanbanBoard({ jobs, onSelectJob }: KanbanBoardProps) {
  const advanceStage = useAdvanceStage();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Filter jobs by source
  const filteredJobs = jobs.filter(job => {
    if (sourceFilter === 'all') return true;
    const jobSource = (job as any).source || 'manual';
    if (sourceFilter === 'manual') return !jobSource || jobSource === 'manual';
    return jobSource === sourceFilter;
  });

  // Count jobs by source for tab badges
  const sourceCounts = {
    all: jobs.length,
    printavo: jobs.filter(j => (j as any).source === 'printavo').length,
    shopify: jobs.filter(j => (j as any).source === 'shopify').length,
    manual: jobs.filter(j => !(j as any).source || (j as any).source === 'manual').length,
  };

  // Group jobs by stage and sort by order number descending (newest first)
  const jobsByStage = ALL_KANBAN_STAGES.reduce((acc, stage) => {
    acc[stage] = filteredJobs
      .filter(job => (job as any).stage === stage)
      .sort((a, b) => {
        // Extract numeric part of order number for proper sorting
        const numA = a.order_number ? parseInt(a.order_number.replace(/\D/g, ''), 10) || 0 : 0;
        const numB = b.order_number ? parseInt(b.order_number.replace(/\D/g, ''), 10) || 0 : 0;
        return numB - numA; // Descending (newest/highest first)
      });
    return acc;
  }, {} as Record<JobStage, Job[]>);

  return (
    <div className="space-y-4">
      {/* Source Filter Tabs */}
      <Tabs value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all" className="gap-2">
            All
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">{sourceCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="printavo" className="gap-2">
            <Printer className="h-3.5 w-3.5" />
            Printavo
            {sourceCounts.printavo > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">{sourceCounts.printavo}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="shopify" className="gap-2">
            <ShoppingBag className="h-3.5 w-3.5" />
            Shopify
            {sourceCounts.shopify > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">{sourceCounts.shopify}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <FileText className="h-3.5 w-3.5" />
            Manual
            {sourceCounts.manual > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">{sourceCounts.manual}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
        {ALL_KANBAN_STAGES.map((stage) => (
          <div 
            key={stage} 
            className={cn(
              "flex-shrink-0",
              isFinalStage(stage) ? "w-64" : "w-80"
            )}
          >
            <div className={cn(
              "bg-muted/50 rounded-lg p-3 h-full min-h-[400px]",
              isFinalStage(stage) && "bg-primary/10"
            )}>
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                <span className="text-lg">{STAGE_ICONS[stage]}</span>
                <h3 className="font-semibold text-sm">{STAGE_LABELS[stage]}</h3>
                <Badge variant="secondary" className="ml-auto">
                  {jobsByStage[stage].length}
                </Badge>
              </div>

              {/* Job Cards */}
              <div className="space-y-3">
                {jobsByStage[stage].map((job) => (
                  <KanbanCard 
                    key={job.id} 
                    job={job} 
                    stage={stage}
                    onSelect={() => onSelectJob(job)}
                    onAdvance={(targetStage) => advanceStage.mutate({ 
                      jobId: job.id, 
                      currentStage: stage,
                      targetStage 
                    })}
                    isAdvancing={advanceStage.isPending}
                  />
                ))}

                {jobsByStage[stage].length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No jobs
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
    </div>
  );
}

interface KanbanCardProps {
  job: Job;
  stage: JobStage;
  onSelect: () => void;
  onAdvance: (targetStage?: JobStage) => void;
  isAdvancing: boolean;
}

function KanbanCard({ job, stage, onSelect, onAdvance, isAdvancing }: KanbanCardProps) {
  const nextStage = getNextStage(stage);
  const atFinalChoice = isAtFinalChoice(stage);
  const atFinalStage = isFinalStage(stage);
  const jobSource = (job as any).source || 'manual';
  const sourceInfo = SOURCE_CONFIG[jobSource] || SOURCE_CONFIG.manual;

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onSelect}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium line-clamp-1">
            {job.customer_name}
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            {/* Source badge */}
            <Badge 
              variant="outline" 
              className={cn("text-[10px] px-1.5 py-0 h-5 gap-1", sourceInfo.color)}
            >
              {sourceInfo.icon}
            </Badge>
            {job.order_number && (
              <Badge variant="outline" className="text-xs">
                #{job.order_number}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <Badge 
          variant="secondary" 
          className={cn("text-xs", SERVICE_TYPE_COLORS[job.service_type])}
        >
          {job.service_type.replace('_', ' ')}
        </Badge>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Qty: {job.quantity}</span>
          {job.sale_price && (
            <span>${Number(job.sale_price).toFixed(2)}</span>
          )}
        </div>

        {/* Show final stage options at customer_notified */}
        {atFinalChoice && (
          <div className="flex gap-1 mt-2">
            {FINAL_STAGES.map((finalStage) => (
              <Button
                key={finalStage}
                size="sm"
                variant="ghost"
                className="flex-1 h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdvance(finalStage);
                }}
                disabled={isAdvancing}
              >
                {isAdvancing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    {STAGE_ICONS[finalStage]}
                  </>
                )}
              </Button>
            ))}
          </div>
        )}

        {/* Normal next stage button */}
        {nextStage && !atFinalChoice && !atFinalStage && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full mt-2 h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onAdvance();
            }}
            disabled={isAdvancing}
          >
            {isAdvancing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                {STAGE_ICONS[nextStage]} Next
                <ArrowRight className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
