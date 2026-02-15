import { useAuth } from '@/hooks/useAuth';
import { useJobs, hasFinancialAccess } from '@/hooks/useJobs';
import { useDashboardAnalytics, TimePeriod } from '@/hooks/useDashboardAnalytics';
import { useRolePreview } from '@/hooks/useRolePreview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobForm } from '@/components/jobs/JobForm';
import { JobCard } from '@/components/jobs/JobCard';
import { Plus, Clock, Activity, CheckCircle, DollarSign, Briefcase } from 'lucide-react';
import { formatTime } from '@/components/jobs/TimeEntry';
import { Link } from 'react-router-dom';
import { JobVolumeChart } from '@/components/dashboard/JobVolumeChart';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { ServiceBreakdownChart } from '@/components/dashboard/ServiceBreakdownChart';
import { StageBreakdownChart } from '@/components/dashboard/StageBreakdownChart';

export default function Dashboard() {
  const { role: actualRole } = useAuth();
  const { isPreviewingAsTeam } = useRolePreview();
  const role = isPreviewingAsTeam ? 'team' : actualRole;
  const { jobs, isLoading } = useJobs();
  const analytics = useDashboardAnalytics();

  const pendingJobs = jobs.filter(j => j.status === 'pending' || j.status === 'in_progress');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={analytics.period} onValueChange={(v) => analytics.setPeriod(v as TimePeriod)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {analytics.periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <JobForm />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Jobs ({analytics.periodLabel})</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalJobCount}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.activeJobCount} active, {analytics.completedJobCount} completed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Time Logged</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(analytics.totalMinutes)}</div>
            <p className="text-xs text-muted-foreground">{analytics.periodLabel}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Jobs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingJobs.length}</div>
            <p className="text-xs text-muted-foreground">Pending or in progress</p>
          </CardContent>
        </Card>

        {hasFinancialAccess(role) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${analytics.totalRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics.periodLabel} • Avg ${Math.round(analytics.avgJobValue).toLocaleString()}/job
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Analytics Charts */}
      {hasFinancialAccess(role) && (
        <div className="grid gap-4 lg:grid-cols-4">
          <JobVolumeChart data={analytics.dailyJobCounts} />
          <RevenueChart data={analytics.weeklyRevenue} />
          <ServiceBreakdownChart data={analytics.serviceBreakdown} />
          <StageBreakdownChart data={analytics.stageBreakdown} />
        </div>
      )}

      {/* Open Jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Open Jobs</CardTitle>
            <CardDescription>Jobs that need attention</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/jobs">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : pendingJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No open jobs</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                All caught up! Create a job when new work comes in.
              </p>
              <JobForm 
                trigger={
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Job
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingJobs.slice(0, 12).map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
