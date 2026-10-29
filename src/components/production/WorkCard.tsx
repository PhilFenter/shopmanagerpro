import { CheckCircle2, Circle } from 'lucide-react';
import { PreviewThumb } from '@/components/production/ProdShared';
import { usePreviewUrls } from '@/hooks/useProductionImports';
import { METHOD_LABEL, useGarmentWork, type WorkDecoration } from '@/hooks/useProductionFloor';
import { cn } from '@/lib/utils';

// What goes on the scanned piece, like the work order: mockup, artwork preview, location, size, colors.
// Previews come from the InkSoft PDF and are for checking only — never production art.

const METHOD_NAME: Record<string, string> = {
  dtf: 'DTF', embroidery: 'Embroidery', screen_print: 'Screen print', laser: 'Laser', leather_patch: 'Leather patch', other: 'Other',
};

function size(d: WorkDecoration) {
  if (d.width_in == null && d.height_in == null) return null;
  return `${d.width_in ?? '?'}″ W × ${d.height_in ?? '?'}″ H`;
}

export function WorkCard({ garmentId, station, compact = false }: { garmentId: string; station: 'dtf' | 'embroidery' | 'shipping'; compact?: boolean }) {
  const { data, isLoading, error } = useGarmentWork(garmentId);
  const decos = data?.item?.prod_item_decorations ?? [];
  const { data: urls = {} } = usePreviewUrls(
    [data?.item?.mockup_hash, ...decos.flatMap((d) => [d.artwork_hash, d.mockup_hash])].filter((h): h is string => !!h),
  );
  if (isLoading) return <div className="rounded-xl border p-4 text-muted-foreground">Loading the artwork…</div>;
  if (error) return <div className="rounded-xl border p-4 text-destructive">Couldn’t load the artwork: {(error as Error).message}</div>;
  if (!data?.item) return null;

  const status = (d: WorkDecoration) => data.tasks.find((t) => t.decoration_id === d.id)?.status;
  const mine = station === 'shipping' ? decos : decos.filter((d) => d.method_production === station);
  const others = station === 'shipping' ? [] : decos.filter((d) => d.method_production !== station);
  const it = data.item;
  const mockup = it.mockup_hash ? urls[it.mockup_hash] : null;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <PreviewThumb url={mockup} size={110} dark={false} label="Mockup" />
        {decos.map((d) => (
          <div key={d.id} className="flex flex-col items-center gap-1 text-xs">
            <PreviewThumb url={d.artwork_hash ? urls[d.artwork_hash] : null} size={80} label={d.location ?? 'Artwork'} />
            <span className="font-medium">{d.location}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-xl font-bold">{it.mfg_sku}</span>
        <span className="text-lg">{it.color}</span>
        <span className="text-sm text-muted-foreground">{it.product_name}</span>
        <span className="text-sm text-muted-foreground">Design {it.design_id ? `#${it.design_id}` : '—'}{it.design_name ? ` · ${it.design_name}` : ''}</span>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col items-center gap-1">
          <PreviewThumb url={mockup} size={240} dark={false} label="Mockup" />
          <span className="text-xs text-muted-foreground">Mockup</span>
        </div>
        <div className="min-w-[280px] flex-1 space-y-3">
          {mine.length === 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
              Nothing on this piece for this station.
            </div>
          )}
          {mine.map((d) => (
            <DecoRow key={d.id} d={d} url={d.artwork_hash ? urls[d.artwork_hash] : null}
              mockupUrl={d.mockup_hash && d.mockup_hash !== it.mockup_hash ? urls[d.mockup_hash] : null} status={status(d)} big />
          ))}
        </div>
      </div>
      {others.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <div className="text-sm font-semibold text-muted-foreground">Also on this piece (other stations)</div>
          {others.map((d) => <DecoRow key={d.id} d={d} url={d.artwork_hash ? urls[d.artwork_hash] : null} status={status(d)} />)}
        </div>
      )}
      <div className="text-xs text-muted-foreground">Pictures are previews from the InkSoft work order, for checking only, not production art.</div>
    </div>
  );
}

function DecoRow({ d, url, mockupUrl, status, big = false }: { d: WorkDecoration; url: string | null; mockupUrl?: string | null; status?: string; big?: boolean }) {
  const done = status === 'done';
  return (
    <div className={cn('flex gap-3 rounded-lg border p-3', done && 'border-green-500 bg-green-50')}>
      <PreviewThumb url={url} size={big ? 200 : 72} label={d.location ?? 'Artwork'} />
      {big && mockupUrl && <PreviewThumb url={mockupUrl} size={140} dark={false} label={`${d.location ?? ''} mockup`} />}
      <div className={cn('space-y-1', big ? 'text-base' : 'text-sm')}>
        <div className={cn('flex items-center gap-2 font-bold', big ? 'text-2xl' : 'text-base')}>
          {done ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
          {d.location ?? 'Location not given'}
        </div>
        <div className="font-semibold">
          {METHOD_NAME[d.method_production ?? ''] ?? METHOD_LABEL[d.method_production ?? ''] ?? 'Method not set'}
          {d.method_inksoft && d.method_inksoft.toLowerCase() !== (METHOD_NAME[d.method_production ?? ''] ?? '').toLowerCase() && (
            <span className="ml-1 font-normal text-muted-foreground">(InkSoft: {d.method_inksoft})</span>
          )}
        </div>
        {size(d) && <div>{size(d)}</div>}
        {(d.colorway || d.color_count) && <div>{[d.colorway, d.color_count && `${d.color_count} color${d.color_count === '1' ? '' : 's'}`].filter(Boolean).join(' · ')}</div>}
        {d.thread_colors.length > 0 && <div>Thread: {d.thread_colors.join(', ')}</div>}
        {done && <div className="font-semibold text-green-700">Done</div>}
      </div>
    </div>
  );
}
