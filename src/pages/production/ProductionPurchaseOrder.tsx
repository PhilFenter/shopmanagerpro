import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useImportBatch } from '@/hooks/useProductionImports';
import { buildPurchaseOrder, purchaseOrderCsv, type PoSourceItem } from '@/lib/production/purchaseOrder';

// /print/po/:batchId — blank garments to buy for one import, combined by style, color and size.
// A list to order from. Nothing is sent to SanMar or any other vendor.

const PO_CSS = `
@page { size: letter landscape; margin: 0.4in; }
@media print { html, body { background: #fff !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
.po-table th, .po-table td { border: 1px solid #999; padding: 3px 6px; }
.po-table tr { break-inside: avoid; page-break-inside: avoid; }
`;

export default function ProductionPurchaseOrder() {
  const { batchId } = useParams();
  const { data, isLoading, error } = useImportBatch(batchId);
  const [includeReview, setIncludeReview] = useState(false);

  const live = useMemo(() => (data?.orders ?? []).filter((o) => o.order.status !== 'cancelled'), [data]);
  const approved = live.filter((o) => o.order.status === 'approved');
  const notApproved = live.filter((o) => o.order.status !== 'approved');
  const included = includeReview ? live : approved;

  const po = useMemo(() => {
    const items: PoSourceItem[] = included.flatMap((o) =>
      o.items.map((it) => ({
        order_number: o.order.order_number,
        mfg_sku: it.mfg_sku,
        color: it.color,
        product_name: it.product_name,
        sizes: it.prod_item_sizes.map((s) => ({ size: s.size, quantity: s.quantity })),
      })),
    );
    return buildPurchaseOrder(items);
  }, [included]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Blank garment order';
    return () => { document.title = prev; };
  }, []);

  const download = () => {
    const blob = new Blob([purchaseOrderCsv(po)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `blank-garments-${(data?.batch.file_name ?? 'import').replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (isLoading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error || !data) return <div className="p-6 text-red-700">{(error as Error)?.message ?? 'Import not found'}</div>;

  const checkLines = po.lines.filter((l) => l.needsCheck).length;

  return (
    <div className="min-h-screen bg-white p-6 text-black">
      <style>{PO_CSS}</style>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/production/imports/${data.batch.id}`}><ArrowLeft className="mr-1 h-4 w-4" />Back to import</Link>
        </Button>
        <div className="flex-1" />
        {notApproved.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeReview} onCheckedChange={(v) => setIncludeReview(v === true)} />
            Include {notApproved.length} order{notApproved.length === 1 ? '' : 's'} not approved yet
          </label>
        )}
        <Button size="sm" variant="outline" onClick={download} disabled={po.lines.length === 0}><Download className="mr-1 h-4 w-4" />Download CSV</Button>
        <Button size="sm" onClick={() => window.print()} disabled={po.lines.length === 0}><Printer className="mr-1 h-4 w-4" />Print</Button>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-x-8 gap-y-2">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Blank garment order</h1>
          <div className="text-sm">Hells Canyon Designs · {data.batch.file_name} · {new Date().toLocaleDateString()}</div>
        </div>
        <div className="text-sm">Vendor: <span className="inline-block w-48 border-b border-black">&nbsp;</span></div>
        <div className="text-sm">PO #: <span className="inline-block w-32 border-b border-black">&nbsp;</span></div>
      </div>

      <p className="mb-3 text-sm">
        {po.total} piece{po.total === 1 ? '' : 's'} · {po.lines.length} style/color line{po.lines.length === 1 ? '' : 's'} · from {included.length} order{included.length === 1 ? '' : 's'}
        {!includeReview && notApproved.length > 0 && (
          <span className="font-semibold text-amber-800"> · Not included (not approved yet): {notApproved.map((o) => o.order.order_number).join(', ')}</span>
        )}
      </p>

      {checkLines > 0 && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-900">
          {checkLines} line{checkLines === 1 ? ' is' : 's are'} missing a style number or color on the work order. Check the order before buying.
        </p>
      )}

      {po.lines.length === 0 ? (
        <p className="text-neutral-600">{approved.length === 0 ? 'No approved orders in this import yet.' : 'No garments on these orders.'}</p>
      ) : (
        <table className="po-table w-full border-collapse text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left">Style</th>
              <th className="text-left">Color</th>
              <th className="text-left">Description</th>
              {po.sizes.map((s) => <th key={s} className="w-12 text-center">{s}</th>)}
              <th className="w-14 text-center">Total</th>
              <th className="text-left">Orders</th>
              <th className="w-8 print:table-cell">✓</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.key} className={l.needsCheck ? 'bg-red-50' : undefined}>
                <td className="font-semibold">{l.mfg_sku || <span className="text-red-700">MISSING</span>}</td>
                <td>{l.color || <span className="text-red-700">MISSING</span>}</td>
                <td className="text-neutral-700">{l.product_name ?? ''}</td>
                {po.sizes.map((s) => <td key={s} className="text-center tabular-nums font-semibold">{l.bySize[s] ?? ''}</td>)}
                <td className="text-center font-bold tabular-nums">{l.total}</td>
                <td className="text-xs">{l.orders.join(', ')}</td>
                <td />
              </tr>
            ))}
            <tr className="bg-neutral-100 font-bold">
              <td colSpan={3} className="text-right">Total</td>
              {po.sizes.map((s) => (
                <td key={s} className="text-center tabular-nums">{po.lines.reduce((a, l) => a + (l.bySize[s] ?? 0), 0) || ''}</td>
              ))}
              <td className="text-center tabular-nums">{po.total}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-neutral-600">
        Style, color and sizes are exactly as they appear on the InkSoft work orders. Product names InkSoft cut short end in “…”. This list doesn’t check stock or place an order.
      </p>
    </div>
  );
}
