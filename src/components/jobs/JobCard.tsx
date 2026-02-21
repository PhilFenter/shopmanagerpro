import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Job, ServiceType, useJobs, hasFinancialAccess } from '@/hooks/useJobs';
import { useJobLineItems } from '@/hooks/useJobLineItems';
import { useAuth } from '@/hooks/useAuth';
import { useRolePreview } from '@/hooks/useRolePreview';
import { JobStage } from '@/hooks/useJobStages';
import { StageProgress } from './StageProgress';
import { AdvanceStageButton } from './AdvanceStageButton';
import { formatTime } from './TimeEntry';
import { Package, Clock, AlertTriangle } from 'lucide-react';
import { JobGarmentsList } from './JobGarmentsList';
import { getUrgencyLevel, getUrgencyLabel, URGENCY_BORDER_COLORS, URGENCY_TEXT_COLORS } from '@/lib/job-urgency';
import { cn as clsx } from '@/lib/utils';
import { DueDatePicker } from './DueDatePicker';

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF',
  leather_patch: 'Leather',
  uv_patch: 'UV Patch',
  heat_press_patch: 'Heat Press',
  woven_patch: 'Woven',
  pvc_patch: 'PVC',
  other: 'Other',
};

export const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  embroidery: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  screen_print: 'bg-green-500/20 text-green-400 border-green-500/30',
  dtf: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  leather_patch: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  uv_patch: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  heat_press_patch: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  woven_patch: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  pvc_patch: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  other: 'bg-muted text-muted-foreground border-border',
};

interface JobCardProps {
  job: Job;
  onClick?: () => void;
}

export function JobCard({ job, onClick }: JobCardProps) {
  const stage = (job as any).stage as JobStage || 'received';
  const { updateJob } = useJobs();
  const { lineItems } = useJobLineItems(job.id);
  const { role: actualRole } = useAuth();
  const { isPreviewingAsTeam } = useRolePreview();
  const role = isPreviewingAsTeam ? 'team' : actualRole;
  const urgency = getUrgencyLevel((job as any).due_date);
  const urgencyLabel = getUrgencyLabel((job as any).due_date);

  // Get unique service types from line items
  const lineItemServiceTypes = [...new Set(lineItems.map(li => li.service_type))];
  
  // Combine job service type with line item types (deduplicated)
  const allServiceTypes = [...new Set([job.service_type, ...lineItemServiceTypes])];
  
  // Filter out 'other' if there are more specific types
  const displayTypes = allServiceTypes.length > 1 
    ? allServiceTypes.filter(t => t !== 'other') 
    : allServiceTypes;

  const handleServiceTypeChange = (newType: ServiceType) => {
    updateJob.mutate({ id: job.id, service_type: newType });
  };

  return (
    <Card 
      className={clsx(
        "cursor-pointer transition-all hover:shadow-md",
        urgency !== 'none' && `border-l-4 ${URGENCY_BORDER_COLORS[urgency]}`
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {job.order_number && (
                <span className="text-sm font-medium text-muted-foreground">
                  #{job.order_number}
                </span>
              )}
              {/* Primary service type selector */}
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
              {/* Additional service types from line items */}
              {displayTypes.filter(t => t !== job.service_type).map(type => (
                <Badge 
                  key={type} 
                  variant="outline" 
                  className={`text-xs h-6 ${SERVICE_TYPE_COLORS[type]}`}
                >
                  {SERVICE_TYPE_LABELS[type]}
                </Badge>
              ))}
            </div>
            <h3 className="font-semibold truncate">{job.customer_name}</h3>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Stage Progress */}
        <StageProgress currentStage={stage} compact />
        
        {/* Garment summary for Printavo jobs */}
        <JobGarmentsList jobId={job.id} compact />

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
          {hasFinancialAccess(role) && job.sale_price && (
            <span className="font-medium text-foreground ml-auto">
              ${Number(job.sale_price).toFixed(2)}
            </span>
          )}
        </div>

        {/* Due date */}
        <div className="flex items-center gap-1 text-xs" onClick={(e) => e.stopPropagation()}>
          {urgency !== 'none' && (
            <div className={clsx("flex items-center gap-1 font-medium", URGENCY_TEXT_COLORS[urgency])}>
              <AlertTriangle className="h-3 w-3" />
              <span>{urgencyLabel}</span>
            </div>
          )}
          <span className="ml-auto">
            <DueDatePicker jobId={job.id} dueDate={job.due_date} />
          </span>
        </div>

        {/* Advance Button */}
        <div onClick={(e) => e.stopPropagation()}>
          <AdvanceStageButton 
            jobId={job.id} 
            currentStage={stage} 
            size="sm"
            source={job.source}
            customerName={job.customer_name}
            customerEmail={job.customer_email}
            orderNumber={job.order_number}
          />
        </div>
      </CardContent>
    </Card>
  );
}
