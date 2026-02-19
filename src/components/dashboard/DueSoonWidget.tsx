import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Job } from '@/hooks/useJobs';
import { getUrgencyLevel, getUrgencyLabel, URGENCY_COLORS, URGENCY_TEXT_COLORS } from '@/lib/job-urgency';
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface DueSoonWidgetProps {
  jobs: Job[];
}

export function DueSoonWidget({ jobs }: DueSoonWidgetProps) {
  // Get jobs with due dates, sorted by urgency
  const jobsWithDue = jobs
    .filter(j => (j as any).due_date && j.status !== 'completed')
    .map(j => ({
      ...j,
      urgency: getUrgencyLevel((j as any).due_date),
      urgencyLabel: getUrgencyLabel((j as any).due_date),
    }))
    .filter(j => j.urgency !== 'none' && j.urgency !== 'green')
    .sort((a, b) => {
      const order = { overdue: 0, red: 1, yellow: 2, green: 3, none: 4 };
      return order[a.urgency] - order[b.urgency];
    });

  if (jobsWithDue.length === 0) return null;

  const overdueCount = jobsWithDue.filter(j => j.urgency === 'overdue').length;
  const urgentCount = jobsWithDue.filter(j => j.urgency === 'red').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Due Soon
          </CardTitle>
          <CardDescription>
            {overdueCount > 0 && <span className="text-red-500 font-medium">{overdueCount} overdue</span>}
            {overdueCount > 0 && urgentCount > 0 && ' · '}
            {urgentCount > 0 && <span className="text-amber-500">{urgentCount} urgent</span>}
            {overdueCount === 0 && urgentCount === 0 && `${jobsWithDue.length} jobs approaching deadline`}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/jobs">View All</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {jobsWithDue.slice(0, 8).map(job => (
            <div
              key={job.id}
              className={cn(
                "flex items-center justify-between p-2 rounded-md border-l-4",
                job.urgency === 'overdue' && 'border-l-zinc-900 dark:border-l-zinc-100 bg-muted/50',
                job.urgency === 'red' && 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
                job.urgency === 'yellow' && 'border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {job.order_number && (
                    <span className="text-xs text-muted-foreground">#{job.order_number}</span>
                  )}
                  <span className="text-sm font-medium truncate">{job.customer_name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("text-xs font-medium", URGENCY_TEXT_COLORS[job.urgency])}>
                  {job.urgencyLabel}
                </span>
                <div className={cn("h-2 w-2 rounded-full", URGENCY_COLORS[job.urgency])} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
