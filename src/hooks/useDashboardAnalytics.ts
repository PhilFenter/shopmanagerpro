import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useJobs } from './useJobs';
import { startOfDay, subDays, subWeeks, subMonths, isWithinInterval, format, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek } from 'date-fns';

export type TimePeriod = 'this_week' | 'this_month' | 'last_30_days' | 'last_90_days' | 'all_time';

export interface DailyJobCount {
  date: string;
  created: number;
  inProgress: number;
}

export interface WeeklyRevenue {
  week: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface ServiceTypeBreakdown {
  service: string;
  count: number;
  label: string;
}

export interface StageBreakdown {
  stage: string;
  count: number;
  label: string;
}

const SERVICE_LABELS: Record<string, string> = {
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

const STAGE_LABELS: Record<string, string> = {
  received: 'Received',
  art_approved: 'Art Approved',
  product_ordered: 'Product Ordered',
  product_arrived: 'Product Arrived',
  product_staged: 'Product Staged',
  in_production: 'In Production',
  production_complete: 'Production Complete',
  qc_complete: 'QC Complete',
  packaged: 'Packaged',
  customer_notified: 'Notified',
  delivered: 'Delivered',
  picked_up: 'Picked Up',
  shipped: 'Shipped',
};

const PERIOD_LABELS: Record<TimePeriod, string> = {
  this_week: 'This Week',
  this_month: 'This Month',
  last_30_days: 'Last 30 Days',
  last_90_days: 'Last 90 Days',
  all_time: 'All Time',
};

function getPeriodRange(period: TimePeriod): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  
  switch (period) {
    case 'this_week':
      return { start: startOfWeek(now), end };
    case 'this_month':
      return { start: subDays(now, 30), end };
    case 'last_30_days':
      return { start: subDays(now, 30), end };
    case 'last_90_days':
      return { start: subDays(now, 90), end };
    case 'all_time':
      return { start: new Date(2020, 0, 1), end }; // Far back enough
  }
}

export function useDashboardAnalytics() {
  const [period, setPeriod] = useState<TimePeriod>('last_30_days');
  const { jobs, isLoading: jobsLoading } = useJobs();

  // Fetch all time entries for accurate time tracking
  const timeEntriesQuery = useQuery({
    queryKey: ['all-time-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('id, job_id, duration, created_at, worker_id');
      
      if (error) throw error;
      return data;
    },
  });

  const analytics = useMemo(() => {
    const { start, end } = getPeriodRange(period);
    const timeEntries = timeEntriesQuery.data ?? [];

    // Filter jobs by period based on created_at
    const periodJobs = jobs.filter(j => {
      const createdAt = new Date(j.created_at);
      return isWithinInterval(createdAt, { start, end });
    });

    // Filter time entries by period
    const periodTimeEntries = timeEntries.filter(te => {
      const createdAt = new Date(te.created_at);
      return isWithinInterval(createdAt, { start, end });
    });

    // Total time from time_entries table (not job.time_tracked)
    const totalMinutes = periodTimeEntries.reduce((sum, te) => sum + (te.duration || 0), 0);

    // Revenue from ALL jobs in period (not just completed)
    const totalRevenue = periodJobs.reduce((sum, j) => sum + (j.sale_price || 0), 0);
    const totalMaterialCost = periodJobs.reduce((sum, j) => sum + (j.material_cost || 0), 0);

    // Jobs in progress (for Job Volume chart)
    const activeJobs = periodJobs.filter(j => j.status !== 'completed');
    const completedJobs = periodJobs.filter(j => j.status === 'completed');

    // Daily job counts - show created + in-progress for last 14 days
    const chartStart = period === 'this_week' ? start : subDays(end, 14);
    const daysInRange = eachDayOfInterval({ start: chartStart, end });
    const dailyJobCounts: DailyJobCount[] = daysInRange.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const created = jobs.filter(j => {
        const createdAt = new Date(j.created_at);
        return isWithinInterval(createdAt, { start: dayStart, end: dayEnd });
      }).length;
      
      // Count jobs that were active on this day (created before or on this day, not completed before)
      const inProgress = jobs.filter(j => {
        const createdAt = new Date(j.created_at);
        if (createdAt > dayEnd) return false;
        if (j.completed_at && new Date(j.completed_at) < dayStart) return false;
        return j.status !== 'completed' || (j.completed_at && new Date(j.completed_at) >= dayStart);
      }).length;
      
      return {
        date: format(day, 'MMM d'),
        created,
        inProgress,
      };
    });

    // Weekly revenue for chart (last 8 weeks or period)
    const weekStart = period === 'all_time' ? subWeeks(end, 12) : subWeeks(end, 8);
    const weeks = eachWeekOfInterval({ start: weekStart, end });
    const weeklyRevenue: WeeklyRevenue[] = weeks.map(ws => {
      const we = endOfWeek(ws);
      
      // Revenue from jobs created in this week
      const weekJobs = jobs.filter(j => {
        const createdAt = new Date(j.created_at);
        return isWithinInterval(createdAt, { start: ws, end: we });
      });

      const revenue = weekJobs.reduce((sum, j) => sum + (j.sale_price || 0), 0);
      const cost = weekJobs.reduce((sum, j) => sum + (j.material_cost || 0), 0);

      return {
        week: format(ws, 'MMM d'),
        revenue,
        cost,
        profit: revenue - cost,
      };
    });

    // Service type breakdown (all jobs in period)
    const serviceCounts: Record<string, number> = {};
    periodJobs.forEach(j => {
      serviceCounts[j.service_type] = (serviceCounts[j.service_type] || 0) + 1;
    });
    const serviceBreakdown: ServiceTypeBreakdown[] = Object.entries(serviceCounts)
      .map(([service, count]) => ({
        service,
        count,
        label: SERVICE_LABELS[service] || service,
      }))
      .sort((a, b) => b.count - a.count);

    // Stage breakdown (active jobs only)
    const stageCounts: Record<string, number> = {};
    activeJobs.forEach(j => {
      stageCounts[j.stage] = (stageCounts[j.stage] || 0) + 1;
    });
    const stageBreakdown: StageBreakdown[] = Object.entries(stageCounts)
      .map(([stage, count]) => ({
        stage,
        count,
        label: STAGE_LABELS[stage] || stage,
      }))
      .sort((a, b) => b.count - a.count);

    // Summary stats
    const avgJobValue = periodJobs.length ? totalRevenue / periodJobs.length : 0;

    return {
      dailyJobCounts,
      weeklyRevenue,
      serviceBreakdown,
      stageBreakdown,
      totalRevenue,
      totalMaterialCost,
      totalProfit: totalRevenue - totalMaterialCost,
      avgJobValue,
      totalMinutes,
      activeJobCount: activeJobs.length,
      completedJobCount: completedJobs.length,
      totalJobCount: periodJobs.length,
    };
  }, [jobs, timeEntriesQuery.data, period]);

  return {
    ...analytics,
    period,
    setPeriod,
    periodLabel: PERIOD_LABELS[period],
    periodOptions: Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value: value as TimePeriod, label })),
    isLoading: jobsLoading || timeEntriesQuery.isLoading,
  };
}
