import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ScanLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDate, useIsProdManager } from '@/components/production/ProdShared';
import { orderStage, useFloorOrders, useSpotCount } from '@/hooks/useProductionFloor';
import { useProdAction } from '@/hooks/useProductionImports';
import { cn } from '@/lib/utils';

const STAGE_TONE: Record<string, string> = {
  'Print labels': 'bg-amber-100 text-amber-900',
  'Final check': 'bg-violet-100 text-violet-900',
  'Ready to pack': 'bg-green-100 text-green-900',
  'Ready to ship': 'bg-green-100 text-green-900',
  Packed: 'bg-neutral-200 text-neutral-700',
  Shipped: 'bg-neutral-200 text-neutral-700',
};

function SpotSetting() {
  const { data } = useSpotCount();
  const [v, setV] = useState('');
  const save = useProdAction<{ p_count: number }>('prod_set_spot_count', 'Spot count saved');
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Table spots:</span>
      <Input className="h-8 w-20" type="number" min={1} max={200} placeholder={String(data ?? '')} value={v} onChange={(e) => setV(e.target.value)} />
      <Button size="sm" variant="outline" disabled={!v || save.isPending} onClick={() => save.mutate({ p_count: Number(v) }, { onSuccess: () => setV('') })}>
        Save
      </Button>
    </div>
  );
}

export default function ProductionBoard() {
  const [view, setView] = useState<'active' | 'done'>('active');
  const { data, isLoading, error } = useFloorOrders(view);
  const { data: spotCount } = useSpotCount();
  const isManager = useIsProdManager();
  const nav = useNavigate();
  const used = new Set((data ?? []).flatMap((o) => o.spots));

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Production Board</h1>
          <div className="flex rounded-md border p-0.5">
            {(['active', 'done'] as const).map((v) => (
              <Button key={v} size="sm" variant={view === v ? 'secondary' : 'ghost'} onClick={() => setView(v)}>
                {v === 'active' ? 'In production' : 'Packed / shipped (14 days)'}
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          {view === 'active' && spotCount && (
            <span className="text-sm text-muted-foreground">{used.size} of {spotCount} spots in use</span>
          )}
          {isManager && <SpotSetting />}
          <Button asChild><Link to="/scan"><ScanLine className="mr-1 h-4 w-4" />Scan Station</Link></Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Orders show up here after they're approved on the InkSoft Imports page. Click an order to print its garment labels, do the final check, or print the pickup label.
        </p>

        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : error ? (
          <div className="text-destructive">{(error as Error).message}</div>
        ) : (data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No orders here.</div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Labels</TableHead>
                  <TableHead>Decorations</TableHead>
                  <TableHead>Spot</TableHead>
                  <TableHead>In spot</TableHead>
                  <TableHead>Pickup / ship</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((o) => {
                  const s = orderStage(o);
                  return (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => nav(`/production/orders/${o.id}`)}>
                      <TableCell className="font-mono font-semibold">{o.order_number}</TableCell>
                      <TableCell>
                        <div>{o.customer_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{o.store_name}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(o.due_date)}</TableCell>
                      <TableCell className={cn(s.printed < s.pieces && 'font-semibold text-amber-700')}>{s.printed}/{s.pieces}</TableCell>
                      <TableCell>{s.done}/{s.tasks}</TableCell>
                      <TableCell className="text-lg font-bold">{o.spots.join(', ') || '—'}</TableCell>
                      <TableCell>{s.inSpot}/{s.pieces}</TableCell>
                      <TableCell>
                        {o.fulfillment === 'unknown' ? <Badge variant="outline">Not set</Badge> : o.fulfillment === 'ship' ? 'Ship' : 'Pickup'}
                      </TableCell>
                      <TableCell><span className={cn('rounded px-2 py-0.5 text-xs font-semibold', STAGE_TONE[s.stage] ?? 'bg-sky-100 text-sky-900')}>{s.stage}</span></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
