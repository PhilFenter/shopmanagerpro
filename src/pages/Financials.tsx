import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { useBusinessMetrics } from '@/hooks/useBusinessMetrics';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RevenueByServiceChart } from '@/components/financials/RevenueByServiceChart';
import { SalesTaxReport } from '@/components/financials/SalesTaxReport';
import { DollarSign, TrendingUp, TrendingDown, Target, Clock } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfYear, subMonths, format } from 'date-fns';

type Period = 'this_month' | 'last_month' | 'ytd' | 'all_time';
type DateBasis = 'created_at' | 'completed_at';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all_time', label: 'All Time' },
];

function getPeriodRange(period: Period) {
  const now = new Date();
  switch (period) {
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy') };
    case 'last_month': {
      const last = subMonths(now, 1);
      return { start: startOfMonth(last), end: endOfMonth(last), label: format(last, 'MMMM yyyy') };
    }
    case 'ytd':
      return { start: startOfYear(now), end: now, label: `${now.getFullYear()} YTD` };
    case 'all_time':
      return { start: new Date('2000-01-01'), end: now, label: 'All Time' };
  }
}

const SERVICE_LABELS: Record<string, string> = {
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF',
  leather_patch: 'Leather',
  other: 'Other',
};

export default function Financials() {
  const { role, loading } = useAuth();
  const metrics = useBusinessMetrics();
  const [period, setPeriod] = useState<Period>('this_month');
  const [dateBasis, setDateBasis] = useState<DateBasis>('created_at');

  const { start, end, label: periodLabel } = getPeriodRange(period);

  const { data: periodJobs = [] } = useQuery({
    queryKey: ['financials-period-jobs', period, dateBasis],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, sale_price, material_cost, service_type, status, completed_at, created_at')
        .gte(dateBasis, start.toISOString())
        .lte(dateBasis, end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch time entries for the period's jobs to calculate labor costs
  const jobIds = periodJobs.map(j => j.id);
  const { data: periodTimeEntries = [] } = useQuery({
    queryKey: ['financials-time-entries', jobIds],
    queryFn: async () => {
      if (jobIds.length === 0) return [];
      // Query in batches of 100 to avoid URL length limits
      const allEntries: any[] = [];
      for (let i = 0; i < jobIds.length; i += 100) {
        const batch = jobIds.slice(i, i + 100);
        const { data, error } = await supabase
          .from('time_entries')
          .select('job_id, duration, worker_id')
          .in('job_id', batch);
        if (error) throw error;
        if (data) allEntries.push(...data);
      }
      return allEntries;
    },
    enabled: jobIds.length > 0,
  });

  // Fetch workers for rate lookup
  const { data: allWorkers = [] } = useQuery({
    queryKey: ['financials-workers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('id, hourly_rate, is_salary, monthly_salary');
      if (error) throw error;
      return data || [];
    },
  });

  const PAYROLL_TAX_BURDEN = 0.165;
  const MONTHLY_HOURS = 176;

  // Build worker rate map
  const workerRates = useMemo(() => {
    const map = new Map<string, number>();
    allWorkers.forEach(w => {
      const rate = w.is_salary && (w.monthly_salary || 0) > 0
        ? (w.monthly_salary || 0) / MONTHLY_HOURS
        : w.hourly_rate || 0;
      map.set(w.id, rate);
    });
    return map;
  }, [allWorkers]);

  // Calculate total labor cost with burden for the period
  const periodLaborCost = useMemo(() => {
    return periodTimeEntries.reduce((sum: number, entry: any) => {
      const rate = entry.worker_id ? (workerRates.get(entry.worker_id) || 0) : 0;
      const hours = (entry.duration || 0) / 60;
      const baseCost = hours * rate;
      return sum + (baseCost * (1 + PAYROLL_TAX_BURDEN));
    }, 0);
  }, [periodTimeEntries, workerRates]);

  const stats = useMemo(() => {
    const totalRevenue = periodJobs.reduce((s, j) => s + (j.sale_price || 0), 0);
    const totalMaterialCost = periodJobs.reduce((s, j) => s + (j.material_cost || 0), 0);
    const totalCost = totalMaterialCost + periodLaborCost;
    const totalProfit = totalRevenue - totalCost;
    const avgJobValue = periodJobs.length ? totalRevenue / periodJobs.length : 0;

    const serviceRevenueMap: Record<string, { revenue: number; cost: number; count: number }> = {};
    periodJobs.forEach(j => {
      const st = j.service_type;
      if (!serviceRevenueMap[st]) serviceRevenueMap[st] = { revenue: 0, cost: 0, count: 0 };
      serviceRevenueMap[st].revenue += (j.sale_price || 0);
      serviceRevenueMap[st].cost += (j.material_cost || 0);
      serviceRevenueMap[st].count += 1;
    });
    const serviceRevenue = Object.entries(serviceRevenueMap)
      .map(([service, data]) => ({
        service,
        label: SERVICE_LABELS[service] || service,
        revenue: data.revenue,
        cost: data.cost,
        profit: data.revenue - data.cost,
        count: data.count,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return { totalRevenue, totalMaterialCost, totalCost, totalProfit, avgJobValue, jobCount: periodJobs.length, serviceRevenue, laborCost: periodLaborCost };
  }, [periodJobs, periodLaborCost]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!hasFinancialAccess(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const profitMargin = stats.totalRevenue > 0
    ? ((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financials</h1>
          <p className="text-muted-foreground">Revenue, costs, and break-even tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateBasis} onValueChange={(v) => setDateBasis(v as DateBasis)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Order Date</SelectItem>
              <SelectItem value="completed_at">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{stats.jobCount} jobs · {periodLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalProfit)}</div>
            <p className="text-xs text-muted-foreground">
              {profitMargin}% margin · Labor {formatCurrency(stats.laborCost)} · Materials {formatCurrency(stats.totalMaterialCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Costs</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalMonthlyCost)}</div>
            <p className="text-xs text-muted-foreground">Labor + overhead</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Job Value</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgJobValue)}</div>
            <p className="text-xs text-muted-foreground">Per completed job</p>
          </CardContent>
        </Card>
      </div>

      {/* Break-even Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Break-Even</CardTitle>
          <CardDescription>
            Revenue needed to cover monthly operating costs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const monthlyRevenue = period === 'this_month' || period === 'last_month'
              ? stats.totalRevenue
              : stats.totalRevenue; // for YTD/all-time, still show current period revenue
            const pct = metrics.totalMonthlyCost > 0
              ? (monthlyRevenue / metrics.totalMonthlyCost) * 100
              : 0;
            return (
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Monthly target</span>
                  <span className="font-medium">{formatCurrency(metrics.totalMonthlyCost)}</span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{periodLabel}: {formatCurrency(monthlyRevenue)}</span>
                  <span>{pct > 0 ? `${pct.toFixed(0)}%` : '—'}</span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
            <CardDescription>Monthly operating costs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Labor (base)</span>
                <span>{formatCurrency(metrics.monthlyLaborCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payroll taxes ({(metrics.payrollTaxRate * 100).toFixed(1)}%)</span>
                <span>{formatCurrency(metrics.payrollTaxBurden)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Total Labor</span>
                <span className="font-medium">{formatCurrency(metrics.totalLaborCostWithTaxes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overhead</span>
                <span>{formatCurrency(metrics.monthlyOverheadCost)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg">
                <span className="font-bold">Total Monthly</span>
                <span className="font-bold">{formatCurrency(metrics.totalMonthlyCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hourly Rates</CardTitle>
            <CardDescription>For job costing calculations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Labor per hour</span>
                </div>
                <span>{formatCurrency(metrics.laborCostPerHour)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overhead per hour</span>
                <span>{formatCurrency(metrics.overheadCostPerHour)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Job costing rate</span>
                <span className="font-medium">{formatCurrency(metrics.totalCostPerHour)}/hr</span>
              </div>
              <div className="flex justify-between pt-2 text-muted-foreground text-sm">
                <span>True cost (with taxes)</span>
                <span>{formatCurrency(metrics.trueCostPerHour)}/hr</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Service Chart */}
      <RevenueByServiceChart data={stats.serviceRevenue} />

      {/* Sales Tax Report */}
      <SalesTaxReport />
    </div>
  );
}
