import { useActionItems } from '@/hooks/useActionItems';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Clock, ListTodo } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function ActionItemsDashboardCard() {
  const { overdueItems, dueTodayItems, upcomingItems, noDueDateItems, completeItem, isLoading } = useActionItems();

  const totalDue = overdueItems.length + dueTodayItems.length;
  const allVisible = [...overdueItems, ...dueTodayItems, ...upcomingItems.slice(0, 2), ...noDueDateItems.slice(0, 2)].slice(0, 6);

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListTodo className="h-4 w-4" />
          Action Items
        </CardTitle>
        <div className="flex items-center gap-2">
          {overdueItems.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {overdueItems.length} overdue
            </Badge>
          )}
          {dueTodayItems.length > 0 && (
            <Badge className="text-xs bg-amber-500 hover:bg-amber-600">
              {dueTodayItems.length} today
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {allVisible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No action items — you're all caught up! 🎉</p>
        ) : (
          <div className="space-y-2">
            {allVisible.map((item) => {
              const isOverdue = item.due_date && new Date(item.due_date) < new Date();
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm',
                    isOverdue && 'bg-destructive/10'
                  )}
                >
                  <button
                    onClick={() => completeItem.mutate(item.id)}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.customer_name && <span>{item.customer_name}</span>}
                      {item.due_date && (
                        <span className={cn('flex items-center gap-1', isOverdue && 'text-destructive font-medium')}>
                          {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {format(new Date(item.due_date), 'MMM d')}
                        </span>
                      )}
                      {item.priority === 'urgent' && (
                        <Badge variant="destructive" className="text-[10px] px-1 py-0">URGENT</Badge>
                      )}
                      {item.priority === 'high' && (
                        <Badge className="text-[10px] px-1 py-0 bg-amber-500">HIGH</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Button variant="outline" size="sm" className="w-full mt-3" asChild>
          <Link to="/action-items">View All Action Items</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
