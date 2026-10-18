import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AlertTriangle, ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSOPs, useSOPSteps, useChecklistTemplates } from '@/hooks/useKnowledge';
import {
  defaultChecklistMode, estimatePages, formatRevision, revisionDate, sopLink,
  type ChecklistPrintMode,
} from '@/lib/printCard';
import { cn } from '@/lib/utils';

// Printable SOP station cards and checklist sheets.
// Routes: /print/sop/:id and /print/checklist/:id (no app menus; the toolbar hides when printing).

const PRINT_CSS = `
@page { size: letter portrait; margin: 0.5in; }
@media print {
  html, body { background: #fff !important; }
  .print-sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: auto !important; min-height: 0 !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
`;

function PrintShell({
  title, controls, pages, children, sheetRef,
}: {
  title: string;
  controls?: React.ReactNode;
  pages: number;
  children: React.ReactNode;
  sheetRef: React.RefObject<HTMLDivElement>;
}) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);

  return (
    <div className="min-h-screen bg-neutral-200 text-black print:bg-white">
      <style>{PRINT_CSS}</style>
      <div className="print:hidden sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/knowledge"><ArrowLeft className="mr-1 h-4 w-4" /> Shop Knowledge</Link>
          </Button>
          <div className="flex-1" />
          {controls}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
        </div>
        {pages > 1 && (
          <div className="mx-auto flex max-w-[8.5in] items-center gap-2 px-4 pb-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            This runs about {pages} pages. A station card should fit on one: trim the steps, turn off photos, or let the QR code carry the detail.
          </div>
        )}
      </div>
      <div className="py-6 print:py-0">
        {/* On screen this looks like a letter page; when printing, @page margins take over. */}
        <div className="print-sheet mx-auto w-[8.5in] min-h-[11in] bg-white p-[0.5in] shadow-lg">
          <div ref={sheetRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function usePageCount(ref: React.RefObject<HTMLDivElement>, deps: unknown[]) {
  const [pages, setPages] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setPages(estimatePages(el.scrollHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return pages;
}

function QrCode({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 0, width: 240, errorCorrectionLevel: 'M' })
      .then(d => { if (!cancelled) setSrc(d); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [url]);
  if (!src) return null;
  return (
    <div className="flex items-center gap-2">
      <img src={src} alt="QR code" className="h-[0.9in] w-[0.9in]" />
      <span className="max-w-[1.1in] text-[10px] leading-tight text-neutral-600">{label}</span>
    </div>
  );
}

function CardFooter({ revision, version, qrUrl, qrLabel }: {
  revision: Date; version?: number; qrUrl?: string; qrLabel?: string;
}) {
  return (
    <div className="print-avoid-break mt-5 flex items-end justify-between gap-4 border-t-2 border-black pt-3">
      <div className="text-[11px] leading-snug text-neutral-700">
        <div className="text-sm font-bold text-black">
          Rev. {formatRevision(revision)}{version ? ` · v${version}` : ''}
        </div>
        <div>Hells Canyon Designs · ShopManagerPro</div>
        <div>If this date doesn't match ShopManagerPro, pull the card and reprint.</div>
      </div>
      {qrUrl && <QrCode url={qrUrl} label={qrLabel ?? 'Scan for the full SOP'} />}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
    </div>
  );
}

function NotFoundCard({ what }: { what: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white text-black">
      <p>That {what} wasn't found. It may have been deleted.</p>
      <Button variant="outline" asChild><Link to="/knowledge">Back to Shop Knowledge</Link></Button>
    </div>
  );
}

// ─── SOP station card ───
export function PrintSop() {
  const { id = '' } = useParams();
  const { sops, isLoading } = useSOPs();
  const { steps, isLoading: stepsLoading } = useSOPSteps(id || null);
  const [showPhotos, setShowPhotos] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sop = sops.find(s => s.id === id);
  const hasPhotos = steps.some(s => s.image_url);
  const pages = usePageCount(sheetRef, [sop?.id, steps.length, showPhotos]);

  const warnings = useMemo(
    () => steps.map((s, i) => ({ n: i + 1, text: s.warning?.trim() })).filter(w => w.text),
    [steps],
  );

  if (isLoading || stepsLoading) return <Loading />;
  if (!sop) return <NotFoundCard what="SOP" />;

  const revision = revisionDate(sop.updated_at, steps);
  const dept = sop.department || sop.category;

  return (
    <PrintShell
      title={`${sop.title} – station card`}
      pages={pages}
      sheetRef={sheetRef}
      controls={hasPhotos && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showPhotos} onChange={e => setShowPhotos(e.target.checked)} />
          Photos
        </label>
      )}
    >
      <div className="border-b-4 border-black pb-2">
        {dept && <div className="text-xs font-bold uppercase tracking-widest text-neutral-600">{dept}</div>}
        <h1 className="text-[28px] font-extrabold leading-tight">{sop.title}</h1>
        {sop.description && <p className="mt-1 text-sm text-neutral-700">{sop.description}</p>}
      </div>

      {warnings.length > 0 && (
        <div className="print-avoid-break mt-4 rounded-md border-[3px] border-red-700 p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-red-700">
            <AlertTriangle className="h-4 w-4" /> Safety
          </div>
          <ul className="space-y-1 text-[13px]">
            {warnings.map(w => (
              <li key={w.n}><span className="font-bold">Step {w.n}:</span> {w.text}</li>
            ))}
          </ul>
        </div>
      )}

      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={step.id} className="print-avoid-break flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-base font-bold text-white">
              {i + 1}
            </span>
            <div className={cn('flex-1', showPhotos && step.image_url && 'flex gap-3')}>
              <div className="flex-1">
                <div className="text-[16px] font-bold leading-snug">{step.title}</div>
                {step.content && (
                  <p className="whitespace-pre-wrap text-[13px] leading-snug text-neutral-800">{step.content}</p>
                )}
                {step.tip && <p className="mt-0.5 text-[12px] italic text-neutral-600">Tip: {step.tip}</p>}
              </div>
              {showPhotos && step.image_url && (
                <img
                  src={step.image_url}
                  alt={step.title}
                  className="h-[1.4in] w-auto max-w-[2.2in] shrink-0 rounded border border-neutral-300 object-cover"
                />
              )}
            </div>
          </li>
        ))}
      </ol>
      {steps.length === 0 && <p className="mt-6 text-neutral-500">This SOP has no steps yet.</p>}

      <CardFooter
        revision={revision}
        version={sop.version}
        qrUrl={sopLink(window.location.origin, sop.id)}
      />
    </PrintShell>
  );
}

