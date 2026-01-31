import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StageBreakdown } from '@/hooks/useJobAnalytics';
import { Progress } from '@/components/ui/progress';

interface StageBreakdownChartProps {
  data: StageBreakdown[];
}

export function StageBreakdownChart({ data }: StageBreakdownChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Stages</CardTitle>
        <CardDescription>Active jobs by stage</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.length > 0 ? (
            data.slice(0, 5).map((item) => {
              const percentage = total > 0 ? (item.count / total) * 100 : 0;
              return (
                <div key={item.stage} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No active jobs
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
