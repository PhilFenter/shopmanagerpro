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
import { ProfitabilityInsights } from '@/components/financials/ProfitabilityInsights';
import { BulkReclassifyTool } from '@/components/financials/BulkReclassifyTool';
import { DollarSign, TrendingUp, TrendingDown, Target, Clock, CreditCard, CalendarIcon } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfYear, subMonths, format, parseISO, isValid } from 'date-fns';
import { SERVICE_LABELS } from '@/lib/constants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Period = 'this_month' | 'last_month' | 'ytd' | 'all_time' | 'custom';
type DateBasis = 'created_at' | 'completed_at';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

function getPeriodRange(period: Period, customStart?: Date, customEnd?: Date) {
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
    case 'custom': {
      const s = customStart && isValid(customStart) ? customStart : startOfMonth(now);
      const e = customEnd && isValid(customEnd) ? customEnd : endOfMonth(now);
      return { start: s, end: e, label: `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}` };
    }
  }
}


export default function Financials() {
  const { role, loading } = useAuth();
  const metrics = useBusinessMetrics();
  const [period, setPeriod] = useState<Period>('this_month');
  const [dateBasis, setDateBasis] = useState<DateBasis>('created_at');
  const [customStart, setCustomStart] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customEnd, setCustomEnd] = useState<Date | undefined>(endOfMonth(new Date()));

  const { start, end, label: periodLabel } = getPeriodRange(period, customStart, customEnd);

  const { data: periodJobs = [] } = useQuery({
    queryKey: ['financials-period-jobs', period, dateBasis, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, sale_price, material_cost, service_type, status, completed_at, created_at, payment_method, source')
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
      const allEntries: any[] = [];
      for (let i = 0; i < jobIds.length; i += 100) {
        const batch = jobIds.slice(i, i + 100);
        const { data, error } = await supabase
          .from('time_entries')
          .select('job_id, duration, worker_id, line_item_id')
          .in('job_id', batch);
        if (error) throw error;
        if (data) allEntries.push(...data);
      }
      return allEntries;
    },
    enabled: jobIds.length > 0,
  });

  // Fetch line items for Mixed jobs to split revenue/cost by actual service type
  const mixedJobIds = periodJobs.filter(j => j.service_type === 'mixed').map(j => j.id);
  const { data: mixedLineItems = [] } = useQuery({
    queryKey: ['financials-mixed-line-items', mixedJobIds],
    queryFn: async () => {
      if (mixedJobIds.length === 0) return [];
      const allItems: any[] = [];
      for (let i = 0; i < mixedJobIds.length; i += 100) {
        const batch = mixedJobIds.slice(i, i + 100);
        const { data, error } = await supabase
          .from('job_line_items')
          .select('id, job_id, service_type, sale_price, material_cost')
          .in('job_id', batch);
        if (error) throw error;
        if (data) allItems.push(...data);
      }
      return allItems;
    },
    enabled: mixedJobIds.length > 0,
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
  const PRINTAVO_FEE_RATE = 0.035;
  const PRINTAVO_FLAT_FEE = 0.3;
  const SHOPIFY_FEE_RATE = 0.029;
  const SHOPIFY_FLAT_FEE = 0.3;

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

  // Fixed cost allocation by period (MTD proration avoids day-1 full-month cost shock)
  const overheadForPeriod = useMemo(() => {
    const now = new Date();
    const daysInCurrentMonth = endOfMonth(now).getDate();
    const currentMonthProgress = Math.min(1, Math.max(0, now.getDate() / daysInCurrentMonth));
    const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

    if (period === 'this_month') {
      return metrics.totalMonthlyCost * currentMonthProgress;
    }
    if (period === 'last_month') {
      return metrics.totalMonthlyCost;
    }
    if (period === 'ytd') {
      const completedMonths = now.getMonth(); // 0-indexed (Jan = 0)
      return metrics.totalMonthlyCost * (completedMonths + currentMonthProgress);
    }
    if (period === 'custom') {
      // Prorate by number of months (fractional) in the selected range
      const months = Math.max(0, (end.getTime() - start.getTime()) / MS_PER_MONTH);
      return metrics.totalMonthlyCost * months;
    }
    // all_time: approximate using months between first job and now
    if (periodJobs.length > 0) {
      const earliest = periodJobs.reduce((min, j) => {
        const d = j.created_at;
        return d < min ? d : min;
      }, periodJobs[0].created_at);
      const monthsSpan = Math.max(1, Math.ceil((Date.now() - new Date(earliest).getTime()) / MS_PER_MONTH));
      return metrics.totalMonthlyCost * monthsSpan;
    }
    return metrics.totalMonthlyCost;
  }, [period, metrics.totalMonthlyCost, periodJobs, start, end]);

  const stats = useMemo(() => {
    const totalRevenue = periodJobs.reduce((s, j) => s + (j.sale_price || 0), 0);
    const totalMaterialCost = periodJobs.reduce((s, j) => s + (j.material_cost || 0), 0);
    const totalCost = totalMaterialCost + overheadForPeriod;
    const totalProfit = totalRevenue - totalCost;
    const avgJobValue = periodJobs.length ? totalRevenue / periodJobs.length : 0;
    // Only apply card fees to jobs paid by card (null = unknown, treated as card).
    const cardJobs = periodJobs.filter(j => !j.payment_method || j.payment_method === 'card');
    const estimatedPaymentFees = cardJobs.reduce((sum, j) => {
      const revenue = j.sale_price || 0;
      const isShopify = j.source === 'shopify' || j.source === 'shopify-sync';
      const rate = isShopify ? SHOPIFY_FEE_RATE : PRINTAVO_FEE_RATE;
      const flat = isShopify ? SHOPIFY_FLAT_FEE : PRINTAVO_FLAT_FEE;
      return sum + (revenue * rate) + flat;
    }, 0);
    const netRevenue = totalRevenue - estimatedPaymentFees;


    // Build line-item lookup for Mixed jobs
    const mixedJobLineItems = new Map<string, typeof mixedLineItems>();
    for (const li of mixedLineItems) {
      const existing = mixedJobLineItems.get(li.job_id) || [];
      existing.push(li);
      mixedJobLineItems.set(li.job_id, existing);
    }

    const serviceRevenueMap: Record<string, { revenue: number; cost: number; count: number }> = {};
    const addToService = (st: string, revenue: number, cost: number, countFraction: number) => {
      if (!serviceRevenueMap[st]) serviceRevenueMap[st] = { revenue: 0, cost: 0, count: 0 };
      serviceRevenueMap[st].revenue += revenue;
      serviceRevenueMap[st].cost += cost;
      serviceRevenueMap[st].count += countFraction;
    };

    periodJobs.forEach(j => {
      if (j.service_type === 'mixed') {
        const lineItems = mixedJobLineItems.get(j.id);
        if (lineItems && lineItems.length > 0) {
          const liTotalRevenue = lineItems.reduce((s: number, li: any) => s + (li.sale_price || 0), 0);
          const liTotalCost = lineItems.reduce((s: number, li: any) => s + (li.material_cost || 0), 0);
          const jobRevenue = j.sale_price || 0;
          const jobCost = j.material_cost || 0;

          // Group line items by service type first
          const grouped: Record<string, { revShare: number; costShare: number }> = {};
          lineItems.forEach((li: any) => {
            const st = li.service_type || 'other';
            if (!grouped[st]) grouped[st] = { revShare: 0, costShare: 0 };
            grouped[st].revShare += liTotalRevenue > 0
              ? jobRevenue * ((li.sale_price || 0) / liTotalRevenue)
              : jobRevenue / lineItems.length;
            grouped[st].costShare += liTotalCost > 0
              ? jobCost * ((li.material_cost || 0) / liTotalCost)
              : jobCost / lineItems.length;
          });

          const serviceCount = Object.keys(grouped).length;
          Object.entries(grouped).forEach(([st, shares]) => {
            addToService(st, shares.revShare, shares.costShare, 1 / serviceCount);
          });
        } else {
          addToService('mixed', j.sale_price || 0, j.material_cost || 0, 1);
        }
      } else {
        addToService(j.service_type, j.sale_price || 0, j.material_cost || 0, 1);
      }
    });
    const serviceRevenue = Object.entries(serviceRevenueMap)
      .map(([service, data]) => ({
        service,
        label: SERVICE_LABELS[service] || service,
        revenue: data.revenue,
        cost: data.cost,
        profit: data.revenue - data.cost,
        count: Math.round(data.count * 10) / 10,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return { totalRevenue, totalMaterialCost, totalCost, totalProfit, avgJobValue, jobCount: periodJobs.length, serviceRevenue, overheadForPeriod, estimatedPaymentFees, netRevenue };
  }, [periodJobs, overheadForPeriod, mixedLineItems]);

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
          {period === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-36 justify-start text-left font-normal', !customStart && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStart ? format(customStart, 'MMM d, yyyy') : 'Start'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} defaultMonth={customStart} captionLayout="dropdown-buttons" fromYear={2025} toYear={new Date().getFullYear()} initialFocus className={cn('p-3 pointer-events-auto')} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-36 justify-start text-left font-normal', !customEnd && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEnd ? format(customEnd, 'MMM d, yyyy') : 'End'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} defaultMonth={customEnd} captionLayout="dropdown-buttons" fromYear={2025} toYear={new Date().getFullYear()} initialFocus className={cn('p-3 pointer-events-auto')} />
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
            <CardTitle className="text-sm font-medium">Est. Payment Fees</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.estimatedPaymentFees)}</div>
            <p className="text-xs text-muted-foreground">3.5% + $0.30 on card payments only · Net {formatCurrency(stats.netRevenue)}</p>
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
              {profitMargin}% margin · Overhead {formatCurrency(stats.overheadForPeriod)} · Materials {formatCurrency(stats.totalMaterialCost)}
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

      {/* Profitability Insights */}
      <ProfitabilityInsights
        serviceRevenue={stats.serviceRevenue}
        totalRevenue={stats.totalRevenue}
        totalProfit={stats.totalProfit}
        monthlyCost={metrics.totalMonthlyCost}
        periodLabel={periodLabel}
      />

      {/* Revenue by Service Chart */}
      <RevenueByServiceChart data={stats.serviceRevenue} />

      {/* Sales Tax Report */}
      <SalesTaxReport />

      {/* Bulk Reclassification */}
      <BulkReclassifyTool />
    </div>
  );
}
