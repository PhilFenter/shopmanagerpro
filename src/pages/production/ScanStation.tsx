import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ScanLine, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rpc } from '@/lib/production/db';
import { METHOD_LABEL, type ScanResult } from '@/hooks/useProductionFloor';
import { cn } from '@/lib/utils';
import { WorkCard } from '@/components/production/WorkCard';

// Scan station. The NetumScan scanners act as a keyboard: they type the label's QR text and press Enter.
// The input keeps focus so nobody has to click before scanning.

type Station = 'dtf' | 'embroidery' | 'shipping';
const STATIONS: { id: Station; name: string; hint: string }[] = [
  { id: 'dtf', name: 'DTF Station', hint: 'Scan a garment to see what goes on it. Scan it again (or press Done) after it’s pressed.' },
  { id: 'embroidery', name: 'Embroidery Room', hint: 'Scan a garment to see what goes on it. Scan it again (or press Done) when it comes off the hoop.' },
  { id: 'shipping', name: 'Shipping & Receiving', hint: 'Scan garment labels to put pieces in their spot. Scan the 4×6 pickup label when the order is bagged.' },
];
const KEY = 'prod.scanStation';
const QUICK_KEY = 'prod.scanQuick';

interface Entry { id: string; at: Date; code: string; station: string; result?: ScanResult; error?: string; undone?: boolean; showing?: boolean }

function tone(r?: ScanResult, error?: string): 'good' | 'info' | 'warn' | 'bad' {
  if (error || !r) return 'bad';
  if (['done', 'assembled', 'packed'].includes(r.kind) && !r.repeat) return 'good';
  if (r.kind === 'info' && r.ok) return 'info';
  if (['already', 'info'].includes(r.kind) || r.repeat) return 'info';
  if (['voided', 'on_hold', 'unknown'].includes(r.kind)) return 'bad';
  return 'warn';
}
const TONE = {
  good: 'bg-green-600 text-white',
  info: 'bg-sky-600 text-white',
  warn: 'bg-amber-400 text-black',
  bad: 'bg-red-600 text-white',
};

let audio: AudioContext | null = null;
function beep(ok: boolean) {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = ok ? 1200 : 220;
    o.type = ok ? 'sine' : 'square';
    g.gain.value = 0.15;
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + (ok ? 0.12 : 0.45));
  } catch { /* no sound available */ }
}

