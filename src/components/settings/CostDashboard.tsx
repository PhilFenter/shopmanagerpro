import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBusinessMetrics } from '@/hooks/useBusinessMetrics';
import { Loader2, DollarSign, Clock, TrendingUp, Calculator } from 'lucide-react';

export function CostDashboard() {
  const metrics = useBusinessMetrics();

  if (metrics.isLoading) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Cost Summary</CardTitle>
        <CardDescription>
          Monthly operating costs and hourly rates for job costing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Monthly Labor */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Monthly Labor
            </div>
            <div className="text-2xl font-bold">{formatCurrency(metrics.monthlyLaborCost)}</div>
            <div className="text-xs text-muted-foreground">
              +{formatCurrency(metrics.payrollTaxBurden)} taxes ({(metrics.payrollTaxRate * 100).toFixed(1)}%)
            </div>
          </div>

          {/* Monthly Overhead */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Monthly Overhead
            </div>
            <div className="text-2xl font-bold">{formatCurrency(metrics.monthlyOverheadCost)}</div>
            <div className="text-xs text-muted-foreground">Fixed costs</div>
          </div>

          {/* Total Monthly */}
          <div className="p-4 rounded-lg bg-primary/10 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calculator className="h-4 w-4" />
              Total Monthly
            </div>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalMonthlyCost)}</div>
            <div className="text-xs text-muted-foreground">Break-even target</div>
          </div>

          {/* Cost Per Hour */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Cost Per Hour
            </div>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalCostPerHour)}</div>
            <div className="text-xs text-muted-foreground">
              Labor {formatCurrency(metrics.laborCostPerHour)} + Overhead {formatCurrency(metrics.overheadCostPerHour)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
