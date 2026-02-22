import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ServiceTypeBreakdown } from '@/hooks/useDashboardAnalytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ServiceBreakdownChartProps {
  data: ServiceTypeBreakdown[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function ServiceBreakdownChart({ data }: ServiceBreakdownChartProps) {
  const chartData = data.map(d => ({
    name: d.label,
    count: d.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Types</CardTitle>
        <CardDescription>Active jobs by service</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 12, fill: 'hsl(var(--foreground))' }}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
