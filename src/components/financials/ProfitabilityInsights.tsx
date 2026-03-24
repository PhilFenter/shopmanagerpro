import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SERVICE_LABELS } from '@/lib/constants';
import { TrendingUp, Percent, AlertTriangle, Users } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { differenceInDays } from 'date-fns';

interface ServiceData {
  service: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  count: number;
}

interface ProfitabilityInsightsProps {
  serviceRevenue: ServiceData[];
  totalRevenue: number;
  totalProfit: number;
  monthlyCost: number;
  periodLabel: string;
}

export function ProfitabilityInsights({ serviceRevenue, totalRevenue, totalProfit, monthlyCost, periodLabel }: ProfitabilityInsightsProps) {
  const [discountPct, setDiscountPct] = useState(10);
  const [dormantDays, setDormantDays] = useState(90);
  const { customers } = useCustomers();

  // Margin by service type
  const serviceMargins = useMemo(() => {
    return serviceRevenue.map(s => ({
      ...s,
      margin: s.revenue > 0 ? ((s.profit / s.revenue) * 100) : 0,
      avgJobRevenue: s.count > 0 ? s.revenue / s.count : 0,
      avgJobProfit: s.count > 0 ? s.profit / s.count : 0,
    })).sort((a, b) => b.margin - a.margin);
  }, [serviceRevenue]);

  // Discount affordability
  const discountAnalysis = useMemo(() => {
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const revenueAfterDiscount = totalRevenue * (1 - discountPct / 100);
    const profitAfterDiscount = revenueAfterDiscount - (totalRevenue - totalProfit);
    const marginAfterDiscount = revenueAfterDiscount > 0 ? (profitAfterDiscount / revenueAfterDiscount) * 100 : 0;
    const maxDiscountBeforeBreakeven = overallMargin; // simplification: margin% ≈ max discount %
    const canAfford = profitAfterDiscount > 0;

    return {
      overallMargin,
      revenueAfterDiscount,
      profitAfterDiscount,
      marginAfterDiscount,
      maxDiscountBeforeBreakeven,
      canAfford,
    };
  }, [totalRevenue, totalProfit, discountPct]);

  // Dormant customers
  const dormantCustomers = useMemo(() => {
    const now = new Date();
    return customers
      .filter(c => {
        if (!c.last_order_date) return (c.total_revenue || 0) > 0; // had revenue but no last order date
        const daysSince = differenceInDays(now, new Date(c.last_order_date));
        return daysSince >= dormantDays && (c.total_revenue || 0) > 0;
      })
      .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
      .slice(0, 15);
  }, [customers, dormantDays]);

  const dormantTotalLTV = dormantCustomers.reduce((s, c) => s + (c.total_revenue || 0), 0);

  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-4">
      {/* Margin by Service */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Margin by Service
          </CardTitle>
          <CardDescription>Profit margins per service type — {periodLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          {serviceMargins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No job data for this period.</p>
          ) : (
            <div className="space-y-3">
              {serviceMargins.map(s => (
                <div key={s.service} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{s.count} jobs · {formatCurrency(s.revenue)} rev</span>
                      <Badge variant={s.margin >= 40 ? 'default' : s.margin >= 20 ? 'secondary' : 'destructive'}>
                        {s.margin.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.margin >= 40 ? 'bg-green-500' : s.margin >= 20 ? 'bg-amber-500' : 'bg-destructive'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, s.margin))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Avg job: {formatCurrency(s.avgJobRevenue)}</span>
                    <span>Avg profit: {formatCurrency(s.avgJobProfit)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discount Affordability Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Discount Calculator
          </CardTitle>
          <CardDescription>Can you afford to run a promotion?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Discount: {discountPct}%</Label>
              <span className="text-sm text-muted-foreground">
                Max before breakeven: ~{discountAnalysis.maxDiscountBeforeBreakeven.toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[discountPct]}
              onValueChange={([v]) => setDiscountPct(v)}
              min={5}
              max={50}
              step={5}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="text-xs text-muted-foreground">Current margin</p>
              <p className="text-lg font-bold">{discountAnalysis.overallMargin.toFixed(1)}%</p>
            </div>
            <div className={`p-3 rounded-lg space-y-1 ${discountAnalysis.canAfford ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
              <p className="text-xs text-muted-foreground">After {discountPct}% discount</p>
              <p className="text-lg font-bold">{discountAnalysis.marginAfterDiscount.toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="text-xs text-muted-foreground">Profit now</p>
              <p className="text-lg font-bold">{formatCurrency(totalProfit)}</p>
            </div>
            <div className={`p-3 rounded-lg space-y-1 ${discountAnalysis.canAfford ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
              <p className="text-xs text-muted-foreground">Profit after discount</p>
              <p className="text-lg font-bold">{formatCurrency(discountAnalysis.profitAfterDiscount)}</p>
            </div>
          </div>

          {!discountAnalysis.canAfford && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>A {discountPct}% discount would put you in the red. Consider a smaller discount or targeting it to specific services with higher margins.</span>
            </div>
          )}
          {discountAnalysis.canAfford && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
              <TrendingUp className="h-4 w-4 mt-0.5 shrink-0" />
              <span>You can afford a {discountPct}% discount and still turn a profit. Consider targeting dormant customers below to re-activate them.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dormant Customers for Reactivation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Reactivation Targets
              </CardTitle>
              <CardDescription>
                Customers with no orders in {dormantDays}+ days — {formatCurrency(dormantTotalLTV)} lifetime value at risk
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Inactive for</Label>
              <Input
                type="number"
                className="w-20"
                value={dormantDays}
                onChange={e => setDormantDays(Math.max(30, parseInt(e.target.value) || 90))}
                min={30}
              />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dormantCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No dormant customers found — great retention!</p>
          ) : (
            <div className="max-h-80 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Lifetime Value</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead>Last Order</TableHead>
                    <TableHead>Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dormantCustomers.map(c => {
                    const daysSince = c.last_order_date
                      ? differenceInDays(new Date(), new Date(c.last_order_date))
                      : '—';
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.company || '—'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(c.total_revenue || 0)}
                        </TableCell>
                        <TableCell className="text-right">{c.total_orders || 0}</TableCell>
                        <TableCell>
                          <Badge variant={typeof daysSince === 'number' && daysSince > 180 ? 'destructive' : 'secondary'} className="text-xs">
                            {typeof daysSince === 'number' ? `${daysSince}d ago` : daysSince}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.email || c.phone || 'No contact'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
