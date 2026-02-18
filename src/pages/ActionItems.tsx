import { useState } from 'react';
import { useActionItems, ActionItem } from '@/hooks/useActionItems';
import { QuickCaptureDialog } from '@/components/action-items/QuickCaptureDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Trash2,
  RotateCcw,
  ListTodo,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ActionItems() {
  const {
    overdueItems,
    dueTodayItems,
    upcomingItems,
    noDueDateItems,
    completedItems,
    isLoading,
    completeItem,
    updateItem,
    deleteItem,
  } = useActionItems();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('open');

  const filterItems = (items: ActionItem[]) =>
    search
      ? items.filter(
          (i) =>
            i.title.toLowerCase().includes(search.toLowerCase()) ||
            i.customer_name?.toLowerCase().includes(search.toLowerCase())
        )
      : items;

  const handleComplete = (id: string) => {
    completeItem.mutate(id, {
      onSuccess: () => toast.success('Done! ✅'),
    });
  };

  const handleReopen = (id: string) => {
    updateItem.mutate(
      { id, status: 'open', completed_at: null } as any,
      { onSuccess: () => toast.success('Reopened') }
    );
  };

  const handleDelete = (id: string) => {
    deleteItem.mutate(id, {
      onSuccess: () => toast.success('Deleted'),
    });
  };

  const ItemRow = ({ item, showComplete = true }: { item: ActionItem; showComplete?: boolean }) => {
    const isOverdue = item.status === 'open' && item.due_date && new Date(item.due_date) < new Date();
    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors',
          isOverdue && 'border-destructive/50 bg-destructive/5',
          item.status === 'completed' && 'opacity-60'
        )}
      >
        {showComplete && (
          <button
            onClick={() => handleComplete(item.id)}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
          >
            <CheckCircle2 className="h-5 w-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium', item.status === 'completed' && 'line-through')}>
            {item.title}
          </p>
          {item.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
            {item.customer_name && (
              <Badge variant="secondary" className="text-xs">
                {item.customer_name}
              </Badge>
            )}
            {item.due_date && (
              <span
                className={cn('flex items-center gap-1', isOverdue && 'text-destructive font-semibold')}
              >
                {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {format(new Date(item.due_date), 'MMM d, yyyy')}
                {isOverdue && ` (${formatDistanceToNow(new Date(item.due_date))} overdue)`}
              </span>
            )}
            {item.priority !== 'normal' && (
              <Badge
                variant={item.priority === 'urgent' ? 'destructive' : 'default'}
                className={cn(
                  'text-xs',
                  item.priority === 'high' && 'bg-amber-500 hover:bg-amber-600',
                  item.priority === 'low' && 'bg-muted text-muted-foreground'
                )}
              >
                {item.priority}
              </Badge>
            )}
            {item.source !== 'manual' && (
              <span className="text-muted-foreground">via {item.source}</span>
            )}
            {item.completed_at && (
              <span>Completed {format(new Date(item.completed_at), 'MMM d')}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {item.status === 'completed' && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleReopen(item.id)}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const Section = ({ title, icon, items, badge }: { title: string; icon: React.ReactNode; items: ActionItem[]; badge?: React.ReactNode }) => {
    const filtered = filterItems(items);
    if (filtered.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
          {badge}
        </div>
        {filtered.map((item) => (
          <ItemRow key={item.id} item={item} showComplete={item.status === 'open'} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListTodo className="h-6 w-6" />
            Action Items
          </h1>
          <p className="text-muted-foreground">
            {overdueItems.length > 0
              ? `${overdueItems.length} overdue — let's get caught up`
              : 'Track your commitments and follow-ups'}
          </p>
        </div>
        <QuickCaptureDialog
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Action Item
            </Button>
          }
        />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search action items..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="open">
            Open ({overdueItems.length + dueTodayItems.length + upcomingItems.length + noDueDateItems.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-6 mt-4">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : (
            <>
              <Section
                title="Overdue"
                icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
                items={overdueItems}
                badge={<Badge variant="destructive" className="text-xs">{overdueItems.length}</Badge>}
              />
              <Section
                title="Due Today"
                icon={<Clock className="h-4 w-4 text-amber-500" />}
                items={dueTodayItems}
              />
              <Section
                title="Upcoming"
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                items={upcomingItems}
              />
              <Section
                title="No Due Date"
                icon={<ListTodo className="h-4 w-4 text-muted-foreground" />}
                items={noDueDateItems}
              />
              {overdueItems.length + dueTodayItems.length + upcomingItems.length + noDueDateItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CheckCircle2 className="h-12 w-12 text-primary/50" />
                  <h3 className="mt-4 text-lg font-medium">All caught up! 🎉</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    No open action items. Add one when you make a commitment.
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-2 mt-4">
          {filterItems(completedItems).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No completed items yet</p>
          ) : (
            filterItems(completedItems).map((item) => (
              <ItemRow key={item.id} item={item} showComplete={false} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Floating quick capture button */}
      <QuickCaptureDialog />
    </div>
  );
}
