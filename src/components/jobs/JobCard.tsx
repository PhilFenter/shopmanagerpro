import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Job, ServiceType } from '@/hooks/useJobs';
import { JobStage, STAGE_LABELS, STAGE_ICONS } from '@/hooks/useJobStages';
import { StageProgress } from './StageProgress';
import { AdvanceStageButton } from './AdvanceStageButton';
import { formatTime } from './TimeEntry';
import { Package, Clock } from 'lucide-react';

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF',
  leather_patch: 'Leather',
  other: 'Other',
};

interface JobCardProps {
  job: Job;
  onClick?: () => void;
}

export function JobCard({ job, onClick }: JobCardProps) {
  const stage = (job as any).stage as JobStage || 'received';

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {job.order_number && (
                <span className="text-sm font-medium text-muted-foreground">
                  #{job.order_number}
                </span>
              )}
              <Badge variant="outline" className="text-xs">
                {SERVICE_TYPE_LABELS[job.service_type]}
              </Badge>
            </div>
            <h3 className="font-semibold truncate">{job.customer_name}</h3>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Stage Progress */}
        <StageProgress currentStage={stage} compact />
        
        {job.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {job.description}
          </p>
        )}
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            <span>Qty: {job.quantity}</span>
          </div>
          {job.time_tracked > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formatTime(job.time_tracked)}</span>
            </div>
          )}
          {job.sale_price && (
            <span className="font-medium text-foreground ml-auto">
              ${Number(job.sale_price).toFixed(2)}
            </span>
          )}
        </div>

        {/* Advance Button */}
        <div onClick={(e) => e.stopPropagation()}>
          <AdvanceStageButton jobId={job.id} currentStage={stage} size="sm" />
        </div>
      </CardContent>
    </Card>
  );
}
