import { Job } from '@/hooks/useJobs';
import { JobStage, STAGE_ORDER, STAGE_LABELS, STAGE_ICONS, useAdvanceStage, getNextStage } from '@/hooks/useJobStages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ArrowRight, Loader2 } from 'lucide-react';
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

export function KanbanBoard({ jobs, onSelectJob }: KanbanBoardProps) {
  const advanceStage = useAdvanceStage();

  // Group jobs by stage
  const jobsByStage = STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = jobs.filter(job => (job as any).stage === stage);
    return acc;
  }, {} as Record<JobStage, Job[]>);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
        {STAGE_ORDER.map((stage) => (
          <div 
            key={stage} 
            className="w-72 flex-shrink-0"
          >
            <div className="bg-muted/50 rounded-lg p-3 h-full min-h-[400px]">
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
                    onAdvance={() => advanceStage.mutate({ 
                      jobId: job.id, 
                      currentStage: stage 
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
  );
}

interface KanbanCardProps {
  job: Job;
  stage: JobStage;
  onSelect: () => void;
  onAdvance: () => void;
  isAdvancing: boolean;
}

function KanbanCard({ job, stage, onSelect, onAdvance, isAdvancing }: KanbanCardProps) {
  const nextStage = getNextStage(stage);

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
          {job.order_number && (
            <Badge variant="outline" className="text-xs shrink-0">
              #{job.order_number}
            </Badge>
          )}
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

        {nextStage && (
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
