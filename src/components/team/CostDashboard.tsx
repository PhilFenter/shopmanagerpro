import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useBusinessMetrics } from '@/hooks/useBusinessMetrics';
import { useWorkers } from '@/hooks/useWorkers';
import { useOverheadItems } from '@/hooks/useOverheadItems';
import { Users, Building2, DollarSign, Clock, TrendingUp } from 'lucide-react';

export function CostDashboard() {
  const { workers, monthlyLaborCost, totalMonthlyHours } = useWorkers();
  const { totalMonthlyOverhead } = useOverheadItems();
  const metrics = useBusinessMetrics();

  const formatCurrency = (value: number) => 
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const activeWorkers = workers.filter(w => w.is_active).length;
  const totalMonthlyCosts = monthlyLaborCost + totalMonthlyOverhead;
  
  // Calculate percentages for the breakdown
  const laborPercent = totalMonthlyCosts > 0 ? (monthlyLaborCost / totalMonthlyCosts) * 100 : 0;
  const overheadPercent = totalMonthlyCosts > 0 ? (totalMonthlyOverhead / totalMonthlyCosts) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeWorkers}</div>
            <p className="text-xs text-muted-foreground">{workers.length} total team members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Labor</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthlyLaborCost)}</div>
            <p className="text-xs text-muted-foreground">Payroll only (no taxes)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Overhead</CardTitle>
            <Building2 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMonthlyOverhead)}</div>
            <p className="text-xs text-muted-foreground">Non-payroll expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Monthly</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMonthlyCosts)}</div>
            <p className="text-xs text-muted-foreground">Labor + Overhead</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
          <CardDescription>Monthly operating costs split between labor and overhead</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visual breakdown bars */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  Labor Costs
                </span>
                <span className="font-medium">{formatCurrency(monthlyLaborCost)} ({laborPercent.toFixed(1)}%)</span>
              </div>
              <Progress value={laborPercent} className="h-3 [&>div]:bg-blue-500" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  Overhead Costs
                </span>
                <span className="font-medium">{formatCurrency(totalMonthlyOverhead)} ({overheadPercent.toFixed(1)}%)</span>
              </div>
              <Progress value={overheadPercent} className="h-3 [&>div]:bg-orange-500" />
            </div>
          </div>

          {/* Hourly rates */}
          <div className="grid gap-4 sm:grid-cols-3 pt-4 border-t">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <div className="text-2xl font-bold">{totalMonthlyHours.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">Monthly Hours</p>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <TrendingUp className="h-5 w-5 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{formatCurrency(metrics.laborCostPerHour)}</div>
              <p className="text-xs text-muted-foreground">Labor Cost/Hour</p>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <TrendingUp className="h-5 w-5 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold">{formatCurrency(metrics.overheadCostPerHour)}</div>
              <p className="text-xs text-muted-foreground">Overhead Cost/Hour</p>
            </div>
          </div>

          {/* Total cost per hour */}
          <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div>
              <p className="font-medium">Job Costing Rate</p>
              <p className="text-xs text-muted-foreground">Labor + Overhead per hour (use for pricing)</p>
            </div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(metrics.totalCostPerHour)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