// ─── Checklist sheet ───
function Blank({ label, width = 'flex-1' }: { label: string; width?: string }) {
  return (
    <div className={cn('flex items-end gap-1.5', width)}>
      <span className="whitespace-nowrap text-[12px] font-bold">{label}</span>
      <span className="mb-[3px] flex-1 border-b border-black" />
    </div>
  );
}

function Box() {
  return <span className="mt-0.5 inline-block h-[18px] w-[18px] shrink-0 border-2 border-black" />;
}

export function PrintChecklist() {
  const { id = '' } = useParams();
  const { templates, isLoading } = useChecklistTemplates();
  const { sops } = useSOPs();
  const template = templates.find(t => t.id === id);
  const [mode, setMode] = useState<ChecklistPrintMode | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const effectiveMode = mode ?? (template ? defaultChecklistMode(template.title, template.category) : 'laminated');
  const pages = usePageCount(sheetRef, [template?.id, effectiveMode]);

  if (isLoading) return <Loading />;
  if (!template) return <NotFoundCard what="checklist" />;

  const linkedSop = template.sop_id ? sops.find(s => s.id === template.sop_id) : undefined;
  const perJob = effectiveMode === 'per-job';
  const dept = template.department || template.category;

  return (
    <PrintShell
      title={`${template.title} – ${perJob ? 'job sheet' : 'checklist card'}`}
      pages={pages}
      sheetRef={sheetRef}
      controls={
        <div className="flex overflow-hidden rounded-md border text-sm">
          {(['laminated', 'per-job'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn('px-3 py-1.5', effectiveMode === m ? 'bg-black text-white' : 'bg-white hover:bg-neutral-100')}
            >
              {m === 'laminated' ? 'Laminated (reuse)' : 'Per job (paper)'}
            </button>
          ))}
        </div>
      }
    >
      <div className="border-b-4 border-black pb-2">
        {dept && <div className="text-xs font-bold uppercase tracking-widest text-neutral-600">{dept}</div>}
        <h1 className="text-[26px] font-extrabold leading-tight">{template.title}</h1>
        {template.description && <p className="mt-1 text-sm text-neutral-700">{template.description}</p>}
      </div>

      {perJob ? (
        <div className="mt-4 space-y-3">
          <div className="flex gap-4"><Blank label="Job #" width="w-[2.2in]" /><Blank label="Customer" /></div>
          <div className="flex gap-4"><Blank label="Qty ordered" /><Blank label="Qty counted" /><Blank label="Date" /></div>
        </div>
      ) : (
        <div className="mt-4 flex gap-4"><Blank label="Date" /><Blank label="Initials" /></div>
      )}

      <div className="mt-4">
        {perJob && (
          <div className="mb-1 flex justify-end pr-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
            Initials
          </div>
        )}
        <ul className="divide-y divide-neutral-300 border-y border-neutral-300">
          {template.items.map((item, i) => (
            <li key={i} className="print-avoid-break flex items-start gap-3 py-2">
              <Box />
              <span className={cn('flex-1 text-[14px] leading-snug', item.required && 'font-bold')}>
                {item.text}
                {item.required && <span className="ml-2 text-[10px] font-bold uppercase text-red-700">Required</span>}
              </span>
              {perJob && <span className="mt-3 w-[0.7in] shrink-0 border-b border-black" />}
            </li>
          ))}
        </ul>
        {template.items.length === 0 && <p className="mt-4 text-neutral-500">This checklist has no items yet.</p>}
      </div>

      {perJob && (
        <div className="print-avoid-break mt-5 space-y-3">
          <Blank label="Notes / problems" />
          <div className="flex gap-4"><Blank label="Completed by" /><Blank label="Date" width="w-[2in]" /></div>
        </div>
      )}

      <CardFooter
        revision={new Date(template.updated_at)}
        qrUrl={linkedSop ? sopLink(window.location.origin, linkedSop.id) : undefined}
        qrLabel={linkedSop ? `Scan for the SOP: ${linkedSop.title}` : undefined}
      />
    </PrintShell>
  );
}
