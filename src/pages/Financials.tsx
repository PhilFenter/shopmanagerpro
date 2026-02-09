import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { useBusinessMetrics } from '@/hooks/useBusinessMetrics';
import { useJobAnalytics } from '@/hooks/useJobAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { DollarSign, TrendingUp, TrendingDown, Target, Clock } from 'lucide-react';

export default function Financials() {
  const { role, loading } = useAuth();
  const metrics = useBusinessMetrics();
  const analytics = useJobAnalytics();

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!hasFinancialAccess(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const formatCurrency = (value: number) => 
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const profitMargin = analytics.totalRevenue > 0 
    ? ((analytics.totalProfit / analytics.totalRevenue) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financials</h1>
        <p className="text-muted-foreground">Revenue, costs, and break-even tracking</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From completed jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.totalProfit)}</div>
            <p className="text-xs text-muted-foreground">{profitMargin}% margin</p>
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
            <div className="text-2xl font-bold">{formatCurrency(analytics.avgJobValue)}</div>
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
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Monthly target</span>
              <span className="font-medium">{formatCurrency(metrics.totalMonthlyCost)}</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ 
                  width: `${Math.min(100, (analytics.totalRevenue / metrics.totalMonthlyCost) * 100)}%` 
                }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Current: {formatCurrency(analytics.totalRevenue)}</span>
              <span>
                {metrics.totalMonthlyCost > 0 
                  ? `${((analytics.totalRevenue / metrics.totalMonthlyCost) * 100).toFixed(0)}%`
                  : '—'
                }
              </span>
            </div>
          </div>
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

      {/* Revenue Chart */}
      <RevenueChart data={analytics.weeklyRevenue} />
    </div>
  );
}
