import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DailyJobCount } from '@/hooks/useDashboardAnalytics';

interface JobVolumeChartProps {
  data: DailyJobCount[];
}

export function JobVolumeChart({ data }: JobVolumeChartProps) {
  // Show last 14 days for better readability
  const recentData = data.slice(-14);

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle>Job Volume</CardTitle>
        <CardDescription>New jobs created and active jobs over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          {recentData.length > 0 && recentData.some(d => d.created > 0 || d.inProgress > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recentData}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }} 
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }} 
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  className="fill-muted-foreground"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))'
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorCreated)"
                  name="New Jobs"
                />
                <Area
                  type="monotone"
                  dataKey="inProgress"
                  stroke="hsl(var(--chart-2))"
                  fillOpacity={1}
                  fill="url(#colorActive)"
                  name="Active Jobs"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No job data for this period
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
