import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Package, Plus, Printer, Truck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDate, ReasonDialog } from '@/components/production/ProdShared';
import { liveGarments, liveTasks, METHOD_LABEL, orderStage, shortCode, useFloorOrder, type FloorOrderFull } from '@/hooks/useProductionFloor';
import { useProdAction } from '@/hooks/useProductionImports';
import { cn } from '@/lib/utils';

/** Counted check before the order leaves its spot: one line per product/color/size. */
function FinalCheckDialog({ order, open, onOpenChange }: { order: FloorOrderFull; open: boolean; onOpenChange: (o: boolean) => void }) {
  const lines = useMemo(() => {
    const m = new Map<string, { label: string; size: string; n: number }>();
    for (const g of liveGarments(order.garments)) {
      const label = [g.mfg_sku, g.color].filter(Boolean).join(' · ') || g.product_name || 'Garment';
      const k = `${label}|${g.size}`;
      const e = m.get(k) ?? { label, size: g.size, n: 0 };
      e.n++;
      m.set(k, e);
    }
    return [...m.entries()];
  }, [order]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const check = useProdAction<{ p_order_id: string }>('prod_final_check', 'Final check passed');
  const all = ticked.size === lines.length;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setTicked(new Set()); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Final check: {order.order_number}</DialogTitle>
          <DialogDescription>Count what's in spot {order.spots.join(', ') || '—'} and tick each line. Check the decorations look right.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {lines.map(([k, l]) => (
            <label key={k} className="flex cursor-pointer items-center gap-3 rounded border p-2">
              <Checkbox checked={ticked.has(k)} onCheckedChange={(c) => setTicked((s) => { const n = new Set(s); if (c) n.add(k); else n.delete(k); return n; })} />
              <span className="w-10 text-xl font-bold">{l.n}×</span>
              <span className="w-14 text-lg font-semibold">{l.size}</span>
              <span className="text-sm">{l.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!all || check.isPending} onClick={() => check.mutate({ p_order_id: order.id }, { onSuccess: () => onOpenChange(false) })}>
            <Check className="mr-1 h-4 w-4" />Everything is here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductionOrderFloor() {
  const { orderId } = useParams();
  const { data: o, isLoading, error } = useFloorOrder(orderId);
  const [checkOpen, setCheckOpen] = useState(false);
  const [release, setRelease] = useState<number | null>(null);
  const setTask = useProdAction<{ p_task_id: string; p_done: boolean }>('prod_set_task');
  const addSpot = useProdAction<{ p_order_id: string }, number>('prod_add_spot', (n) => `Spot ${n} added`);
  const releaseSpot = useProdAction<{ p_order_id: string; p_spot: number; p_reason: string }>('prod_release_spot', 'Spot released');
  const ship = useProdAction<{ p_order_id: string }>('prod_mark_shipped', 'Marked shipped');

  if (isLoading) return <><div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div></>;
  if (error || !o) return <><div className="p-6 text-destructive">{(error as Error)?.message ?? 'Order not found'}</div></>;

  const s = orderStage(o);
  const inProduction = o.status === 'approved' && !o.packed_at && !o.shipped_at;
  const dept = (o.checkout_fields ?? []).filter((f) => f.value?.trim());

  return (
    <>
      <div className="space-y-4 p-4">
        <Button variant="ghost" size="sm" asChild><Link to="/production/orders"><ArrowLeft className="mr-1 h-4 w-4" />Production Board</Link></Button>
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <h1 className="font-mono text-3xl font-bold">{o.order_number}</h1>
            <div className="text-lg">{o.customer_name ?? 'No customer name'}</div>
            <div className="text-sm text-muted-foreground">
              {o.store_name} · Due {fmtDate(o.due_date)}
              {dept.map((f) => <span key={f.label}> · {f.label}: {f.value}</span>)}
            </div>
            <div className="mt-1 text-sm">
              {o.fulfillment === 'pickup' ? `Pickup${o.pickup_location ? `: ${o.pickup_location}` : ''}`
                : o.fulfillment === 'ship' ? `Ship${o.shipping_method ? `: ${o.shipping_method}` : ''}`
                : <Badge variant="outline">Pickup or ship not set (add the Orders CSV on the import page)</Badge>}
            </div>
          </div>
          <div className="flex-1" />
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Spot</div>
            <div className="text-5xl font-black">{o.spots.join(', ') || '—'}</div>
          </div>
        </div>

        {o.status !== 'approved' && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">This order is back in review. Its labels scan as “hold” until it's approved again.</div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant={s.printed < s.pieces ? 'default' : 'outline'}>
            <Link to={`/print/labels?order=${o.id}&which=unprinted`}><Printer className="mr-1 h-4 w-4" />Print garment labels ({s.pieces - s.printed} new)</Link>
          </Button>
          <Button asChild variant="outline"><Link to={`/print/labels?order=${o.id}&which=all`}>Reprint all {s.pieces}</Link></Button>
          {inProduction && (
            <Button variant={s.stage === 'Final check' ? 'default' : 'outline'} disabled={s.inSpot < s.pieces || !!o.check_passed_at} onClick={() => setCheckOpen(true)}>
              <Check className="mr-1 h-4 w-4" />{o.check_passed_at ? 'Final check passed' : `Final check (${s.inSpot}/${s.pieces} in spot)`}
            </Button>
          )}
          {o.fulfillment !== 'ship' && (
            <Button asChild variant={o.check_passed_at && !o.packed_at ? 'default' : 'outline'} disabled={!o.check_passed_at}>
              {o.check_passed_at
                ? <Link to={`/print/pickup/${o.id}`}><Package className="mr-1 h-4 w-4" />Print 4×6 pickup label</Link>
                : <span><Package className="mr-1 h-4 w-4" />Pickup label (after final check)</span>}
            </Button>
          )}
          {o.fulfillment !== 'pickup' && !o.shipped_at && (
            <Button variant="outline" disabled={!o.check_passed_at || ship.isPending} onClick={() => ship.mutate({ p_order_id: o.id })}>
              <Truck className="mr-1 h-4 w-4" />Mark shipped
            </Button>
          )}
          {inProduction && (
            <Button variant="ghost" onClick={() => addSpot.mutate({ p_order_id: o.id })} disabled={addSpot.isPending}>
              <Plus className="mr-1 h-4 w-4" />Add a spot (order too big)
            </Button>
          )}
          {o.spots.map((sp) => (
            <Button key={sp} variant="ghost" size="sm" onClick={() => setRelease(sp)}><X className="mr-1 h-3 w-3" />Free spot {sp}</Button>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">
          Stage: <b>{s.stage}</b> · labels {s.printed}/{s.pieces} · decorations {s.done}/{s.tasks} · in spot {s.inSpot}/{s.pieces}
          {o.packed_at && <> · packed {new Date(o.packed_at).toLocaleString()}</>}
          {o.shipped_at && <> · shipped {new Date(o.shipped_at).toLocaleString()}</>}
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Garment</TableHead>
                <TableHead>Decorations (click to mark done or undo)</TableHead>
                <TableHead>Spot</TableHead>
                <TableHead>Printed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.garments.map((g) => (
                <TableRow key={g.id} className={cn(g.voided_at && 'opacity-50')}>
                  <TableCell className={cn('font-mono font-semibold', g.voided_at && 'line-through')}>{shortCode(o.order_number, g.seq)}</TableCell>
                  <TableCell className="text-lg font-bold">{g.size}</TableCell>
                  <TableCell className="text-sm">{[g.mfg_sku, g.color].filter(Boolean).join(' · ')}</TableCell>
                  <TableCell>
                    {g.voided_at ? <span className="text-sm text-destructive">Removed: {g.void_reason ?? 'no longer on the order'}. Throw this label away.</span> : (
                      <div className="flex flex-wrap gap-1">
                        {liveTasks(g).map((t) => (
                          <Button key={t.id} size="sm" variant={t.status === 'done' ? 'secondary' : 'outline'}
                            className={cn('h-7', t.status === 'done' && 'text-green-700')}
                            disabled={!inProduction || setTask.isPending || (t.status === 'done' && !!g.assembled_at)}
                            title={t.status === 'done' ? `Done ${t.done_at ? new Date(t.done_at).toLocaleString() : ''} (${t.done_station ?? ''}). Click to undo.` : 'Click to mark done by hand'}
                            onClick={() => setTask.mutate({ p_task_id: t.id, p_done: t.status !== 'done' })}>
                            {t.status === 'done' ? '✓' : '○'} {t.location} {METHOD_LABEL[t.method] ?? t.method}
                          </Button>
                        ))}
                        {liveTasks(g).length === 0 && <span className="text-sm text-muted-foreground">No decoration</span>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-bold">{g.assembled_spot ?? '—'}</TableCell>
                  <TableCell className="text-sm">{g.label_printed_at ? '✓' : <span className="text-amber-700">not yet</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <FinalCheckDialog order={o} open={checkOpen} onOpenChange={setCheckOpen} />
      <ReasonDialog
        open={release !== null}
        onOpenChange={(v) => { if (!v) setRelease(null); }}
        title={`Free spot ${release}?`}
        description="Use this if the order was moved or the spot was assigned by mistake. Packing and shipping free spots automatically."
        confirmLabel="Free spot"
        busy={releaseSpot.isPending}
        onConfirm={(reason) => release !== null && releaseSpot.mutate({ p_order_id: o.id, p_spot: release, p_reason: reason }, { onSuccess: () => setRelease(null) })}
      />
    </>
  );
}
