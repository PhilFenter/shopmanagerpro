import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Loader2, Printer, Save, Send } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useImportBatch } from '@/hooks/useProductionImports';
import {
  batchTag, buildPurchaseOrder, nextPoNumber, poLineRows, purchaseOrderCsv, vendorLabel, VENDORS, type PoSourceItem, type PurchaseOrder,
} from '@/lib/production/purchaseOrder';

interface SavedPo { id: string; po_number: string | null; supplier: string; status: string; submitted_at: string | null; notes: string | null }

/** The PO already saved for this import (if any) and every PO number used so far. */
function useBatchPo(batchId: string | undefined) {
  return useQuery({
    queryKey: ['purchase-orders', 'batch', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number, supplier, status, submitted_at, notes, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      const all = (data ?? []) as (SavedPo & { created_at: string })[];
      return { saved: all.find((p) => p.notes?.includes(batchTag(batchId!))) ?? null, all };
    },
  });
}

function useSavePo(batchId: string, fileName: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ existing, supplier, poNumber, po }: { existing: SavedPo | null; supplier: string; poNumber: string; po: PurchaseOrder }) => {
      const fields = {
        supplier,
        po_number: poNumber,
        total_items: po.total,
        notes: `Blank garments for InkSoft import ${fileName} ${batchTag(batchId)}`,
      };
      let id = existing?.id;
      if (id) {
        const { error } = await supabase.from('purchase_orders').update(fields).eq('id', id);
        if (error) throw new Error(error.message);
        const { error: e2 } = await supabase.from('po_line_items').delete().eq('po_id', id);
        if (e2) throw new Error(e2.message);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not signed in');
        const { data, error } = await supabase.from('purchase_orders').insert({ ...fields, created_by: user.id }).select('id').single();
        if (error) throw new Error(error.message);
        id = data.id as string;
      }
      const rows = poLineRows(po, id);
      if (rows.length) {
        const { error } = await supabase.from('po_line_items').insert(rows);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('PO saved. It’s also listed on the Purchase Orders page.');
    },
    onError: (e: Error) => toast.error(`PO not saved: ${e.message}`),
  });
}

function useMarkSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sent }: { id: string; sent: boolean }) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: sent ? 'submitted' : 'draft', submitted_at: sent ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success(v.sent ? 'Marked as sent to the vendor' : 'Marked as not sent');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

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
  const { data: poInfo } = useBatchPo(batchId);
  const saved = poInfo?.saved ?? null;
  const [vendorKey, setVendorKey] = useState<string>('sanmar');
  const [otherVendor, setOtherVendor] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [touched, setTouched] = useState(false);
  const save = useSavePo(batchId ?? '', data?.batch.file_name ?? '');
  const markSent = useMarkSent();

  // Fill the form from the saved PO, or suggest the next PO number.
  useEffect(() => {
    if (!poInfo || touched) return;
    if (poInfo.saved) {
      const known = VENDORS.some((v) => v.key === poInfo.saved!.supplier);
      setVendorKey(known ? poInfo.saved.supplier : 'other');
      setOtherVendor(known ? '' : poInfo.saved.supplier);
      setPoNumber(poInfo.saved.po_number ?? '');
    } else {
      setPoNumber(nextPoNumber(poInfo.all.map((p) => p.po_number)));
    }
  }, [poInfo, touched]);

  const supplier = vendorKey === 'other' ? otherVendor.trim() : vendorKey;
  const dupPo = !!poNumber.trim() && (poInfo?.all ?? []).some((p) => p.id !== saved?.id && p.po_number?.trim() === poNumber.trim());

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

  // The page title becomes the file name when you pick "Save as PDF" in the print window.
  useEffect(() => {
    const prev = document.title;
    document.title = poNumber.trim() ? `PO ${poNumber.trim()} ${vendorLabel(supplier)}`.trim() : 'Blank garment order';
    return () => { document.title = prev; };
  }, [poNumber, supplier]);

  const doSave = () => {
    if (!supplier) return toast.error('Pick a vendor first');
    if (!poNumber.trim()) return toast.error('Enter a PO number first');
    if (dupPo) return toast.error(`PO ${poNumber.trim()} is already used on another purchase order`);
    save.mutate({ existing: saved, supplier, poNumber: poNumber.trim(), po });
  };
  const changed = !!saved && (saved.supplier !== supplier || (saved.po_number ?? '') !== poNumber.trim());

  const download = () => {
    const blob = new Blob([purchaseOrderCsv(po)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const base = poNumber.trim() ? `PO-${poNumber.trim()}` : `blank-garments-${(data?.batch.file_name ?? 'import').replace(/\.pdf$/i, '')}`;
    a.download = `${base.replace(/[^\w.-]+/g, '_')}.csv`;
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
        <Button size="sm" onClick={() => window.print()} disabled={po.lines.length === 0}><Printer className="mr-1 h-4 w-4" />Print / Save PDF</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-neutral-50 p-3 print:hidden">
        <div>
          <div className="mb-1 text-xs font-semibold">Vendor</div>
          <Select value={vendorKey} onValueChange={(v) => { setTouched(true); setVendorKey(v); }}>
            <SelectTrigger className="h-9 w-44 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VENDORS.map((v) => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}
              <SelectItem value="other">Other…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {vendorKey === 'other' && (
          <div>
            <div className="mb-1 text-xs font-semibold">Vendor name</div>
            <Input className="h-9 w-48 bg-white" value={otherVendor} onChange={(e) => { setTouched(true); setOtherVendor(e.target.value); }} placeholder="Vendor name" />
          </div>
        )}
        <div>
          <div className="mb-1 text-xs font-semibold">PO #</div>
          <Input className="h-9 w-36 bg-white" value={poNumber} onChange={(e) => { setTouched(true); setPoNumber(e.target.value); }} placeholder="PO number" />
        </div>
        <Button size="sm" className="h-9" onClick={doSave} disabled={save.isPending || po.lines.length === 0}>
          {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          {saved ? 'Update saved PO' : 'Save PO'}
        </Button>
        {saved && (
          <Button size="sm" variant="outline" className="h-9" onClick={() => markSent.mutate({ id: saved.id, sent: saved.status !== 'submitted' })} disabled={markSent.isPending}>
            {saved.status === 'submitted' ? <><CheckCircle2 className="mr-1 h-4 w-4 text-green-700" />Sent {saved.submitted_at ? new Date(saved.submitted_at).toLocaleDateString() : ''} · undo</> : <><Send className="mr-1 h-4 w-4" />Mark as sent</>}
          </Button>
        )}
        <div className="basis-full text-xs text-neutral-600">
          {dupPo && <span className="font-semibold text-red-700">PO {poNumber.trim()} is already used on another purchase order. </span>}
          {saved
            ? <>Saved as PO {saved.po_number} for {vendorLabel(saved.supplier)}{changed ? ' (unsaved changes)' : ''}. </>
            : poInfo && !poInfo.all.some((p) => p.po_number) ? 'Type your first PO number; after that the next number is filled in for you. ' : ''}
          To send it: click Print / Save PDF, pick “Save as PDF” as the printer, then attach the PDF (or the CSV) to your email or upload it on the vendor’s site. Nothing is sent to the vendor from here.
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-x-8 gap-y-2">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Blank garment order</h1>
          <div className="text-sm">Hells Canyon Designs · {data.batch.file_name} · {new Date().toLocaleDateString()}</div>
        </div>
        <div className="text-base">Vendor: <span className="inline-block min-w-48 border-b border-black font-bold">{vendorLabel(supplier) || '\u00a0'}</span></div>
        <div className="text-base">PO #: <span className="inline-block min-w-32 border-b border-black font-bold">{poNumber.trim() || '\u00a0'}</span></div>
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
