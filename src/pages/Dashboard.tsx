import { useAuth } from '@/hooks/useAuth';
import { useJobs } from '@/hooks/useJobs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JobForm } from '@/components/jobs/JobForm';
import { JobCard } from '@/components/jobs/JobCard';
import { Plus, Clock, TrendingUp, Activity, CheckCircle } from 'lucide-react';
import { formatTime } from '@/components/jobs/JobTimer';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { role } = useAuth();
  const { jobs, isLoading } = useJobs();

  const activeJobs = jobs.filter(j => j.status === 'in_progress' || j.timer_started_at);
  const completedThisWeek = jobs.filter(j => {
    if (j.status !== 'completed' || !j.completed_at) return false;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(j.completed_at) >= weekAgo;
  });

  const todayTime = jobs.reduce((acc, job) => {
    if (job.timer_started_at) {
      const elapsed = Math.floor((Date.now() - new Date(job.timer_started_at).getTime()) / 1000);
      return acc + elapsed;
    }
    return acc;
  }, 0);

  const totalTimeToday = jobs
    .filter(j => {
      const today = new Date().toDateString();
      return new Date(j.updated_at).toDateString() === today;
    })
    .reduce((acc, job) => acc + job.time_tracked, 0) + todayTime;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
        </div>
        <JobForm />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeJobs.length}</div>
            <p className="text-xs text-muted-foreground">Jobs in progress</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Time Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(totalTimeToday)}</div>
            <p className="text-xs text-muted-foreground">Tracked today</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedThisWeek.length}</div>
            <p className="text-xs text-muted-foreground">Jobs this week</p>
          </CardContent>
        </Card>

        {role === 'admin' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Monthly Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0</div>
              <p className="text-xs text-muted-foreground">Toward break-even</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active Jobs</CardTitle>
            <CardDescription>Jobs currently being worked on</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/jobs">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : activeJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No active jobs</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Start a timer on a job to begin tracking production.
              </p>
              <JobForm 
                trigger={
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Job
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeJobs.slice(0, 6).map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
