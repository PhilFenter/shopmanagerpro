import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ServiceTypeBreakdown } from '@/hooks/useDashboardAnalytics';
import { cn } from '@/lib/utils';

interface ServiceBreakdownChartProps {
  data: ServiceTypeBreakdown[];
}

const COLORS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
];

// Fallback inline styles for chart colors (CSS variables)
const COLOR_STYLES = [
  { backgroundColor: 'hsl(var(--chart-1))' },
  { backgroundColor: 'hsl(var(--chart-2))' },
  { backgroundColor: 'hsl(var(--chart-3))' },
  { backgroundColor: 'hsl(var(--chart-4))' },
  { backgroundColor: 'hsl(var(--chart-5))' },
];

export function ServiceBreakdownChart({ data }: ServiceBreakdownChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Types</CardTitle>
        <CardDescription>Active jobs by service</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-3">
            {/* Stacked bar summary */}
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              {data.map((item, i) => {
                const pct = total > 0 ? (item.count / total) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={item.service}
                    className="h-full rounded-sm first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${pct}%`, ...COLOR_STYLES[i % COLOR_STYLES.length] }}
                  />
                );
              })}
            </div>

            {/* Breakdown list */}
            <div className="space-y-2 pt-1">
              {data.map((item, i) => {
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.service} className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-sm shrink-0"
                      style={COLOR_STYLES[i % COLOR_STYLES.length]}
                    />
                    <span className="text-sm flex-1 truncate">{item.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{item.count}</span>
                    <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            No active jobs
          </div>
        )}
      </CardContent>
    </Card>
  );
}
