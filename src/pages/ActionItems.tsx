import { useState } from 'react';
import { useActionItems, ActionItem } from '@/hooks/useActionItems';
import { useQuery } from '@tanstack/react-query';
import { QuickCaptureDialog } from '@/components/action-items/QuickCaptureDialog';
import { ActionItemDetailSheet } from '@/components/action-items/ActionItemDetailSheet';
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
  DollarSign,
  Loader2,
  Package,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { QuoteLineItemsSummary } from '@/components/action-items/QuoteLineItemsSummary';

import { useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('open');
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);

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

  const handleSaveItem = (id: string, updates: Partial<ActionItem>) => {
    updateItem.mutate({ id, ...updates } as any, {
      onSuccess: () => toast.success('Updated'),
    });
  };

  // Extract style number from action item title like "Missing price: 112"
  const extractStyle = (title: string) => {
    const match = title.match(/Missing price:\s*(.+)/i);
    return match ? match[1].trim() : null;
  };

  const handleFillPrice = async (item: ActionItem, price: number) => {
    const style = extractStyle(item.title);
    if (!style || price <= 0) return;

    setFillingId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke('fill-style-price', {
        body: { styleNumber: style, piecePrice: price, actionItemId: item.id },
      });
      if (error) throw error;
      toast.success(`Updated ${data.garmentsUpdated} garments across ${data.jobsUpdated} jobs at $${price}`);
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setFillingId(null);
    }
  };

  const ItemRow = ({ item, showComplete = true }: { item: ActionItem; showComplete?: boolean }) => {
    const isOverdue = item.status === 'open' && item.due_date && new Date(item.due_date) < new Date();
    const isMissingPrice = item.source === 'shopify-sync' && item.status === 'open' && extractStyle(item.title);
    const styleNumber = extractStyle(item.title);
    const [priceInput, setPriceInput] = useState('');

    // Query affected orders for missing-price items
    const { data: affectedOrders } = useQuery({
      queryKey: ['affected-orders', styleNumber],
      queryFn: async () => {
        if (!styleNumber) return [];
        const { data } = await supabase
          .from('job_garments')
          .select('job_id, item_number, jobs:job_id(order_number, customer_name)')
          .or(`item_number.eq.${styleNumber},style.ilike.%${styleNumber}%`);
        if (!data) return [];
        // Deduplicate by order number
        const seen = new Set<string>();
        return data
          .filter((g: any) => {
            const orderNum = g.jobs?.order_number;
            if (!orderNum || seen.has(orderNum)) return false;
            seen.add(orderNum);
            return true;
          })
          .map((g: any) => ({ orderNumber: g.jobs.order_number, customerName: g.jobs.customer_name }))
          .sort((a: any, b: any) => parseInt(b.orderNumber) - parseInt(a.orderNumber))
          .slice(0, 10);
      },
      enabled: !!isMissingPrice && !!styleNumber,
      staleTime: 5 * 60 * 1000,
    });

    return (
      <div
        className={cn(
          'flex flex-col gap-2 rounded-lg border px-3 py-3 transition-colors cursor-pointer hover:bg-accent/50',
          isOverdue && 'border-destructive/50 bg-destructive/5',
          item.status === 'completed' && 'opacity-60'
        )}
        onClick={() => setEditingItem(item)}
      >
        <div className="flex items-start gap-3">
          {showComplete && (
            <button
              onClick={(e) => { e.stopPropagation(); handleComplete(item.id); }}
              className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
            >
              <CheckCircle2 className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className={cn('font-medium flex items-center gap-1.5', item.status === 'completed' && 'line-through')}>
              {item.title}
              {item.source === 'website-brand-builder' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-gray-900 text-amber-400 border-amber-500/30 dark:bg-gray-800">Brand Builder</Badge>
              )}
            </p>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
            )}
            {/* Quote line items summary for website quotes */}
            {item.quote_id && (
              <QuoteLineItemsSummary quoteId={item.quote_id} compact />
            )}
            {/* Affected orders for missing-price items */}
            {isMissingPrice && affectedOrders && affectedOrders.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Affects:</span>
                {affectedOrders.map((o: any) => (
                  <Badge key={o.orderNumber} variant="outline" className="text-xs h-5 px-1.5">
                    #{o.orderNumber} {o.customerName}
                  </Badge>
                ))}
                {affectedOrders.length >= 10 && (
                  <span className="text-xs text-muted-foreground">+ more</span>
                )}
              </div>
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
                <Badge variant="outline" className="text-xs">
                  {item.source}
                </Badge>
              )}
              {/* Checklist progress */}
              {Array.isArray((item as any).checklist) && (item as any).checklist.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  ✓ {(item as any).checklist.filter((s: any) => s.done).length}/{(item as any).checklist.length}
                </span>
              )}
              {item.completed_at && (
                <span>Completed {format(new Date(item.completed_at), 'MMM d')}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            {item.status === 'completed' && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleReopen(item.id); }}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Inline price fill for missing price action items */}
        {isMissingPrice && (
          <div className="flex items-center gap-2 ml-8 p-2 rounded bg-primary/5 border border-primary/20" onClick={e => e.stopPropagation()}>
            <DollarSign className="h-4 w-4 text-primary shrink-0" />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Cost per unit"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="h-8 w-28"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && priceInput) handleFillPrice(item, parseFloat(priceInput));
              }}
            />
            <Button
              size="sm"
              className="h-8"
              disabled={!priceInput || parseFloat(priceInput) <= 0 || fillingId === item.id}
              onClick={() => handleFillPrice(item, parseFloat(priceInput))}
            >
              {fillingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fill & Backfill'}
            </Button>
          </div>
        )}
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

      {/* Edit detail sheet */}
      <ActionItemDetailSheet
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open) => { if (!open) setEditingItem(null); }}
        onSave={handleSaveItem}
      />
    </div>
  );
}
