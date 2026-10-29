import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ClipboardList, ExternalLink, FileSpreadsheet, Flame, Info, Loader2, Printer, RotateCcw, ShieldCheck,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useImportBatch, usePreviewUrls, useProdAction, type BatchOrder } from '@/hooks/useProductionImports';
import { blocking, orderCounts, reviewIssues, type DbDecoration, type DbItem, type DbOrder } from '@/lib/production/review';
import { METHOD_LABELS, type ProductionMethod } from '@/lib/production/methods';
import { signedUrl } from '@/lib/production/db';
import { attachCsv, csvToast, readCsvFile } from '@/lib/production/importFile';
import { fmtDate, PreviewThumb, ReasonDialog, useIsProdManager } from '@/components/production/ProdShared';
import { cn } from '@/lib/utils';

const OUTCOME: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-900' },
  unchanged: { label: 'Already imported, no changes', className: 'bg-neutral-100 text-neutral-800' },
  updated: { label: 'Updated from this file', className: 'bg-amber-100 text-amber-900' },
  pending: { label: 'Changed after approval', className: 'bg-red-100 text-red-900' },
  applied: { label: 'Newer copy applied', className: 'bg-amber-100 text-amber-900' },
  dismissed: { label: 'Copy dismissed', className: 'bg-neutral-100 text-neutral-800' },
};

