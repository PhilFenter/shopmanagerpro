// Counter Quote — a walk-in quote screen built to be looked at together.
//
// The salesperson and the customer sit side by side at the work-area iMac.
// Nothing internal is on screen (no garment cost, no markup), the price is always
// visible, and contact info comes AFTER the customer has a price. One save writes
// the quote + action item; "Send to Printavo" pushes that same quote, so nothing
// is typed twice. "Quick note" replaces the sticky note when there's no time.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Minus, Plus, StickyNote, Trash2, Send, RotateCcw, Sparkles,
} from "lucide-react";
import {
  ITEMS, METHOD_LABELS, DTF_SIZES, DTF_SIZED_PLACEMENTS, HAT_STYLES, TIER_LABELS, dtfSummary,
  methodsFor, placementsFor, newLine, priceLine, chosen, lineTotal, money,
  saveCounterQuote, saveQuickNote, findCustomer, pushToPrintavo,
  type CounterLine, type Priced, type Item, type Method, type CounterContact, type CounterExtras,
} from "@/lib/counterQuote";

const QTY_CHIPS = [12, 24, 48, 72, 144];
const emptyContact: CounterContact = { name: "", phone: "", email: "", company: "" };
const emptyExtras: CounterExtras = { dueDate: "", notes: "", needsArtHelp: false, shipping: false, nonprofit: false, ownGarments: false };

