import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePreviewUrls, useProdAction, useTransferRows } from '@/hooks/useProductionImports';
import { buildTransferList, type TransferLine } from '@/lib/production/transfers';
import { PreviewThumb } from '@/components/production/ProdShared';
import { cn } from '@/lib/utils';

// DTF transfers needed for approved orders. A list only — print the transfers in the usual DTF software.
// /production/transfers (in the app) and /print/transfers (paper copy, no menus).

const PRINT_CSS = `
@page { size: letter portrait; margin: 0.4in; }
@media print { html, body { background: #fff !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
.print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
`;

type Show = 'open' | 'all';

export default function ProductionTransfers({ printMode = false }: { printMode?: boolean }) {
  const { data: rows, isLoading, error } = useTransferRows();
  const [show, setShow] = useState<Show>('open');
  const [store, setStore] = useState<string>('all');
  const mark = useProdAction<{ p_decoration_ids: string[]; p_printed: boolean }>('prod_set_transfers_printed');

  const lines = useMemo(() => buildTransferList(rows ?? []), [rows]);
  const stores = useMemo(() => [...new Set(lines.map((l) => l.store_name ?? 'No store'))].sort(), [lines]);
  const visible = lines.filter(
    (l) => (show === 'all' || l.open_decoration_ids.length > 0) && (store === 'all' || (l.store_name ?? 'No store') === store),
  );
  const { data: urls } = usePreviewUrls(visible.map((l) => l.artwork_hash).filter(Boolean) as string[]);
  const totalOpen = visible.reduce((a, l) => a + (l.quantity - l.printed_quantity), 0);

  const toggle = (l: TransferLine, printed: boolean) =>
    mark.mutate({ p_decoration_ids: printed ? l.open_decoration_ids : l.decoration_ids, p_printed: printed });

  const controls = (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Select value={show} onValueChange={(v) => setShow(v as Show)}>
        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Still to print</SelectItem>
          <SelectItem value="all">All, including printed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={store} onValueChange={setStore}>
        <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stores</SelectItem>
          {stores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      {printMode ? (
        <Button size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Print</Button>
      ) : (
        <Button size="sm" variant="outline" asChild>
          <Link to="/print/transfers" target="_blank"><Printer className="mr-1 h-4 w-4" /> Printable list</Link>
        </Button>
      )}
    </div>
  );

  const body = (
    <>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {!isLoading && visible.length === 0 && (
        <p className="text-muted-foreground">
          {lines.length === 0 ? 'No approved DTF decorations yet. Orders show up here once they’re approved.' : 'Nothing left to print.'}
        </p>
      )}
      <div className="space-y-2">
        {visible.map((l) => {
          const left = l.quantity - l.printed_quantity;
          const done = left === 0;
          return (
            <div key={l.key} className={cn('print-avoid-break flex gap-3 rounded-lg border p-3', done && 'opacity-60')}>
              {!printMode && (
                <Checkbox
                  className="mt-1 h-5 w-5"
                  checked={done}
                  disabled={mark.isPending}
                  onCheckedChange={(v) => toggle(l, v === true)}
                  aria-label="Transfers printed"
                />
              )}
              {printMode && <div className="mt-1 h-5 w-5 shrink-0 rounded border-2 border-black" />}
              <PreviewThumb url={l.artwork_hash ? urls?.[l.artwork_hash] : null} size={64} label={l.design_name ?? 'Artwork'} />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-2xl font-bold tabular-nums">{done ? l.quantity : left}×</span>
                  <span className="font-semibold">{l.design_name ?? 'Design name missing'}</span>
                  <span>{l.colorway ?? '—'}</span>
                  <span className="font-semibold">{l.location ?? 'Location missing'}</span>
                  {l.printed_quantity > 0 && !done && <span className="text-muted-foreground">({l.printed_quantity} already printed)</span>}
                  {done && <span className="text-muted-foreground">printed</span>}
                </div>
                <div className="text-muted-foreground">
                  {l.store_name ?? 'No store'}{l.design_id && ` · design #${l.design_id}`} · InkSoft: {l.methods_inksoft.join(', ')}
                </div>
                <div>Orders: {l.orders.map((o) => `${o.order_number} (${o.quantity})`).join(', ')}</div>
                <div className="text-muted-foreground">Garments: {l.garments.map((g) => `${g.label} × ${g.quantity}`).join(' · ')}</div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Previews are low-resolution images from the work order, for identification only. Print from the production art file.
      </p>
    </>
  );

  if (printMode) {
    return (
      <div className="min-h-screen bg-white p-6 text-black">
        <style>{PRINT_CSS}</style>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="flex-1 text-xl font-bold">DTF transfers to print — {totalOpen} total · {new Date().toLocaleDateString()}</h1>
          {controls}
        </div>
        {body}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/dtf"><ArrowLeft className="mr-1 h-4 w-4" /> DTF</Link>
      </Button>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">DTF Transfers</h1>
          <p className="text-sm text-muted-foreground">
            Transfers needed for approved InkSoft orders, grouped by design, color and location. {totalOpen} still to print.
          </p>
        </div>
        {controls}
      </div>
      <Card><CardContent className="p-4">{body}</CardContent></Card>
    </div>
  );
}

export function ProductionTransfersPrint() {
  return <ProductionTransfers printMode />;
}