const STATUS: Record<DbOrder['status'], { label: string; className: string }> = {
  review: { label: 'Needs review', className: 'bg-amber-100 text-amber-900' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-900' },
  on_hold: { label: 'On hold', className: 'bg-neutral-200 text-neutral-900' },
  cancelled: { label: 'Cancelled', className: 'bg-neutral-200 text-neutral-900' },
};

const TRUNC_NAME: Record<string, string> = {
  mfgSku: 'the SKU', inksoftSku: 'the InkSoft SKU', color: 'the color', productName: 'the product name', designName: 'the design name',
};

export default function ProductionImportDetail() {
  const { batchId } = useParams();
  const { data, isLoading, error } = useImportBatch(batchId);
  const isManager = useIsProdManager();
  const approve = useProdAction<{ p_order_id: string; p_expected_revision: number }, { ok: boolean; already?: boolean; blockers?: string[] }>(
    'prod_approve_order',
  );
  const [bulkBusy, setBulkBusy] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const hashes = useMemo(
    () =>
      (data?.orders ?? []).flatMap((o) =>
        o.items.flatMap((i) => [i.mockup_hash, ...i.prod_item_decorations.flatMap((d) => [d.artwork_hash, d.mockup_hash])]),
      ).filter(Boolean) as string[],
    [data],
  );
  const { data: urls } = usePreviewUrls(hashes);

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="p-6 text-destructive">{(error as Error)?.message ?? 'Import not found'}</div>;

  const { batch, orders } = data;
  const evaluated = orders.map((o) => ({ ...o, issues: reviewIssues(o.order, o.items), counts: orderCounts(o.items) }));
  const totals = evaluated.reduce(
    (a, o) => ({ garments: a.garments + o.counts.garments, tasks: a.tasks + o.counts.tasks, labels: a.labels + o.counts.labels }),
    { garments: 0, tasks: 0, labels: 0 },
  );
  const clean = evaluated.filter((o) => o.order.status === 'review' && blocking(o.issues).length === 0);
  const approvedCount = evaluated.filter((o) => o.order.status === 'approved').length;
  const blockedCount = evaluated.filter((o) => o.order.status === 'review' && blocking(o.issues).length > 0).length;

  const approveAllClean = async () => {
    setBulkBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const o of clean) {
      try {
        const r = await approve.mutateAsync({ p_order_id: o.order.id, p_expected_revision: o.order.current_revision });
        if (r.ok) ok++;
        else failed.push(`${o.order.order_number}: ${(r.blockers ?? []).join('; ')}`);
      } catch (e) {
        failed.push(`${o.order.order_number}: ${(e as Error).message}`);
      }
    }
    setBulkBusy(false);
    if (ok) toast.success(`Approved ${ok} order${ok === 1 ? '' : 's'}`);
    if (failed.length) toast.error(`Not approved — ${failed.join(' | ')}`);
  };

  const openPdf = async () => {
    const u = await signedUrl(batch.storage_path, 600);
    if (u) window.open(u, '_blank', 'noopener');
    else toast.error('Couldn’t open the original PDF');
  };

  const onCsv = async (f: File | undefined) => {
    if (!f) return;
    const t = toast.loading(`Reading ${f.name}…`);
    try {
      const csv = await readCsvFile(f);
      const r = await attachCsv(batch.id, f, csv);
      qc.invalidateQueries({ queryKey: ['prod'] });
      toast.dismiss(t);
      csvToast(r);
    } catch (e) {
      toast.error(`Orders CSV not added: ${(e as Error).message}`, { id: t, duration: 15000 });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/production/imports"><ArrowLeft className="mr-1 h-4 w-4" /> Imports</Link>
      </Button>

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{batch.file_name}</h1>
          <p className="text-sm text-muted-foreground">
            Uploaded {new Date(batch.created_at).toLocaleString()}
            {batch.printed_at && ` · InkSoft printed ${batch.printed_at}`}
            {batch.csv_file_name ? ` · Orders CSV: ${batch.csv_file_name}` : ' · No Orders CSV'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openPdf}><ExternalLink className="mr-1 h-4 w-4" /> Original PDF</Button>
        {isManager && (
          <>
            <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> {batch.csv_file_name ? 'Replace Orders CSV' : 'Add Orders CSV'}
            </Button>
            <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { onCsv(e.target.files?.[0]); e.target.value = ''; }} />
          </>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
          <Stat n={orders.length} label="orders" />
          <Stat n={totals.garments} label="garments" />
          <Stat n={totals.tasks} label="decorations" />
          <Stat n={totals.labels} label="labels" />
          <div className="flex-1" />
          <div className="text-sm text-muted-foreground">
            {approvedCount} approved · {clean.length} ready · {blockedCount} need fixing
          </div>
          {isManager && clean.length > 0 && (
            <Button onClick={approveAllClean} disabled={bulkBusy}>
              {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Approve {clean.length} ready order{clean.length === 1 ? '' : 's'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <span className="mr-2 text-sm font-semibold">Whole batch:</span>
          <Button size="sm" variant="outline" asChild disabled={approvedCount === 0}>
            <Link to={`/print/labels?batch=${batch.id}&which=unprinted`} target="_blank"><Printer className="mr-1 h-4 w-4" /> Print all labels</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/print/po/${batch.id}`} target="_blank"><ClipboardList className="mr-1 h-4 w-4" /> Blank garment order</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/production/transfers?batch=${batch.id}`}><Flame className="mr-1 h-4 w-4" /> DTF prints for this batch</Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            {approvedCount === 0 ? 'Approve orders first. Labels and DTF prints only include approved orders.' : 'Labels and DTF prints include approved orders only. Labels already printed are skipped.'}
          </span>
        </CardContent>
      </Card>

      {batch.status === 'failed' && (
        <IssueBox level="block" items={[`Couldn’t read this file: ${batch.error ?? 'unknown error'}`]} />
      )}
      {batch.parse_flags?.length > 0 && <IssueBox level="block" items={batch.parse_flags.map((f) => f.message)} />}

      <div className="space-y-3">
        {evaluated.map((o) => (
          <OrderCard key={o.order.id} bo={o} issues={o.issues} counts={o.counts} urls={urls ?? {}} isManager={isManager} />
        ))}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <span className="text-2xl font-bold">{n}</span> <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function IssueBox({ level, items }: { level: 'block' | 'check'; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div
      className={cn(
        'rounded-md border p-3 text-sm',
        level === 'block' ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900',
      )}
    >
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" /> {level === 'block' ? 'Must fix before approval' : 'Please check'}
      </div>
      <ul className="ml-6 list-disc space-y-0.5">{items.map((m, i) => <li key={i}>{m}</li>)}</ul>
    </div>
  );
}

function OrderCard({
  bo, issues, counts, urls, isManager,
}: {
  bo: BatchOrder;
  issues: ReturnType<typeof reviewIssues>;
  counts: ReturnType<typeof orderCounts>;
  urls: Record<string, string>;
  isManager: boolean;
}) {
  const { order: o, items, source } = bo;
  const blocks = issues.filter((i) => i.level === 'block');
  const checks = issues.filter((i) => i.level === 'check');
  const [open, setOpen] = useState(o.status === 'review' && (blocks.length > 0 || source.outcome !== 'unchanged'));
  const [dialog, setDialog] = useState<null | 'reopen' | 'ack' | 'dismiss'>(null);
  const editable = isManager && o.status === 'review';

  const approve = useProdAction<{ p_order_id: string; p_expected_revision: number }, { ok: boolean; already?: boolean; blockers?: string[]; garments?: { added: number; voided: number } }>(
    'prod_approve_order',
    (r) => {
      if (!r.ok) return null;
      const g = r.garments;
      const extra = g && (g.added || g.voided)
        ? ` · ${g.added ? `${g.added} new label${g.added === 1 ? '' : 's'} to print` : ''}${g.added && g.voided ? ', ' : ''}${g.voided ? `${g.voided} piece${g.voided === 1 ? '' : 's'} removed` : ''}`
        : '';
      return `Order ${o.order_number} approved${extra}`;
    },
  );
  const reopen = useProdAction('prod_reopen_order', `Order ${o.order_number} is back in review`);
  const ack = useProdAction('prod_acknowledge_flags', 'Noted');
  const applyRev = useProdAction('prod_apply_revision', 'Newer copy applied. Review and approve again.');
  const dismissRev = useProdAction('prod_dismiss_revision', 'Newer copy dismissed');
  const updOrder = useProdAction('prod_update_order', 'Saved');

  const doApprove = async () => {
    const r = await approve.mutateAsync({ p_order_id: o.id, p_expected_revision: o.current_revision });
    if (!r.ok) toast.error(`Not approved: ${(r.blockers ?? []).join('; ')}`);
  };

  const fileBlockUnacked = o.flags.some((f) => f.level === 'block') && !o.flags_ack_at;

  return (
    <Card className={cn(blocks.length > 0 && o.status === 'review' && 'border-red-300')}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left">
            <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
            <span className="text-lg font-bold tabular-nums">{o.order_number}</span>
            <span className="min-w-0 truncate">{o.customer_name ?? 'Customer not found'}</span>
            <span className="text-sm text-muted-foreground">{o.store_name ?? '—'}</span>
            <span className="text-sm text-muted-foreground">Ship {fmtDate(o.due_date)}</span>
            <span className="text-sm text-muted-foreground">
              {counts.garments} garments · {counts.tasks} decorations · pages {source.pages.join(', ')}
            </span>
            <div className="flex-1" />
            <Badge className={cn('font-normal', OUTCOME[source.outcome]?.className)} variant="outline">{OUTCOME[source.outcome]?.label ?? source.outcome}</Badge>
            <Badge className={cn('font-normal', STATUS[o.status].className)} variant="outline">{STATUS[o.status].label}</Badge>
            {o.status === 'review' && blocks.length > 0 && <Badge variant="destructive">{blocks.length} to fix</Badge>}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t p-4">
            {o.pending_revision && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                <AlertTriangle className="h-4 w-4" />
                <span className="flex-1">
                  A different copy of this order was uploaded after it was approved. Nothing has changed yet. Open the original PDFs to compare.
                </span>
                {isManager && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setDialog('dismiss')}>Keep current</Button>
                    <Button size="sm" onClick={() => applyRev.mutate({ p_order_id: o.id })} disabled={applyRev.isPending}>Use newer copy</Button>
                  </>
                )}
              </div>
            )}
            <IssueBox level="block" items={blocks.map((i) => i.message)} />
            <IssueBox level="check" items={checks.map((i) => i.message)} />

            <div className="grid gap-3 text-sm md:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Pickup or ship</div>
                {isManager ? (
                  <Select value={o.fulfillment} onValueChange={(v) => updOrder.mutate({ p_order_id: o.id, p_patch: { fulfillment: v } })}>
                    <SelectTrigger className="mt-1 h-8 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">Pickup</SelectItem>
                      <SelectItem value="ship">Ship</SelectItem>
                      <SelectItem value="unknown">Not known</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div>{o.fulfillment === 'pickup' ? 'Pickup' : o.fulfillment === 'ship' ? 'Ship' : 'Not known'}</div>
                )}
                {o.fulfillment === 'pickup' && <div className="mt-1">at {o.pickup_location ?? 'location not given'}</div>}
                {o.fulfillment === 'ship' && o.shipping_method && <div className="mt-1">{o.shipping_method}</div>}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Department</div>
                {o.checkout_fields.length ? (
                  o.checkout_fields.map((f) => <div key={f.label}>{f.label}: <span className="font-medium">{f.value}</span></div>)
                ) : (
                  <div className="text-muted-foreground">None given</div>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Order</div>
                <div>Ordered {fmtDate(o.order_date)} · Ship {fmtDate(o.due_date)}</div>
                {o.customer_email && <div className="truncate text-muted-foreground">{o.customer_email}</div>}
                <div className="text-muted-foreground">Revision {o.current_revision}{o.approved_at && ` · approved ${new Date(o.approved_at).toLocaleString()}`}</div>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((it) => (
                <ItemRow key={it.id} item={it} urls={urls} editable={editable} />
              ))}
            </div>

            {isManager && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                {o.status === 'review' && fileBlockUnacked && (
                  <Button variant="outline" size="sm" onClick={() => setDialog('ack')}>
                    <ShieldCheck className="mr-1 h-4 w-4" /> I checked the file problems
                  </Button>
                )}
                {o.status === 'approved' && (
                  <Button variant="outline" size="sm" onClick={() => setDialog('reopen')}>
                    <RotateCcw className="mr-1 h-4 w-4" /> Reopen for review
                  </Button>
                )}
                <div className="flex-1" />
                {o.status === 'approved' && (
                  <Button size="sm" asChild>
                    <Link to={`/production/orders/${o.id}`}>Garment labels &amp; production</Link>
                  </Button>
                )}
                {o.status === 'review' && (
                  <Button onClick={doApprove} disabled={approve.isPending || blocks.length > 0}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve order {o.order_number}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ReasonDialog
        open={dialog === 'reopen'} onOpenChange={(v) => !v && setDialog(null)}
        title={`Reopen order ${o.order_number}?`} description="It goes back to review and has to be approved again."
        confirmLabel="Reopen" busy={reopen.isPending}
        onConfirm={(reason) => reopen.mutate({ p_order_id: o.id, p_reason: reason }, { onSuccess: () => setDialog(null) })}
      />
      <ReasonDialog
        open={dialog === 'ack'} onOpenChange={(v) => !v && setDialog(null)}
        title="Confirm you checked the file problems"
        description="For example: “Checked the PDF in InkSoft — all pages are here.” This note is saved with your name."
        confirmLabel="Save note" busy={ack.isPending}
        onConfirm={(reason) => ack.mutate({ p_order_id: o.id, p_reason: reason }, { onSuccess: () => setDialog(null) })}
      />
      <ReasonDialog
        open={dialog === 'dismiss'} onOpenChange={(v) => !v && setDialog(null)}
        title="Keep the current version?" description="The newer copy stays on file but isn’t used."
        confirmLabel="Keep current" busy={dismissRev.isPending}
        onConfirm={(reason) => dismissRev.mutate({ p_order_id: o.id, p_reason: reason }, { onSuccess: () => setDialog(null) })}
      />
    </Card>
  );
}

function ItemRow({ item: it, urls, editable }: { item: DbItem; urls: Record<string, string>; editable: boolean }) {
  const updSize = useProdAction('prod_update_size', 'Quantity saved');
  const updItem = useProdAction('prod_update_item', 'Saved');
  const total = it.prod_item_sizes.reduce((a, s) => a + (s.quantity ?? 0), 0);
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap gap-3">
        <PreviewThumb url={it.mockup_hash ? urls[it.mockup_hash] : null} size={72} dark={false} label="Mockup" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-xs text-muted-foreground">Item {it.item_index}{it.item_of ? ` of ${it.item_of}` : ''}</span>
            <span className="font-semibold">{it.mfg_sku ?? 'SKU missing'}</span>
            {editable ? (
              <EditableText value={it.color} placeholder="Color" onSave={(v) => updItem.mutate({ p_item_id: it.id, p_patch: { color: v } })} />
            ) : (
              <span>{it.color ?? 'Color missing'}</span>
            )}
            <span className="truncate text-sm text-muted-foreground">{it.product_name}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Design: {it.design_name ?? '—'}{it.design_id && ` (#${it.design_id})`}
            {it.inksoft_sku && ` · InkSoft SKU ${it.inksoft_sku}`}
            {it.truncated.length > 0 && (
              <span className="ml-1 text-xs" title="InkSoft shortens long text with … when it makes the PDF. The full text isn't in the file. Production uses the SKU, color, sizes and design ID, which are complete.">
                (InkSoft shortened {it.truncated.map((k) => TRUNC_NAME[k] ?? k).join(', ')} in the PDF)
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {it.prod_item_sizes.map((s) => (
              <div key={s.id} className="flex items-center gap-1 rounded border px-2 py-1 text-sm">
                <span className="font-semibold">{s.size}</span>
                {editable ? (
                  <QtyInput value={s.quantity} onSave={(q) => updSize.mutate({ p_size_id: s.id, p_quantity: q })} />
                ) : (
                  <span>× {s.quantity ?? '?'}</span>
                )}
                {s.edited_at && s.quantity !== s.source_quantity && (
                  <span className="text-xs text-amber-700" title="Changed during review">(PDF: {s.source_quantity ?? '—'})</span>
                )}
              </div>
            ))}
            <span className="text-sm text-muted-foreground">= {total} garment{total === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {it.prod_item_decorations.map((d) => (
          <DecorationRow key={d.id} d={d} urls={urls} editable={editable} />
        ))}
      </div>
    </div>
  );
}

function DecorationRow({ d, urls, editable }: { d: DbDecoration; urls: Record<string, string>; editable: boolean }) {
  const [pending, setPending] = useState<ProductionMethod | null>(null);
  const upd = useProdAction('prod_update_decoration', 'Production method changed');
  const isOverride = d.method_production && d.method_inksoft && METHOD_LABELS[d.method_production as ProductionMethod] &&
    !(d.method_inksoft.toLowerCase() === 'embroidery' && d.method_production === 'embroidery') &&
    !(d.method_inksoft.toLowerCase() === 'digitalprint' && d.method_production === 'dtf') &&
    !(d.method_inksoft.toLowerCase() === 'screenprint' && d.method_production === 'screen_print');
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-md bg-muted/40 p-2">
      <PreviewThumb url={d.artwork_hash ? urls[d.artwork_hash] : null} size={56} label="Artwork" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold">{d.location ?? 'Location missing'}</span>
          <span className="text-muted-foreground">InkSoft: {d.method_inksoft ?? '—'}</span>
          <span>→</span>
          {editable ? (
            <Select value={d.method_production ?? ''} onValueChange={(v) => setPending(v as ProductionMethod)}>
              <SelectTrigger className="h-7 w-36"><SelectValue placeholder="Choose method" /></SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <span className="font-semibold">{d.method_production ? METHOD_LABELS[d.method_production as ProductionMethod] : 'Not chosen'}</span>
          )}
          {isOverride && (
            <Badge variant="outline" className="font-normal">
              <Info className="mr-1 h-3 w-3" />
              {d.method_source === 'staff' ? `Changed by staff: ${d.override_reason ?? ''}` : 'Store rule'}
            </Badge>
          )}
          {d.method_source === 'staff' && !isOverride && d.override_reason && (
            <Badge variant="outline" className="font-normal">Changed by staff: {d.override_reason}</Badge>
          )}
        </div>
        <div className="text-muted-foreground">
          {d.colorway ?? '—'} · {d.color_count ? `${d.color_count} color${d.color_count === '1' ? '' : 's'}` : 'colors not given'}
          {' · '}
          {d.width_in != null && d.height_in != null ? `${d.width_in}″ W × ${d.height_in}″ H` : 'Size: see production file'}
        </div>
        {d.thread_colors.length > 0 && <div className="text-muted-foreground">{d.thread_colors.join(' · ')}</div>}
      </div>
      <ReasonDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={`Produce as ${pending ? METHOD_LABELS[pending] : ''}?`}
        description={`InkSoft says “${d.method_inksoft ?? '—'}”. That stays on record; this sets how HCD produces it.`}
        confirmLabel="Change method"
        busy={upd.isPending}
        onConfirm={(reason) =>
          upd.mutate(
            { p_decoration_id: d.id, p_patch: { method_production: pending, override_reason: reason } },
            { onSuccess: () => setPending(null) },
          )
        }
      />
    </div>
  );
}

function QtyInput({ value, onSave }: { value: number | null; onSave: (q: number) => void }) {
  const [v, setV] = useState(value == null ? '' : String(value));
  const commit = () => {
    const n = Number(v);
    if (v === '' || !Number.isInteger(n) || n < 0) {
      setV(value == null ? '' : String(value));
      return;
    }
    if (n !== value) onSave(n);
  };
  return (
    <Input
      value={v}
      inputMode="numeric"
      onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-7 w-14 px-2 text-center"
      aria-label="Quantity"
    />
  );
}

function EditableText({ value, placeholder, onSave }: { value: string | null; placeholder: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value ?? '');
  return (
    <Input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== (value ?? '') && v.trim() && onSave(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-7 w-40 px-2"
      aria-label={placeholder}
    />
  );
}