function Chip({ active, onClick, children, className }: { active?: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 px-5 py-3 text-lg font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function CounterQuote() {
  const { user } = useAuth();
  const [step, setStep] = useState<"build" | "info" | "done">("build");
  const [lines, setLines] = useState<CounterLine[]>([newLine("tee")]);
  const [activeId, setActiveId] = useState(lines[0].id);
  const [priced, setPriced] = useState<Record<string, Priced | undefined>>({});
  const [pricing, setPricing] = useState(false);
  const [contact, setContact] = useState<CounterContact>(emptyContact);
  const [extras, setExtras] = useState<CounterExtras>(emptyExtras);
  const [returning, setReturning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ quoteId: string; quoteNumber: string | null; actionItemId: string | null } | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushedId, setPushedId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Browser Back (or a two-finger swipe on the Mac) from page 2 returns to page 1
  // instead of leaving the screen and losing the quote.
  const goInfo = () => {
    window.history.pushState({ counterStep: "info" }, "");
    setStep("info");
  };
  const goBuild = () => {
    if (window.history.state?.counterStep === "info") window.history.back(); // popstate → build
    else setStep("build");
  };
  useEffect(() => {
    const onPop = () => setStep((cur) => (cur === "info" ? "build" : cur));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const line = lines.find((l) => l.id === activeId) ?? lines[0];
  const p = priced[line.id];

  // Re-price whenever anything changes (same engine as email/website intake).
  const runId = useRef(0);
  const lastStyles = useRef("");
  useEffect(() => {
    const id = ++runId.current;
    setPricing(true);
    // While a style number is being typed, wait for a pause so SanMar is only
    // asked about the finished style (PC55), not every keystroke (P, PC, PC5).
    const styles = lines.map((l) => l.style.trim().toUpperCase()).join("|");
    const typing = styles !== lastStyles.current;
    lastStyles.current = styles;
    const t = setTimeout(async () => {
      const entries = await Promise.all(lines.map(async (l) => [l.id, await priceLine(supabase, l)] as const));
      if (id === runId.current) {
        setPriced(Object.fromEntries(entries));
        setPricing(false);
      }
    }, typing ? 700 : 120);
    return () => clearTimeout(t);
  }, [lines]);

  const update = (patch: Partial<CounterLine>) =>
    setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, ...patch } : l)));

  const setItem = (item: Item) => {
    const method = methodsFor(item).includes(line.method) ? line.method : methodsFor(item)[0];
    update({ item, method, placements: [placementsFor(item, method)[0]] });
  };
  const setMethod = (method: Method) => {
    const allowed = placementsFor(line.item, method);
    const kept = line.placements.filter((x) => allowed.includes(x));
    update({ method, placements: kept.length ? kept : [allowed[0]] });
  };
  const togglePlacement = (pl: string) => {
    const has = line.placements.includes(pl);
    const next = has ? line.placements.filter((x) => x !== pl) : [...line.placements, pl];
    if (next.length) update({ placements: next });
  };

  const addLine = (item: Item) => {
    const l = newLine(item);
    setLines((ls) => [...ls, l]);
    setActiveId(l.id);
    setStep("build");
  };
  const removeLine = (id: string) => {
    setLines((ls) => {
      const next = ls.filter((l) => l.id !== id);
      if (id === activeId && next[0]) setActiveId(next[0].id);
      return next.length ? next : ls;
    });
  };

  const grand = useMemo(
    () => (extras.ownGarments ? 0 : lines.reduce((a, l) => a + lineTotal(l, priced[l.id]), 0)),
    [lines, priced, extras.ownGarments],
  );

  const lookup = async () => {
    try {
      const c = await findCustomer(supabase, contact.phone, contact.email);
      if (c) {
        setReturning(c.name);
        setContact((x) => ({
          name: x.name || c.name || "",
          phone: x.phone || c.phone || "",
          email: x.email || c.email || "",
          company: x.company || c.company || "",
        }));
      }
    } catch { /* lookup is a nicety */ }
  };

  const canSave = contact.name.trim() && (contact.phone.trim() || contact.email.trim()) && lines.some((l) => l.qty > 0);

  const save = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      const r = await saveCounterQuote(supabase, user.id, contact, extras, lines, priced);
      setSaved(r);
      setStep("done");
    } catch (e: any) {
      toast.error(`Couldn't save: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const push = async () => {
    if (!saved) return;
    setPushing(true);
    try {
      const r = await pushToPrintavo(supabase, saved.quoteId, saved.actionItemId);
      setPushedId(r.printavoVisualId ?? "sent");
      toast.success(`In Printavo as #${r.printavoVisualId}`);
    } catch (e: any) {
      toast.error(`Printavo push failed: ${e.message || e}. It's saved; push it from Action Items.`);
    } finally {
      setPushing(false);
    }
  };

  const reset = () => {
    const l = newLine("tee");
    setLines([l]); setActiveId(l.id); setContact(emptyContact); setExtras(emptyExtras);
    setReturning(null); setSaved(null); setPushedId(null); setStep("build");
  };

  const saveNote = async () => {
    if (!user) return;
    if (!contact.name.trim() && !contact.phone.trim()) { toast.error("Add a name or phone"); return; }
    try {
      await saveQuickNote(supabase, user.id, contact, noteText);
      toast.success("Saved to Action Items");
      setNoteOpen(false); setNoteText(""); setContact(emptyContact);
    } catch (e: any) { toast.error(`Couldn't save: ${e.message || e}`); }
  };

  // ── Price panel (always visible) ─────────────────────────────────────
  const s = chosen(line, p);
  const pricePanel = (
    <div className="space-y-5 rounded-3xl border bg-card p-7 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your price</div>
        {pricing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {extras.ownGarments && line.item !== "hat" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-lg text-amber-950">
          We generally decorate garments we supply, so we can stand behind the whole job. Let's look at a few stocked options at your budget. If you still need to bring your own, a manager will review it first.
        </div>
      ) : p?.blocker ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <div className="text-lg">{p.blocker}</div>
          {p.suggestDtf && (
            <Button size="lg" className="w-full text-lg" onClick={() => setMethod("dtf")}>
              Price it as a full-color print instead
            </Button>
          )}
        </div>
      ) : s ? (
        <>
          <div>
            <div className="text-6xl font-bold tracking-tight">{money(s.unit_price)}<span className="ml-2 text-2xl font-medium text-muted-foreground">each</span></div>
            {s.upcharge_2xl > 0 && (
              <div className="mt-2 text-xl text-muted-foreground">2XL and up: {money(s.unit_price + s.upcharge_2xl)} each</div>
            )}
          </div>

          {line.item !== "hat" && p?.requested && (
            <button
              type="button"
              onClick={() => update({ usePick: true })}
              className={cn(
                "w-full rounded-2xl border-2 p-4 text-left transition-colors",
                line.usePick ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
              )}
            >
              <div className="text-sm font-semibold">Your pick</div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-base leading-tight">{p.requested.name}</span>
                <span className="text-2xl font-bold">{money(p.requested.unit_price)}</span>
              </div>
            </button>
          )}
          {line.item !== "hat" && line.style.trim() && pricing && !p?.requested && (
            <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-base text-sky-950" role="status">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Looking up {line.style.trim().toUpperCase()}…
            </div>
          )}
          {line.item !== "hat" && !pricing && p?.requestedMissing && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-950">
              Couldn't find {line.style.trim().toUpperCase()} at SanMar or S&amp;S. Check the style number, or pick one of our house options below.
            </div>
          )}
          {line.item !== "hat" && p && p.tiers.length > 1 && (
            <div className="grid grid-cols-3 items-stretch gap-3">
              {p.tiers.map((t) => (
                <button
                  key={t.tier}
                  type="button"
                  onClick={() => update({ tier: t.tier, usePick: false })}
                  className={cn(
                    "rounded-2xl border-2 p-3 text-left transition-colors",
                    line.tier === t.tier && !(line.usePick && p?.requested) ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
                  )}
                >
                  <div className="text-sm font-semibold">{TIER_LABELS[t.tier]}</div>
                  <div className="text-2xl font-bold">{money(t.unit_price)}</div>
                  <div className="text-xs leading-tight text-muted-foreground">{t.name}</div>
                </button>
              ))}
            </div>
          )}

          {p!.fees.map((f) => (
            <div key={f.label} className="flex justify-between text-lg"><span>{f.label}</span><span>{money(f.amount)}</span></div>
          ))}

          <div className="flex items-baseline justify-between border-t pt-4">
            <span className="text-lg text-muted-foreground">{p!.billedQty} pieces, about</span>
            <span className="text-3xl font-bold">{money(lineTotal(line, p))}</span>
          </div>

          {p!.nextBreak && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-4 py-3 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              At {p!.nextBreak.qty} pieces they drop to {money(p!.nextBreak.unit)} each.
            </div>
          )}

          <ul className="space-y-1 text-base text-muted-foreground">
            {p!.notes.map((n) => <li key={n}>• {n}</li>)}
            <li>• Plus tax. Final price is confirmed once we have your art and sizes.</li>
          </ul>
        </>
      ) : (
        <div className="text-lg text-muted-foreground">Pick a quantity to see a price.</div>
      )}

      {lines.length > 1 && !extras.ownGarments && (
        <div className="flex items-baseline justify-between rounded-2xl bg-primary/10 px-5 py-4">
          <span className="text-lg">Whole order, about</span>
          <span className="text-3xl font-bold">{money(grand)}</span>
        </div>
      )}
    </div>
  );

  // ── Order summary (info step): everything the customer is getting ────
  const summaryPanel = (
    <div className="space-y-4 rounded-3xl border bg-card p-7 shadow-sm">
      <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your order</div>
      {lines.filter((l) => l.qty > 0).map((l) => {
        const lp = priced[l.id];
        const ls = chosen(l, lp);
        return (
          <div key={l.id} className="space-y-1 border-b pb-4 last:border-b-0">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xl font-semibold">{lp?.billedQty ?? l.qty} {ITEMS.find((x) => x.id === l.item)!.label}</span>
              <span className="text-xl font-semibold">
                {extras.ownGarments && l.item !== "hat" ? "Manager review" : lp?.blocker ? "We'll price it" : ls ? `${money(ls.unit_price)} each` : ""}
              </span>
            </div>
            <div className="text-base text-muted-foreground">
              {ls?.name ?? ""}{ls ? " · " : ""}{l.method === "screen_print" ? `${l.colors}-color print · ${l.placements.join(" + ")}` : l.method === "dtf" ? `Full-color print · ${dtfSummary(l)}` : `${METHOD_LABELS[l.method]} · ${l.placements.join(" + ")}`}
            </div>
            {ls && ls.upcharge_2xl > 0 && !lp?.blocker && !extras.ownGarments && <div className="text-base text-muted-foreground">2XL and up: {money(ls.unit_price + ls.upcharge_2xl)} each</div>}
            {!extras.ownGarments && lp?.fees.map((f) => <div key={f.label} className="flex justify-between text-base text-muted-foreground"><span>{f.label}</span><span>{money(f.amount)}</span></div>)}
          </div>
        );
      })}
      {!extras.ownGarments && grand > 0 && (
        <div className="flex items-baseline justify-between rounded-2xl bg-primary/10 px-5 py-4">
          <span className="text-lg">Estimated total</span>
          <span className="text-3xl font-bold">{money(grand)}</span>
        </div>
      )}
      <div className="text-base text-muted-foreground">Plus tax. Final price is confirmed once we have your art and sizes.</div>
    </div>
  );

  // ── Done ─────────────────────────────────────────────────────────────
  if (step === "done" && saved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-2xl space-y-6 rounded-3xl border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><Check className="h-8 w-8 text-primary" /></div>
          <div className="text-4xl font-bold">You're all set, {contact.name.split(" ")[0]}.</div>
          <div className="text-xl text-muted-foreground">
            Quote {saved.quoteNumber ? `#${saved.quoteNumber}` : ""} is saved{grand > 0 ? `, about ${money(grand)} plus tax` : ""}. We'll follow up {contact.email ? "by email" : "by phone"} once we have your art.
          </div>
          <div className="flex flex-col gap-3 pt-2">
            {pushedId ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-4 text-lg font-medium text-primary"><Check className="h-5 w-5" /> In Printavo as #{pushedId}</div>
            ) : (
              <Button size="lg" className="h-14 text-lg" onClick={push} disabled={pushing}>
                {pushing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Send to Printavo now
              </Button>
            )}
            <Button size="lg" variant="outline" className="h-14 text-lg" onClick={reset}>
              <RotateCcw className="mr-2 h-5 w-5" /> Next customer
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">Saved to Action Items with a checklist for art, sizes, and colors.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-8 py-4">
        <div className="flex items-center gap-4">
          {step === "info" ? (
            <button type="button" onClick={goBuild} className="text-muted-foreground hover:text-foreground" title="Back to the order"><ArrowLeft className="h-5 w-5" /></button>
          ) : (
            <Link to="/action-items" className="text-muted-foreground hover:text-foreground" title="Back to Shop Manager"><ArrowLeft className="h-5 w-5" /></Link>
          )}
          <div className="text-2xl font-bold">Hells Canyon Designs</div>
          <div className="text-xl text-muted-foreground">Let's price your order</div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-muted p-1">
          {([["build", "1. Your order"], ["info", "2. Your info"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={id === "info" && !lines.some((l) => l.qty > 0)}
              onClick={() => (id === "build" ? (step === "info" && goBuild()) : step === "build" && goInfo())}
              className={cn(
                "rounded-full px-5 py-2 text-base font-medium transition-colors disabled:opacity-50",
                step === id ? "bg-card shadow-sm" : "text-foreground/70 hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="lg" className="text-base" onClick={() => setNoteOpen(true)}>
          <StickyNote className="mr-2 h-5 w-5" /> Quick note
        </Button>
      </header>

      {/* Quick note */}
      {noteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={() => setNoteOpen(false)}>
          <div className="w-full max-w-xl space-y-4 rounded-3xl bg-card p-8" onClick={(e) => e.stopPropagation()}>
            <div className="text-2xl font-bold">Quick note</div>
            <div className="text-muted-foreground">No time for a full quote? Name, phone, and what they want. It goes straight to Action Items.</div>
            <Input className="h-12 text-lg md:text-lg" placeholder="Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
            <Input className="h-12 text-lg md:text-lg" placeholder="Phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
            <Textarea className="text-lg md:text-lg" rows={3} placeholder="e.g. 30 hoodies for the softball team, wants a price by Friday" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <div className="flex gap-3">
              <Button size="lg" className="flex-1 text-lg" onClick={saveNote}>Save note</Button>
              <Button size="lg" variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Line tabs */}
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2 px-8 pt-6">
        {lines.map((l) => {
          const lp = priced[l.id];
          const ls = chosen(l, lp);
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => { setActiveId(l.id); if (step === "info") goBuild(); }}
              className={cn(
                "flex items-center gap-3 rounded-full border-2 px-5 py-2 text-base",
                l.id === line.id && step === "build" ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <span className="font-semibold">{l.qty} {ITEMS.find((x) => x.id === l.item)!.label}</span>
              {ls && !lp?.blocker && !extras.ownGarments && <span className="text-muted-foreground">{money(ls.unit_price)} ea</span>}
              {lines.length > 1 && (
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeLine(l.id); }} />
              )}
            </button>
          );
        })}
        <Button variant="ghost" size="lg" className="text-base" onClick={() => addLine(line.item === "hat" ? "tee" : "hat")}>
          <Plus className="mr-1 h-5 w-5" /> Add another item
        </Button>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-10 p-8 lg:grid-cols-[1fr_minmax(440px,540px)]">
        {/* Left: build or info */}
        {step === "build" ? (
          <div className="space-y-8">
            <Section title="What are we making?">
              <div className="flex flex-wrap gap-3">
                {ITEMS.map((it) => <Chip key={it.id} active={line.item === it.id} onClick={() => setItem(it.id)} className="min-w-[140px] py-5 text-xl">{it.label}</Chip>)}
              </div>
            </Section>

            {line.item !== "hat" && (
              <Section title="Have a specific one in mind? (optional)">
                <Input
                  className="h-12 max-w-md text-lg uppercase md:text-lg"
                  placeholder="Style number, e.g. PC55"
                  value={line.style}
                  onChange={(e) => update({ style: e.target.value.replace(/\s+/g, ""), usePick: true })}
                />
              </Section>
            )}

            <Section title="How many?">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="icon" className="h-14 w-14" onClick={() => update({ qty: Math.max(0, line.qty - 1) })}><Minus className="h-6 w-6" /></Button>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={line.qty || ""}
                  onChange={(e) => update({ qty: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  className="h-14 w-32 text-center text-3xl font-bold md:text-3xl"
                />
                <Button variant="outline" size="icon" className="h-14 w-14" onClick={() => update({ qty: line.qty + 1 })}><Plus className="h-6 w-6" /></Button>
                <div className="ml-2 flex flex-wrap gap-2">
                  {QTY_CHIPS.map((q) => <Chip key={q} active={line.qty === q} onClick={() => update({ qty: q })}>{q}</Chip>)}
                </div>
              </div>
            </Section>

            <Section title="Decoration">
              <div className="flex flex-wrap gap-3">
                {methodsFor(line.item).map((m) => <Chip key={m} active={line.method === m} onClick={() => setMethod(m)}>{METHOD_LABELS[m]}</Chip>)}
              </div>
              {line.item === "polo" && <div className="text-muted-foreground">Polos get left-chest embroidery. It's what looks best on them.</div>}
            </Section>

            {line.method === "screen_print" && (
              <Section title="How many ink colors in the design?">
                <div className="flex flex-wrap gap-3">
                  {[1, 2, 3, 4, 5, 6].map((c) => <Chip key={c} active={line.colors === c} onClick={() => update({ colors: c })}>{c}</Chip>)}
                  <span className="self-center text-muted-foreground">Not sure? Leave it at 1. We'll confirm with the art.</span>
                </div>
              </Section>
            )}

            {line.item === "hat" && (
              <Section title="Hat style">
                <div className="flex flex-wrap gap-3">
                  {HAT_STYLES.map((h) => (
                    <Chip key={h.style} active={line.hatStyle === h.style} onClick={() => update({ hatStyle: h.style })} className="text-base">
                      {h.name.replace(/^Richardson /, "")}
                    </Chip>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Where does it go?">
              <div className="flex flex-wrap gap-3">
                {placementsFor(line.item, line.method).map((pl) => (
                  <Chip key={pl} active={line.placements.includes(pl)} onClick={() => togglePlacement(pl)}>
                    {pl}
                    {line.method === "dtf" && !DTF_SIZED_PLACEMENTS.includes(pl) && <span className="ml-2 text-sm opacity-70">4 x 4</span>}
                  </Chip>
                ))}
              </div>
              {line.method === "dtf" && line.placements.filter((pl) => DTF_SIZED_PLACEMENTS.includes(pl)).map((pl) => {
                const key = pl === "Front" ? "dtfFront" : "dtfBack";
                return (
                  <div key={pl} className="flex flex-wrap items-center gap-3 pl-1">
                    <span className="w-28 text-lg font-medium">{pl} size</span>
                    {[1, 2].map((i) => (
                      <Chip key={i} active={line[key] === i} onClick={() => update({ [key]: i } as Partial<CounterLine>)}>
                        {DTF_SIZES[i]}<span className="ml-2 text-sm opacity-70">{i === 1 ? "standard" : "full size"}</span>
                      </Chip>
                    ))}
                  </div>
                );
              })}
            </Section>

            <Section title="Color (optional)">
              <Input className="h-12 max-w-md text-lg md:text-lg" placeholder={line.item === "hat" ? "e.g. black/white, loden" : "e.g. navy, heather gray"} value={line.color} onChange={(e) => update({ color: e.target.value })} />
            </Section>

            <label className="flex items-center gap-3 text-lg text-muted-foreground">
              <input type="checkbox" className="h-5 w-5" checked={extras.ownGarments} onChange={(e) => setExtras({ ...extras, ownGarments: e.target.checked })} />
              Customer wants to bring their own garments
            </label>
          </div>
        ) : (
          <div className="space-y-8">
            <Section title="Who's this for?">
              {returning && <div className="rounded-xl bg-primary/5 px-4 py-3 text-lg">Welcome back, {returning.split(" ")[0]}.</div>}
              <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cq-name" className="text-base">Name</Label><Input id="cq-name" autoFocus className="h-14 text-xl md:text-xl" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="cq-phone" className="text-base">Phone</Label><Input id="cq-phone" className="h-14 text-xl md:text-xl" inputMode="tel" value={contact.phone} onBlur={lookup} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="cq-email" className="text-base">Email</Label><Input id="cq-email" className="h-14 text-xl md:text-xl" type="email" value={contact.email} onBlur={lookup} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cq-company" className="text-base">Business or team (optional)</Label><Input id="cq-company" className="h-14 text-xl md:text-xl" value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} /></div>
              </div>
            </Section>

            <Section title="When do you need it?">
              <div className="flex flex-wrap items-center gap-3">
                <Chip active={extras.dueDate === addDays(14)} onClick={() => setExtras({ ...extras, dueDate: addDays(14) })}>Standard (2 weeks)</Chip>
                <Chip active={!extras.dueDate} onClick={() => setExtras({ ...extras, dueDate: "" })}>No rush</Chip>
                <Input type="date" className="h-14 w-56 text-lg md:text-lg" value={extras.dueDate} min={addDays(1)} onChange={(e) => setExtras({ ...extras, dueDate: e.target.value })} />
              </div>
              {extras.dueDate && extras.dueDate < addDays(10) && (
                <div className="text-lg text-amber-600">That's a quick turnaround. We'll confirm we can hit it.</div>
              )}
            </Section>

            <Section title="Anything we should know?">
              <div className="flex flex-wrap gap-3">
                <Chip active={extras.needsArtHelp} onClick={() => setExtras({ ...extras, needsArtHelp: !extras.needsArtHelp })}>Need help with art</Chip>
                <Chip active={extras.shipping} onClick={() => setExtras({ ...extras, shipping: !extras.shipping })}>Ship it</Chip>
                <Chip active={extras.nonprofit} onClick={() => setExtras({ ...extras, nonprofit: !extras.nonprofit })}>Nonprofit / tax exempt</Chip>
              </div>
              <Textarea className="max-w-2xl text-lg md:text-lg" rows={3} placeholder="Event date, sizes you already know, names on the back, anything else" value={extras.notes} onChange={(e) => setExtras({ ...extras, notes: e.target.value })} />
            </Section>
          </div>
        )}

        {/* Right: price + next step */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {step === "build" ? pricePanel : summaryPanel}
          {step === "build" ? (
            <Button size="lg" className="h-16 w-full text-xl" onClick={goInfo} disabled={!lines.some((l) => l.qty > 0)}>
              Looks good, save my quote <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          ) : (
            <div className="space-y-3">
              <Button size="lg" className="h-16 w-full text-xl" onClick={save} disabled={!canSave || saving}>
                {saving ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Check className="mr-2 h-6 w-6" />}
                Save quote
              </Button>
              {!canSave && <div className="text-center text-muted-foreground">Name and a phone or email, and you're done.</div>}
              <Button variant="outline" size="lg" className="h-14 w-full text-lg" onClick={goBuild}><ArrowLeft className="mr-2 h-5 w-5" /> Back to the order</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
