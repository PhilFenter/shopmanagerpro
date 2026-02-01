import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Job, ServiceType, useJobs } from '@/hooks/useJobs';
import { JobStage } from '@/hooks/useJobStages';
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

const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  embroidery: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  screen_print: 'bg-green-500/20 text-green-400 border-green-500/30',
  dtf: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  leather_patch: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  other: 'bg-muted text-muted-foreground border-border',
};

interface JobCardProps {
  job: Job;
  onClick?: () => void;
}

export function JobCard({ job, onClick }: JobCardProps) {
  const stage = (job as any).stage as JobStage || 'received';
  const { updateJob } = useJobs();

  const handleServiceTypeChange = (newType: ServiceType) => {
    updateJob.mutate({ id: job.id, service_type: newType });
  };

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
              <div onClick={(e) => e.stopPropagation()}>
                <Select value={job.service_type} onValueChange={handleServiceTypeChange}>
                  <SelectTrigger className={`h-6 px-2 text-xs border ${SERVICE_TYPE_COLORS[job.service_type]} bg-transparent w-auto gap-1`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-sm">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
