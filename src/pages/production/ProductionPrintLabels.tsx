import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { rpc } from '@/lib/production/db';
import { liveGarments, liveTasks, METHOD_LABEL, shortCode, useFloorOrder, type ProdGarment } from '@/hooks/useProductionFloor';

// Print pages for the two Rollo printers. No app menus; the toolbar hides when printing.
//   /print/labels?order=ID&which=unprinted|all   2×2 garment labels, one per page
//   /print/pickup/:orderId                       4×6 pickup label
// QR codes hold only a link with a random code. No names or order details are inside the QR.

const origin = () => window.location.origin;

export const LABEL_CSS = `
        @page { size: 2in 2in; margin: 0; }
        @media print { html, body { background: #fff !important; margin: 0 !important; } }
        .g-label { width: 2in; height: 2in; box-sizing: border-box; padding: 0.07in; overflow: hidden;
          break-after: page; page-break-after: always; background: #fff; display: flex; flex-direction: column; font-family: Arial, Helvetica, sans-serif; }
        .g-label:last-child { break-after: auto; page-break-after: auto; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `;
export const PICKUP_CSS = `
        @page { size: 4in 6in; margin: 0; }
        @media print { html, body { background: #fff !important; margin: 0 !important; } }
        .p-label { width: 4in; height: 6in; box-sizing: border-box; padding: 0.25in; overflow: hidden; background: #fff;
          display: flex; flex-direction: column; font-family: Arial, Helvetica, sans-serif; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `;

