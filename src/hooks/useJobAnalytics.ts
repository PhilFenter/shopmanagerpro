import { useMemo } from 'react';
import { useJobs } from './useJobs';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, subMonths, startOfWeek, endOfWeek, eachWeekOfInterval, isSameDay, isWithinInterval } from 'date-fns';
import { SERVICE_LABELS } from '@/lib/constants';

export interface DailyJobCount {
  date: string;
  created: number;
  completed: number;
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

export interface ServiceRevenue {
  service: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  count: number;
}


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

export function useJobAnalytics() {
  const { jobs, isLoading } = useJobs();

  const analytics = useMemo(() => {
    if (!jobs.length) {
      return {
        dailyJobCounts: [],
        weeklyRevenue: [],
        serviceBreakdown: [],
        stageBreakdown: [],
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        avgJobValue: 0,
        completedThisMonth: 0,
        createdThisMonth: 0,
      };
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Daily job counts for current month
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: now });
    const dailyJobCounts: DailyJobCount[] = daysInMonth.map(day => {
      const created = jobs.filter(j => isSameDay(new Date(j.created_at), day)).length;
      const completed = jobs.filter(j => j.completed_at && isSameDay(new Date(j.completed_at), day)).length;
      return {
        date: format(day, 'MMM d'),
        created,
        completed,
      };
    });

    // Weekly revenue for last 8 weeks
    const eightWeeksAgo = subMonths(now, 2);
    const weeks = eachWeekOfInterval({ start: eightWeeksAgo, end: now });
    const weeklyRevenue: WeeklyRevenue[] = weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const weekJobs = jobs.filter(j => {
        if (!j.completed_at) return false;
        const completedDate = new Date(j.completed_at);
        return isWithinInterval(completedDate, { start: weekStart, end: weekEnd });
      });

      const revenue = weekJobs.reduce((sum, j) => sum + (j.sale_price || 0), 0);
      const cost = weekJobs.reduce((sum, j) => sum + (j.material_cost || 0), 0);

      return {
        week: format(weekStart, 'MMM d'),
        revenue,
        cost,
        profit: revenue - cost,
      };
    });

    // Service type breakdown (all time, active jobs)
    const activeJobs = jobs.filter(j => j.status !== 'completed');
    const serviceCounts: Record<string, number> = {};
    activeJobs.forEach(j => {
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

    // Revenue by service type (all jobs)
    const serviceRevenueMap: Record<string, { revenue: number; cost: number; count: number }> = {};
    jobs.forEach(j => {
      const st = j.service_type;
      if (!serviceRevenueMap[st]) serviceRevenueMap[st] = { revenue: 0, cost: 0, count: 0 };
      serviceRevenueMap[st].revenue += (j.sale_price || 0);
      serviceRevenueMap[st].cost += (j.material_cost || 0);
      serviceRevenueMap[st].count += 1;
    });
    const serviceRevenue: ServiceRevenue[] = Object.entries(serviceRevenueMap)
      .map(([service, data]) => ({
        service,
        label: SERVICE_LABELS[service] || service,
        revenue: data.revenue,
        cost: data.cost,
        profit: data.revenue - data.cost,
        count: data.count,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Summary stats
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const totalRevenue = completedJobs.reduce((sum, j) => sum + (j.sale_price || 0), 0);
    const totalCost = completedJobs.reduce((sum, j) => sum + (j.material_cost || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const avgJobValue = completedJobs.length ? totalRevenue / completedJobs.length : 0;

    const completedThisMonth = jobs.filter(j => {
      if (!j.completed_at) return false;
      return isWithinInterval(new Date(j.completed_at), { start: monthStart, end: monthEnd });
    }).length;

    const createdThisMonth = jobs.filter(j => {
      return isWithinInterval(new Date(j.created_at), { start: monthStart, end: monthEnd });
    }).length;

    return {
      dailyJobCounts,
      weeklyRevenue,
      serviceBreakdown,
      stageBreakdown,
      serviceRevenue,
      totalRevenue,
      totalCost,
      totalProfit,
      avgJobValue,
      completedThisMonth,
      createdThisMonth,
    };
  }, [jobs]);

  return {
    ...analytics,
    isLoading,
  };
}
