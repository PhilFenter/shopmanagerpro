import { useAuth } from '@/hooks/useAuth';
import { useJobs, hasFinancialAccess } from '@/hooks/useJobs';
import { useDashboardAnalytics, TimePeriod } from '@/hooks/useDashboardAnalytics';
import { FINAL_STAGES, JobStage } from '@/hooks/useJobStages';
import { useRolePreview } from '@/hooks/useRolePreview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobForm } from '@/components/jobs/JobForm';
import { JobCard } from '@/components/jobs/JobCard';
import { Plus, Activity, DollarSign, Briefcase } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { JobVolumeChart } from '@/components/dashboard/JobVolumeChart';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { ServiceBreakdownChart } from '@/components/dashboard/ServiceBreakdownChart';
import { StageBreakdownChart } from '@/components/dashboard/StageBreakdownChart';
import { ActionItemsDashboardCard } from '@/components/action-items/ActionItemsDashboardCard';
import { QuickCaptureDialog } from '@/components/action-items/QuickCaptureDialog';
import { DueSoonWidget } from '@/components/dashboard/DueSoonWidget';

export default function Dashboard() {
  const navigate = useNavigate();
  const { role: actualRole } = useAuth();
  const { isPreviewingAsTeam } = useRolePreview();
  const role = isPreviewingAsTeam ? 'team' : actualRole;
  const { jobs, isLoading } = useJobs();
  const analytics = useDashboardAnalytics();

  const pendingJobs = jobs.filter(j =>
    (j.status === 'pending' || j.status === 'in_progress') &&
    !FINAL_STAGES.includes(j.stage as JobStage)
  );

  const isTeamView = !hasFinancialAccess(role);

  // Shared: the big list of jobs that need attention
  const jobsList = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className={isTeamView ? 'text-2xl' : undefined}>Jobs</CardTitle>
          <CardDescription>Needs attention · pending or in progress</CardDescription>
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
          <div
            className={
              isTeamView
                ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&_.job-card-title]:text-lg'
                : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
            }
          >
            {pendingJobs.slice(0, isTeamView ? 24 : 12).map((job) => (
              <JobCard key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
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
            <span className="mt-1 text-[11px] text-muted-foreground">Affects stats & charts only</span>
          </div>
          <JobForm />
        </div>
      </div>

      {/* Team view: Jobs at the very top, larger */}
      {isTeamView && jobsList}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Due Soon Widget */}
      <DueSoonWidget jobs={jobs} />

      {/* Action Items */}
      <ActionItemsDashboardCard />

      {/* Admin/manager view: Jobs list at the bottom (team already saw it up top) */}
      {!isTeamView && jobsList}

      {/* Floating quick capture */}
      <QuickCaptureDialog />
    </div>
  );
}