function useQr(texts: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = texts.join('|');
  useEffect(() => {
    let alive = true;
    Promise.all(texts.map(async (t) => [t, await QRCode.toDataURL(t, { margin: 0, width: 300, errorCorrectionLevel: 'M' })] as const))
      .then((pairs) => { if (alive) setUrls(Object.fromEntries(pairs)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

function Toolbar({ back, children, onPrint, disabled, note }: { back: string; children?: React.ReactNode; onPrint: () => void; disabled?: boolean; note: React.ReactNode }) {
  return (
    <div className="print:hidden sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
        <Button variant="ghost" size="sm" asChild><Link to={back}><ArrowLeft className="mr-1 h-4 w-4" />Back to order</Link></Button>
        <div className="flex-1" />
        {children}
        <Button size="sm" onClick={onPrint} disabled={disabled}><Printer className="mr-1 h-4 w-4" />Print</Button>
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-3 text-sm text-neutral-700">{note}</div>
    </div>
  );
}

export function GarmentLabel({ orderNumber, customerName, g, qr }: { orderNumber: string; customerName: string | null; g: ProdGarment; qr?: string }) {
  const code = shortCode(orderNumber, g.seq);
  const decos = liveTasks(g).map((t) => `${t.location} ${METHOD_LABEL[t.method] ?? t.method}`);
  return (
      <div className="g-label shadow print:shadow-none">
        <div style={{ display: 'flex', gap: '0.06in' }}>
          {qr && <img src={qr} alt="" style={{ width: '0.92in', height: '0.92in' }} />}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '9pt', fontWeight: 700, lineHeight: 1 }}>{orderNumber}</div>
            <div style={{ fontSize: '22pt', fontWeight: 900, lineHeight: 1 }}>-{String(g.seq).padStart(2, '0')}</div>
            <div style={{ fontSize: g.size.length > 3 ? '14pt' : '22pt', fontWeight: 900, lineHeight: 1, border: '2px solid #000', textAlign: 'center', padding: '1px 0' }}>{g.size}</div>
          </div>
        </div>
        <div style={{ fontSize: '7.5pt', lineHeight: 1.15, marginTop: '0.05in', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {[g.mfg_sku, g.color].filter(Boolean).join(' · ')}
        </div>
        <div style={{ fontSize: '7.5pt', fontWeight: 700, lineHeight: 1.15, flex: 1, overflow: 'hidden' }}>
          {decos.join(' · ') || 'No decoration'}
        </div>
        <div style={{ fontSize: '6.5pt', lineHeight: 1.1, display: 'flex', justifyContent: 'space-between', gap: 4 }}>
          <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{customerName ?? ''}</span>
          <span style={{ flexShrink: 0 }}>{code}</span>
        </div>
      </div>
  );
}

export function PrintGarmentLabels() {
  const [params] = useSearchParams();
  const orderId = params.get('order') ?? undefined;
  const which = params.get('which') === 'all' ? 'all' : 'unprinted';
  const { data: o, isLoading, error } = useFloorOrder(orderId);
  const qc = useQueryClient();
  const garments = useMemo(
    () => (o ? liveGarments(o.garments).filter((g) => which === 'all' || !g.label_printed_at) : []),
    [o, which],
  );
  const qr = useQr(garments.map((g) => `${origin()}/g/${g.token}`));

  useEffect(() => {
    const prev = document.title;
    document.title = o ? `Labels ${o.order_number}` : 'Garment labels';
    return () => { document.title = prev; };
  }, [o]);

  const print = async () => {
    try {
      await rpc('prod_mark_labels_printed', { p_garment_ids: garments.map((g) => g.id) });
      qc.invalidateQueries({ queryKey: ['prod'] });
    } catch (e) {
      toast.error(`Couldn't record the print: ${(e as Error).message}`);
    }
    window.print();
  };

  if (isLoading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error || !o) return <div className="p-6 text-red-700">{(error as Error)?.message ?? 'Order not found'}</div>;

  return (
    <div className="min-h-screen bg-neutral-200 text-black print:bg-white">
      <style>{LABEL_CSS}</style>
      <Toolbar
        back={`/production/orders/${o.id}`}
        onPrint={print}
        disabled={garments.length === 0 || Object.keys(qr).length < garments.length}
        note={<>In the print window pick the <b>2×2 Rollo</b>, paper size <b>2 × 2 in</b>, margins <b>None</b>, scale <b>100%</b>. One label per piece ({garments.length}). Stick it on a shoulder or sleeve away from the press and hoop.</>}
      >
        <span className="text-sm">{which === 'all' ? 'All labels' : 'Labels not printed yet'}</span>
      </Toolbar>
      {garments.length === 0 ? (
        <div className="p-8 text-center">Every label for this order has been printed. Use “Reprint all” on the order page if you need them again.</div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 p-6 print:block print:max-w-none print:gap-0 print:p-0">
          {garments.map((g) => {
            return <GarmentLabel key={g.id} orderNumber={o.order_number} customerName={o.customer_name} g={g} qr={qr[`${origin()}/g/${g.token}`]} />;
          })}
        </div>
      )}
    </div>
  );
}

export function PickupLabelCard({ customerName, orderNumber, dept, qr }: { customerName: string | null; orderNumber: string; dept: { label: string; value: string }[]; qr?: string }) {
  const name = customerName ?? '';
  const nameSize = name.length > 22 ? '26pt' : name.length > 14 ? '34pt' : '44pt';
  return (
    <div className="p-label shadow print:shadow-none">
      <div style={{ fontSize: nameSize, fontWeight: 900, lineHeight: 1.05, wordBreak: 'break-word' }}>{name || <span style={{ color: '#b00' }}>NO NAME ON ORDER</span>}</div>
      <div style={{ fontSize: '12pt', marginTop: '0.2in' }}>Order</div>
      <div style={{ fontSize: '34pt', fontWeight: 900, lineHeight: 1, fontFamily: 'ui-monospace, monospace' }}>{orderNumber}</div>
      {dept.length > 0 && (
        <div style={{ marginTop: '0.2in', fontSize: '16pt', lineHeight: 1.25 }}>
          {dept.map((f) => <div key={f.label}><span style={{ fontSize: '11pt' }}>{f.label}: </span><b>{f.value}</b></div>)}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '9pt' }}>Hells Canyon Designs</div>
        {qr && <img src={qr} alt="" style={{ width: '1.5in', height: '1.5in' }} />}
      </div>
    </div>
  );
}

export function PrintPickupLabel() {
  const { orderId } = useParams();
  const { data: o, isLoading, error } = useFloorOrder(orderId);
  const url = o?.pickup_token ? `${origin()}/p/${o.pickup_token}` : '';
  const qr = useQr(url ? [url] : []);
  useEffect(() => {
    const prev = document.title;
    document.title = o ? `Pickup ${o.order_number}` : 'Pickup label';
    return () => { document.title = prev; };
  }, [o]);

  if (isLoading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error || !o) return <div className="p-6 text-red-700">{(error as Error)?.message ?? 'Order not found'}</div>;
  const dept = (o.checkout_fields ?? []).filter((f) => f.value?.trim());
  return (
    <div className="min-h-screen bg-neutral-200 text-black print:bg-white">
      <style>{PICKUP_CSS}</style>
      <Toolbar
        back={`/production/orders/${o.id}`}
        onPrint={() => window.print()}
        disabled={!o.check_passed_at || !qr[url]}
        note={o.check_passed_at
          ? <>Pick the <b>4×6 Rollo</b>, paper size <b>4 × 6 in</b>, margins <b>None</b>, scale <b>100%</b>. Put it on the mailer, then scan it at Shipping & Receiving to mark the order packed.</>
          : <b className="text-red-700">Do the final check on the order page first.</b>}
      />
      {o.check_passed_at && (
        <div className="mx-auto w-fit p-6 print:p-0">
          <PickupLabelCard customerName={o.customer_name} orderNumber={o.order_number} dept={dept} qr={qr[url]} />
        </div>
      )}
    </div>
  );
}
