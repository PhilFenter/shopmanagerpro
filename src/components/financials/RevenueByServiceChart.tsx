import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ServiceRevenue } from '@/hooks/useJobAnalytics';

interface RevenueByServiceChartProps {
  data: ServiceRevenue[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
};

export function RevenueByServiceChart({ data }: RevenueByServiceChartProps) {
  const chartData = data.map(d => ({
    name: d.label,
    revenue: d.revenue,
    cost: d.cost,
    profit: d.profit,
  }));

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Revenue by Service</CardTitle>
        <CardDescription>Revenue, materials, and margin by service type</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {chartData.some(d => d.revenue > 0 || d.cost > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }} 
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                  className="fill-muted-foreground"
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))'
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name="Materials" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Gross Margin" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No revenue data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
