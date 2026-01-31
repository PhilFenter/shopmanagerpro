import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Job, ServiceType, JobStatus } from '@/hooks/useJobs';
import { JobTimer } from './JobTimer';
import { User, Package, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF',
  leather_patch: 'Leather',
  other: 'Other',
};

const STATUS_STYLES: Record<JobStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  on_hold: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

interface JobCardProps {
  job: Job;
  onClick?: () => void;
}

export function JobCard({ job, onClick }: JobCardProps) {
  const isRunning = !!job.timer_started_at;

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isRunning && "ring-2 ring-primary"
      )}
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
          <Badge className={cn("shrink-0", STATUS_STYLES[job.status])}>
            {job.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
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
          {job.sale_price && (
            <span className="font-medium text-foreground">
              ${Number(job.sale_price).toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {job.customer_phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span className="truncate">{job.customer_phone}</span>
            </div>
          )}
          {job.customer_email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="truncate">{job.customer_email}</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
          <JobTimer job={job} compact />
        </div>
      </CardContent>
    </Card>
  );
}