export function ResultPanel({ entry, big = true }: { entry: Entry; big?: boolean }) {
  const r = entry.result;
  const t = tone(r, entry.error);
  return (
    <div className={cn('rounded-xl p-6', TONE[t])}>
      {r?.spot && ['assembled', 'already'].includes(r.kind) && (
        <div className={cn('font-black leading-none', big ? 'text-[9rem]' : 'text-6xl')}>SPOT {r.spot}</div>
      )}
      <div className={cn('font-bold', big ? 'text-3xl' : 'text-xl')}>
        {entry.error ?? (entry.showing ? 'Here’s the work for this piece' : r?.repeat ? `Same scan as before: ${r.message ?? ''}` : r?.message ?? (r?.kind === 'info' ? 'Label found' : ''))}
      </div>
      {r?.garment && (
        <div className={cn('mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1', big ? 'text-2xl' : 'text-lg')}>
          <span className="font-mono font-bold">{r.garment.code}</span>
          <span>Size <b>{r.garment.size}</b></span>
          <span>{[r.garment.mfg_sku, r.garment.color].filter(Boolean).join(' · ')}</span>
        </div>
      )}
      {r?.order && (
        <div className={cn('mt-1 opacity-90', big ? 'text-xl' : 'text-base')}>
          {r.order.customer_name ?? 'No name'} · {r.order.store_name ?? ''}
          {r.progress && <> · {r.progress.assembled} of {r.progress.garments} pieces in</>}
        </div>
      )}
      {r?.garment && r.garment.tasks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.garment.tasks.map((x) => (
            <span key={x.id} className={cn('rounded px-2 py-1 text-sm font-semibold',
              x.status === 'done' ? 'bg-white/90 text-green-800' : 'bg-black/25')}>
              {x.status === 'done' ? '✓' : '○'} {x.location} {METHOD_LABEL[x.method] ?? x.method}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function newScanId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export default function ScanStation() {
  const [station, setStation] = useState<Station | null>(() => (localStorage.getItem(KEY) as Station) || null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Entry[]>([]);
  const [quick, setQuick] = useState(() => localStorage.getItem(QUICK_KEY) === '1');
  // the piece currently on screen at DTF/embroidery (shown, not yet marked done)
  const [showing, setShowing] = useState<{ garmentId: string; code: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // keep the cursor in the scan box unless someone is using another control
  useEffect(() => {
    const t = setInterval(() => {
      const a = document.activeElement;
      if (!a || a === document.body) inputRef.current?.focus();
    }, 500);
    return () => clearInterval(t);
  }, []);

  const choose = (s: Station | null) => {
    setStation(s);
    setShowing(null);
    if (s) localStorage.setItem(KEY, s); else localStorage.removeItem(KEY);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const record = useCallback(async (value: string, st: string, extra: Partial<Entry> = {}) => {
    const id = newScanId();
    setLog((l) => [{ id, at: new Date(), code: value, station: st, ...extra }, ...l].slice(0, 30));
    try {
      const r = await rpc<ScanResult>('prod_scan', { p_code: value, p_station: st, p_client_scan_id: id });
      setLog((l) => l.map((e) => (e.id === id ? { ...e, result: r } : e)));
      return r;
    } catch (e) {
      setLog((l) => l.map((x) => (x.id === id ? { ...x, error: (e as Error).message } : x)));
      beep(false);
      return null;
    }
  }, []);

  const complete = useCallback(async (value: string) => {
    if (!station || station === 'shipping') return;
    const r = await record(value, station);
    if (r) beep(tone(r) === 'good' || tone(r) === 'info');
    setShowing(null);
  }, [station, record]);

  const submit = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value || !station) return;
    setBusy(true);
    try {
      if (station === 'shipping') {
        const r = await record(value, /\/P\//i.test(value) ? 'pack' : 'assembly');
        if (r) beep(tone(r) === 'good' || tone(r) === 'info');
        return;
      }
      if (quick) { await complete(value); return; }
      // first scan shows the work; scanning the same piece again marks it done
      const look = await rpc<ScanResult>('prod_scan', { p_code: value, p_station: 'lookup', p_client_scan_id: newScanId() }).catch((e: Error) => {
        setLog((l) => [{ id: newScanId(), at: new Date(), code: value, station, error: e.message }, ...l].slice(0, 30));
        beep(false);
        return null;
      });
      if (!look) return;
      const gid = look.garment?.id;
      if (look.ok && gid && showing?.garmentId === gid) {
        await complete(value);
        return;
      }
      setLog((l) => [{ id: newScanId(), at: new Date(), code: value, station, result: look, showing: look.ok && !!gid }, ...l].slice(0, 30));
      beep(look.ok);
      setShowing(look.ok && gid ? { garmentId: gid, code: value } : null);
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ['prod'] });
      inputRef.current?.focus();
    }
  }, [station, qc, quick, showing, record, complete]);

  const undo = async (e: Entry) => {
    const tasks = (e.result?.garment?.tasks ?? []).filter((t) => t.status === 'done' && t.done_station === e.station);
    try {
      for (const t of tasks) await rpc('prod_set_task', { p_task_id: t.id, p_done: false });
      setLog((l) => l.map((x) => (x.id === e.id ? { ...x, undone: true } : x)));
      toast.success(`Undone: ${tasks.map((t) => t.location).join(', ')} is open again`);
      qc.invalidateQueries({ queryKey: ['prod'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
    inputRef.current?.focus();
  };

  const info = STATIONS.find((s) => s.id === station);
  const latest = log[0];

  if (!station) {
    return (
      <>
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          <h1 className="text-2xl font-bold">Which station is this computer?</h1>
          <p className="text-muted-foreground">This is remembered on this computer. You can change it any time.</p>
          <div className="grid gap-3">
            {STATIONS.map((s) => (
              <Button key={s.id} variant="outline" className="h-auto justify-start p-5 text-left" onClick={() => choose(s.id)}>
                <div>
                  <div className="text-xl font-semibold">{s.name}</div>
                  <div className="text-sm font-normal text-muted-foreground">{s.hint}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <ScanLine className="h-7 w-7" />
          <h1 className="text-2xl font-bold">{info?.name}</h1>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" asChild><Link to="/production/orders">Production board</Link></Button>
          {station !== 'shipping' && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={quick} onChange={(e) => { setQuick(e.target.checked); localStorage.setItem(QUICK_KEY, e.target.checked ? '1' : '0'); setShowing(null); inputRef.current?.focus(); }} />
              One scan marks done
            </label>
          )}
          <Button variant="outline" size="sm" onClick={() => choose(null)}>Change station</Button>
        </div>
        <p className="text-muted-foreground">{info?.hint}</p>
        <form onSubmit={(e) => { e.preventDefault(); const v = code; setCode(''); void submit(v); }} className="flex gap-2">
          <Input
            ref={inputRef}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Scan a label (or type 1002714-03 and press Enter)"
            className="h-14 text-xl"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" className="h-14 px-6" disabled={!code.trim()}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enter'}
          </Button>
        </form>

        {latest ? (
          latest.result || latest.error ? <ResultPanel entry={latest} /> : (
            <div className="rounded-xl bg-muted p-6 text-2xl"><Loader2 className="mr-2 inline h-6 w-6 animate-spin" />Checking…</div>
          )
        ) : (
          <div className="rounded-xl border-2 border-dashed p-10 text-center text-xl text-muted-foreground">Ready to scan</div>
        )}

        {station !== 'shipping' && !quick && showing && (
          <Button
            className="h-16 w-full bg-green-600 text-2xl font-bold hover:bg-green-700"
            disabled={busy}
            onClick={async () => { setBusy(true); try { await complete(showing.code); } finally { setBusy(false); qc.invalidateQueries({ queryKey: ['prod'] }); inputRef.current?.focus(); } }}
          >
            Done: mark this piece finished (or scan it again)
          </Button>
        )}
        {latest?.result?.garment && (
          <WorkCard
            key={latest.result.garment.id}
            garmentId={latest.result.garment.id}
            station={station === 'shipping' ? 'shipping' : station}
            compact={station === 'shipping'}
          />
        )}

        {log.length > 0 && (
          <div className="rounded-lg border">
            <div className="border-b px-3 py-2 text-sm font-semibold">Recent scans on this computer</div>
            <ul className="divide-y text-sm">
              {log.map((e) => {
                const t = tone(e.result, e.error);
                const canUndo = !e.undone && e.result?.kind === 'done' && !e.result.repeat;
                return (
                  <li key={e.id} className="flex items-center gap-3 px-3 py-2">
                    <span className={cn('h-3 w-3 shrink-0 rounded-full', TONE[t].split(' ')[0])} />
                    <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{e.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    <span className="w-32 shrink-0 font-mono">{e.result?.garment?.code ?? e.result?.order?.order_number ?? e.code.slice(-14)}</span>
                    <span className="flex-1">{e.undone ? 'Undone' : e.error ?? (e.showing ? 'Looked at (not marked done)' : e.result?.message) ?? '…'}</span>
                    {canUndo && (
                      <Button size="sm" variant="ghost" onClick={() => undo(e)}><Undo2 className="mr-1 h-4 w-4" />Undo</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

/** /g/:token and /p/:token — someone scanned a label with a phone camera, or clicked a link. Look only, change nothing. */
export function ScanLookup({ kind }: { kind: 'g' | 'p' }) {
  const { token = '' } = useParams();
  const [entry, setEntry] = useState<Entry | null>(null);
  useEffect(() => {
    const id = newScanId();
    rpc<ScanResult>('prod_scan', { p_code: `/${kind}/${token}`, p_station: 'lookup', p_client_scan_id: id })
      .then((r) => setEntry({ id, at: new Date(), code: token, station: 'lookup', result: r }))
      .catch((e) => setEntry({ id, at: new Date(), code: token, station: 'lookup', error: (e as Error).message }));
  }, [kind, token]);
  return (
    <>
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <h1 className="text-2xl font-bold">{kind === 'g' ? 'Garment label' : 'Pickup label'}</h1>
        {!entry ? <Loader2 className="h-6 w-6 animate-spin" /> : <ResultPanel entry={entry} big={false} />}
        <p className="text-sm text-muted-foreground">Looking at a label here doesn't change anything. Use the Scan Station page to record work.</p>
        <div className="flex gap-2">
          {entry?.result?.order && (
            <Button asChild><Link to={`/production/orders/${entry.result.order.id}`}>Open order {entry.result.order.order_number}</Link></Button>
          )}
          <Button variant="outline" asChild><Link to="/scan">Scan Station</Link></Button>
        </div>
      </div>
    </>
  );
}
