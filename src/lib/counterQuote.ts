// Counter Quote — pricing + save logic for walk-in customers.
//
// Pricing comes straight from supabase/functions/_shared/hcd-pricing.ts, the same
// file the email and website intake use, so a walk-in gets the exact price an
// email customer would. Don't copy numbers into this file — change them there.
//
// Saving writes one quote + line items + one action item (source "counter"). The
// existing push-to-printavo function turns that same quote into the Printavo quote,
// so nothing gets typed twice.
import {
  suggestTiers,
  suggestRequested,
  suggestFromCost,
  freshCatalogCost,
  LIST_ROWS,
  matrixRow,
  hatPrice,
  hatTiers,
  hatNextTier,
  HAT_STITCH_TIERS,
  matrixNextTier,
  screenPrintMin,
  screenFeesByLocation,
  SMALL_MIN,
  SMALL_ORDER_UNDER,
  SMALL_ORDER_FEE,
  DIGITIZING_FEE,
  DIGITIZING_WAIVE_QTY,
  SCREEN_FEE,
  SCREEN_FEE_WAIVE_QTY,
  HAT_MIN,
  HAT_UPCHARGES,
  CUSTOM_QUOTE_QTY,
  type Suggestion,
  type Tier,
} from "../../supabase/functions/_shared/hcd-pricing.ts";

export type Item = "tee" | "hoodie" | "crew" | "polo" | "jacket" | "vest" | "hat";
export type Method = "screen_print" | "dtf" | "embroidery" | "patch" | "hat_embroidery";

export const ITEMS: { id: Item; label: string }[] = [
  { id: "tee", label: "T-Shirts" },
  { id: "hoodie", label: "Hoodies" },
  { id: "crew", label: "Crewnecks" },
  { id: "polo", label: "Polos" },
  { id: "jacket", label: "Jackets" },
  { id: "vest", label: "Vests" },
  { id: "hat", label: "Hats" },
];

export const METHOD_LABELS: Record<Method, string> = {
  screen_print: "Screen Print",
  dtf: "Full-Color Print (DTF)",
  embroidery: "Embroidery",
  patch: "Patch",
  hat_embroidery: "Embroidery",
};

export function methodsFor(item: Item): Method[] {
  if (item === "hat") return ["patch", "hat_embroidery"];
  if (item === "polo") return ["embroidery"]; // polos: left-chest embroidery only
  if (item === "vest") return ["embroidery"]; // vests: embroidery only (Phil 2026-10-28)
  if (item === "jacket") return ["embroidery", "dtf"]; // jackets: embroidery ($20 jacket column) or DTF
  return ["screen_print", "dtf", "embroidery"];
}

export function placementsFor(item: Item, method: Method): string[] {
  if (item === "hat") return ["Front", "Side", "Back"];
  if (item === "polo") return ["Left chest"];
  if (item === "vest") return ["Left chest", "Right chest"];
  if (item === "jacket") return method === "embroidery" ? ["Left chest", "Right chest", "Sleeve"] : ["Left chest", "Back", "Sleeve"];
  if (method === "embroidery") return ["Left chest", "Center front", "Sleeve"]; // no back embroidery
  return ["Front", "Back", "Left chest", "Sleeve"];
}

/** Quick-pick styles shown under "Have a specific one in mind?" (fills the style box). */
export const MORE_STYLES: Partial<Record<Item, { style: string; label: string }[]>> = {
  jacket: [
    { style: "J787", label: "J787 Hybrid Soft Shell" },
    { style: "CT103828", label: "Carhartt Detroit" },
    { style: "CT104050", label: "Carhartt Washed Duck Active Jac" },
  ],
  vest: [
    { style: "L219", label: "L219 Women's Fleece" },
    { style: "L325", label: "L325 Women's Soft Shell" },
    { style: "J709", label: "J709 Puffy" },
  ],
};

export const DTF_SIZES = ["4 x 4", "11 x 5", "11 x 14", "12 x 22"];
// DTF size by placement: left chest + sleeve are always 4x4; front and back pick 11x5, 11x14 or 12x22.
export const DTF_SIZED_PLACEMENTS = ["Front", "Back"];
export function dtfColFor(line: CounterLine, placement: string): number {
  if (placement === "Front") return line.dtfFront;
  if (placement === "Back") return line.dtfBack;
  return 0;
}
export function dtfSummary(line: CounterLine): string {
  return line.placements.map((pl) => `${pl} ${DTF_SIZES[dtfColFor(line, pl)]}`).join(" + ");
}
export const HAT_STYLES = Object.entries(HAT_UPCHARGES).map(([style, v]) => ({ style, name: v.name, add: v.add }));
export const TIER_LABELS: Record<Tier, string> = { good: "Value", better: "Mid-Grade", best: "Premium" };

export interface CounterLine {
  id: string;
  item: Item;
  qty: number;
  method: Method;
  colors: number; // screen print: default color count (used for any location not set below)
  colorsBy: Record<string, number>; // screen print: colors per location when designs differ
  dtfFront: number; // 1 = 11x5, 2 = 11x14, 3 = 12x22
  dtfBack: number;  // 1 = 11x5, 2 = 11x14, 3 = 12x22
  placements: string[];
  hatStyle: string;
  puff: boolean;    // hat embroidery: 3D puff (+$3/hat)
  stitchTier: number; // hat embroidery: 0 = up to 8k, 1 = 8–12k, 2 = 12–16k, 3 = over 16k (quote)
  tier: Tier;
  style: string;    // customer's own pick, e.g. "PC55" (optional)
  usePick: boolean; // price their pick instead of a house tier
  color: string; // garment color, free text
  sleeve: "short" | "long"; // T-shirts only
  jacketType: JacketType;   // Jackets only
}

export type JacketType = "softshell" | "puffer" | "insulated" | "fleece" | "rain";
export const JACKET_TYPES: { id: JacketType; label: string }[] = [
  { id: "softshell", label: "Soft shell" },
  { id: "puffer", label: "Puffer" },
  { id: "insulated", label: "Insulated" },
  { id: "fleece", label: "Fleece" },
  { id: "rain", label: "Rain" },
];

/** Pricing category: T-shirts split into short and long sleeve. */
export const categoryFor = (line: Pick<CounterLine, "item" | "sleeve"> & { jacketType?: JacketType }) =>
  line.item === "tee" && line.sleeve === "long" ? "longsleeve"
  : line.item === "jacket" && line.jacketType && line.jacketType !== "softshell" ? `jacket_${line.jacketType}`
  : line.item;
export const itemLabel = (line: Pick<CounterLine, "item" | "sleeve"> & { jacketType?: JacketType }) =>
  line.item === "tee" && line.sleeve === "long" ? "Long Sleeve Tees"
  : line.item === "jacket" ? `${JACKET_TYPES.find((t) => t.id === (line.jacketType ?? "softshell"))!.label} Jackets`
  : ITEMS.find((i) => i.id === line.item)!.label;

export function newLine(item: Item = "tee"): CounterLine {
  return {
    id: crypto.randomUUID(),
    item,
    qty: item === "hat" ? 24 : 24,
    method: methodsFor(item)[0],
    colors: 1,
    colorsBy: {},
    dtfFront: 1,
    dtfBack: 2,
    placements: [placementsFor(item, methodsFor(item)[0])[0]],
    hatStyle: "112",
    puff: false,
    stitchTier: 0,
    tier: "better",
    style: "",
    usePick: true,
    color: "",
    sleeve: "short",
    jacketType: "softshell",
  };
}

export interface Fee { label: string; amount: number }
export interface Priced {
  tiers: Suggestion[];       // 3 for garments and patch hats, 1 for embroidered hats
  requested: Suggestion | null; // the customer's own pick (style box), if we found its cost
  requestedMissing: boolean;    // they typed a style we couldn't find
  billedQty: number;         // hats under 12 bill at 12
  fees: Fee[];
  notes: string[];           // friendly, customer-safe notes
  blocker: string | null;    // can't price at the counter (custom / below minimum)
  suggestDtf: boolean;       // screen print below minimum → offer DTF
  approval: string | null;   // priced, but needs a manager's OK (staff-facing)
  nextBreak: { qty: number; unit: number } | null;
}

/** Screen print: one color count per selected location, in placement order. */
export function screenColorsFor(line: CounterLine): number[] {
  const list = line.placements.length ? line.placements : [""];
  return list.map((pl) => Math.max(line.colorsBy?.[pl] ?? line.colors ?? 1, 1));
}
/** "3-color" or "1-color Front + 3-color Back". */
export function screenSummary(line: CounterLine): string {
  const cs = screenColorsFor(line);
  if (line.placements.length <= 1) return `${cs[0]}-color`;
  return line.placements.map((pl, i) => `${cs[i]}-color ${pl}`).join(" + ");
}

const DIGITIZING: Fee = { label: "Digitizing (one-time, to set up your logo)", amount: DIGITIZING_FEE };

const service = (m: Method) => (m === "patch" || m === "hat_embroidery" ? "hat" : m);

function apparelFees(line: CounterLine, qty: number): Fee[] {
  const locs = Math.max(line.placements.length, 1);
  if (line.method === "screen_print") {
    const f = screenFeesByLocation(screenColorsFor(line), qty);
    return f > 0 ? [{ label: `Screen setup (${f / SCREEN_FEE} screen${f / SCREEN_FEE > 1 ? "s" : ""}, one-time)`, amount: f }] : [];
  }
  const fees: Fee[] = [];
  if (qty >= SMALL_MIN && qty < SMALL_ORDER_UNDER) fees.push({ label: "Small order fee (under 12)", amount: SMALL_ORDER_FEE });
  if (line.method === "embroidery" && qty < DIGITIZING_WAIVE_QTY) fees.push(DIGITIZING);
  return fees;
}

/** SanMar catalog details for a style the customer picked: name + S–XL and 2XL piece cost. */
// Only recent list-price rows count (see freshCatalogCost); otherwise ask SanMar live.
async function catalogStyle(db: any, style: string) {
  const fresh = await freshCatalogCost(db, style);
  if (!fresh.cost) return null;
  let name = style.toUpperCase();
  try {
    const { data } = await db.from("product_catalog").select("brand, description").eq("style_number", style.toUpperCase()).limit(1);
    const r = (data || [])[0];
    if (r) name = [r.brand, style.toUpperCase(), r.description].filter(Boolean).join(" ").replace(/&amp;/g, "&").replace(/\s+/g, " ").slice(0, 70);
  } catch { /* name is optional */ }
  return { name, cost: fresh.cost, cost2xl: fresh.cost2xl };
}

export interface LiveStyle { name: string; cost: number; cost2xl: number | null; supplier: "sanmar" | "ss_activewear" }

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
const isBase = (s: string) => /^(XS|S|M|L|XL)$/i.test(s.trim());
const is2xl = (s: string) => /^(2XL|XXL)$/i.test(s.trim());
// Colors cost more than white; quote the higher number (estimate high, never raise later).
const top = (xs: number[]) => (xs.length ? Math.max(...xs) : null);

/**
 * Styles that aren't in product_catalog (or are listed at $0): ask SanMar for
 * SanMar LIST piece price (Phil quotes from list on purpose), then S&S list. Cached per style for the session
 * and written back to product_catalog so the next lookup — and email/website
 * quotes — find it locally.
 */
const liveCache = new Map<string, Promise<LiveStyle | null>>();
export function liveStyle(db: any, style: string): Promise<LiveStyle | null> {
  const key = style.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,}$/.test(key) || typeof db?.functions?.invoke !== "function") return Promise.resolve(null);
  if (!liveCache.has(key)) {
    const job = withTimeout(lookupLive(db, key), 12_000).then((r) => {
      if (!r) liveCache.delete(key); // allow a retry later
      return r;
    });
    liveCache.set(key, job);
  }
  return liveCache.get(key)!;
}

async function lookupLive(db: any, style: string): Promise<LiveStyle | null> {
  try {
    const [pr, info] = await Promise.all([
      db.functions.invoke("sanmar-api", { body: { action: "getPricing", styleNumber: style } }),
      db.functions.invoke("sanmar-api", { body: { action: "getProductInfo", styleNumber: style } }).catch(() => null),
    ]);
    const rows = (pr?.data?.success && pr.data.pricing) || [];
    const price = (r: any) => Number(r.piecePrice) || 0;
    const cost = top(rows.filter((r: any) => isBase(String(r.size || ""))).map(price).filter((n: number) => n > 0));
    if (cost) {
      const first = info?.data?.items?.[0];
      const name = [first?.brandName, style, first?.title || first?.description].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 70);
      const live: LiveStyle = { name: name || style, cost, cost2xl: top(rows.filter((r: any) => is2xl(String(r.size || ""))).map(price).filter((n: number) => n > 0)), supplier: "sanmar" };
      void saveToCatalog(db, style, live, first?.brandName, first?.title);
      return live;
    }
  } catch { /* try S&S */ }
  try {
    const ss = await db.functions.invoke("ss-activewear-api", { body: { action: "getProducts", styleNumber: style } });
    const products = (ss?.data?.success && ss.data.products) || [];
    const price = (p: any) => parseFloat(p.piecePrice) || parseFloat(p.customerPrice) || 0;
    const sizeOf = (p: any) => String(p.sizeName || p.size || "");
    const cost = top(products.filter((p: any) => isBase(sizeOf(p))).map(price).filter((n: number) => n > 0));
    if (cost) {
      const info = ss.data.styleInfo;
      const live: LiveStyle = {
        name: [info?.brandName, style, info?.title].filter(Boolean).join(" ").slice(0, 70) || style,
        cost, cost2xl: top(products.filter((p: any) => is2xl(sizeOf(p))).map(price).filter((n: number) => n > 0)), supplier: "ss_activewear",
      };
      void saveToCatalog(db, style, live, info?.brandName, info?.title);
      return live;
    }
  } catch { /* not found anywhere */ }
  return null;
}

/** Best effort (admins only by RLS): fill or fix the S–XL and 2XL rows for this style. */
async function saveToCatalog(db: any, style: string, live: LiveStyle, brand?: string, title?: string) {
  try {
    const rows: [string, number][] = [[LIST_ROWS.reg, live.cost]];
    if (live.cost2xl) rows.push([LIST_ROWS.big, live.cost2xl]);
    for (const [size_range, piece_price] of rows) {
      const { data: existing } = await db.from("product_catalog").select("id")
        .eq("style_number", style).eq("size_range", size_range).eq("supplier", live.supplier).limit(1);
      if (existing?.length) {
        await db.from("product_catalog").update({ piece_price, updated_at: new Date().toISOString() }).eq("id", existing[0].id);
      } else {
        await db.from("product_catalog").insert({
          style_number: style, size_range, piece_price, supplier: live.supplier,
          brand: brand ? String(brand).toUpperCase() : null, description: title || null,
        });
      }
    }
  } catch { /* the live price is already on screen */ }
}

async function priceRequested(db: unknown, line: CounterLine, svc: string, qty: number, opts: object): Promise<Suggestion | null> {
  const style = line.style.trim().toUpperCase();
  if (!style) return null;
  let cat = await catalogStyle(db, style);
  let s = cat ? await suggestRequested(db, style, svc, qty, opts) : null;
  if (!s) {
    const live = await liveStyle(db, style);
    if (live) {
      cat = { name: live.name, cost: live.cost, cost2xl: live.cost2xl };
      s = suggestFromCost(style, live.cost, svc, qty, opts);
    }
  }
  // SanMar unreachable: fall back to our own cost table for styles we know.
  if (!s) s = await suggestRequested(db, style, svc, qty, opts);
  if (!s) return null;
  const row = matrixRow(svc, qty);
  const markup = row ? row.markup / 100 : 2;
  return {
    ...s,
    name: cat?.name || s.name,
    upcharge_2xl: cat?.cost && cat?.cost2xl && cat.cost2xl > cat.cost && s.markup_pct === row?.markup
      ? Number(((cat.cost2xl - cat.cost) * markup).toFixed(2)) : 0,
  };
}

// db = the browser supabase client; used only to read live SanMar prices from product_catalog.
export async function priceLine(db: unknown, line: CounterLine): Promise<Priced> {
  const qty = Math.max(0, Math.floor(line.qty || 0));
  const locs = Math.max(line.placements.length, 1);
  const out: Priced = { tiers: [], requested: null, requestedMissing: false, billedQty: qty, fees: [], notes: [], blocker: null, approval: null, suggestDtf: false, nextBreak: null };
  if (qty <= 0) return out;
  if (qty >= CUSTOM_QUOTE_QTY) {
    out.blocker = `${CUSTOM_QUOTE_QTY}+ pieces is a custom quote. Phil will price this one, and we'll get back to you quickly.`;
    return out;
  }

  if (line.item === "hat") {
    const emb = line.method === "hat_embroidery";
    const puff = emb && !!line.puff;
    const st = emb ? HAT_STITCH_TIERS[line.stitchTier ?? 0] : HAT_STITCH_TIERS[0];
    if (emb && !st) {
      out.blocker = "Over 16,000 stitches is quoted per job. Phil will price this one.";
      return out;
    }
    const stitchAdd = st.add;
    const s = hatPrice(line.hatStyle, qty, { locations: locs, puff, stitchAdd });
    if (!s) return out;
    out.tiers = line.method === "patch" ? hatTiers(line.hatStyle, qty, { locations: locs }) : [s];
    out.billedQty = Math.max(qty, HAT_MIN);
    if (qty < HAT_MIN) out.notes.push(`Hats start at ${HAT_MIN}. You can split the 12 across hat colors.`);
    if (line.method === "hat_embroidery" && out.billedQty < DIGITIZING_WAIVE_QTY) out.fees.push(DIGITIZING);
    out.notes.push(line.method === "patch"
      ? "Includes the hat and patch. Leather patches are sewn on; leatherette and full-color UV are heat pressed."
      : `Includes the hat and embroidery ${stitchAdd ? `at ${st.label} stitches (+$${stitchAdd} a hat)` : "up to 8,000 stitches"}${puff ? ", plus $3 a hat for 3D puff" : ""}.`);
    if (!HAT_UPCHARGES[line.hatStyle.toUpperCase()]) out.notes.push("Style isn't on our hat list yet, so it's priced like a 112. We'll confirm.");
    const nq = hatNextTier(out.billedQty);
    if (nq) {
      const cur = out.tiers.find((t) => t.tier === line.tier) ?? out.tiers[0];
      const ns = (line.method === "patch" ? hatTiers(line.hatStyle, nq, { locations: locs }) : [hatPrice(line.hatStyle, nq, { locations: locs, puff, stitchAdd })])
        .find((t) => t && t.tier === cur.tier) ?? null;
      if (ns && ns.unit_price < cur.unit_price) out.nextBreak = { qty: nq, unit: ns.unit_price };
    }
    return out;
  }

  const svc = service(line.method);
  const opts = {
    colors: line.colors,
    locations: locs,
    jacket: line.item === "jacket" || line.item === "vest",
    screenColors: line.method === "screen_print" ? screenColorsFor(line) : undefined,
    dtfCols: line.method === "dtf" ? line.placements.map((pl) => dtfColFor(line, pl)) : undefined,
  };
  out.tiers = await suggestTiers(db, categoryFor(line), svc, qty, opts);
  if (line.style.trim()) {
    out.requested = await priceRequested(db, line, svc, qty, opts);
    out.requestedMissing = !out.requested;
  }
  out.fees = apparelFees(line, qty);

  if (line.method === "screen_print") {
    // Minimum = 24 + 12 per extra color, counting every color on every location
    // (1-color front + 3-color back = 4 colors = 60). Below that but at or above the
    // busiest single location's minimum, a manager can approve it (Phil 2026-10-09).
    const cs = screenColorsFor(line);
    const total = cs.reduce((a, c) => a + c, 0);
    const min = screenPrintMin(total);
    const hardMin = screenPrintMin(Math.max(...cs));
    if (qty < hardMin) {
      out.blocker = `Screen print starts at ${hardMin} pieces for ${Math.max(...cs)} color${Math.max(...cs) > 1 ? "s" : ""}.`;
      out.suggestDtf = true;
    } else if (qty < min) {
      out.approval = `Below the ${min}-piece minimum for ${total} total colors. Needs a manager's OK.`;
      out.suggestDtf = true;
    }
    out.notes.push(`${screenSummary(line)} print. We'll lock it in once we see the art.`);
    if (qty < SCREEN_FEE_WAIVE_QTY) out.notes.push(`Screen setup is waived at ${SCREEN_FEE_WAIVE_QTY}+ pieces.`);
  } else {
    if (qty < SMALL_MIN) out.blocker = `${METHOD_LABELS[line.method]} starts at ${SMALL_MIN} pieces.`;
    if (line.method === "embroidery") out.notes.push(line.item === "jacket" || line.item === "vest" ? `${line.item === "vest" ? "Vest" : "Jacket"} embroidery up to 10,000 stitches (most logos). We confirm after digitizing.` : "Embroidery up to 10,000 stitches (most logos). We confirm after digitizing.");
    const carhartt = line.usePick && out.requested ? /^CT/.test(out.requested.style) : line.tier === "best";
    if ((line.item === "jacket" || line.item === "vest") && carhartt) out.notes.push("Carhartt is priced at Carhartt's retail price plus decoration.");
    if (line.method === "dtf") out.notes.push(`Full-color print: ${dtfSummary(line)}. No screen fees.`);
  }

  const nq = matrixNextTier(svc, qty);
  if (nq) {
    const pick = !!(out.requested && line.usePick);
    const cur = pick ? out.requested : out.tiers.find((t) => t.tier === line.tier);
    const nxt = pick
      ? await priceRequested(db, line, svc, nq, opts)
      : (await suggestTiers(db, categoryFor(line), svc, nq, opts)).find((t) => t.tier === line.tier);
    if (cur && nxt && nxt.unit_price < cur.unit_price) out.nextBreak = { qty: nq, unit: nxt.unit_price };
  }
  return out;
}

export function chosen(line: CounterLine, p: Priced | undefined): Suggestion | undefined {
  if (!p) return undefined;
  if (line.item === "hat") return p.tiers.length > 1 ? (p.tiers.find((t) => t.tier === line.tier) ?? p.tiers[0]) : p.tiers[0];
  if (line.usePick && p.requested) return p.requested;
  return p.tiers.find((t) => t.tier === line.tier);
}

export function lineTotal(line: CounterLine, p: Priced | undefined): number {
  const s = chosen(line, p);
  if (!s || !p || p.blocker) return 0;
  return s.unit_price * p.billedQty + p.fees.reduce((a, f) => a + f.amount, 0);
}

export function describeLine(line: CounterLine, s?: Suggestion): string {
  const what = line.item === "hat" ? (s?.name ?? `Hat ${line.hatStyle}`) : (s?.name ?? itemLabel(line));
  const deco =
    line.method === "screen_print" ? (line.placements.length > 1 ? `screen print (${screenSummary(line)})` : `${screenSummary(line)} screen print`) :
    line.method === "dtf" ? "DTF" :
    line.method === "hat_embroidery" && line.puff ? "3D puff embroidery" :
    METHOD_LABELS[line.method];
  const where = line.method === "dtf" ? dtfSummary(line) : line.placements.join(" + ");
  return `${what} — ${deco}, ${where || "location TBD"}`;
}

export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// ── Save ───────────────────────────────────────────────────────────────

export interface CounterContact { name: string; phone: string; email: string; company: string }
// ── Rush (Phil 2026-10-28): 2–3 days = +100%, under 7 days = +50% ──
// Charged on the products (garments + decoration), not on one-time fees like digitizing or screens.
export type Rush = 0 | 50 | 100;
export const RUSH_OPTIONS: { pct: Rush; label: string; hint: string }[] = [
  { pct: 0, label: "Standard", hint: "no rush" },
  { pct: 50, label: "Under 7 days", hint: "+50%" },
  { pct: 100, label: "2–3 days", hint: "+100%" },
];
/** Calendar days from today to a yyyy-mm-dd due date (local time). */
export function daysUntil(due: string, today = new Date()): number {
  const [y, m, d] = due.split("-").map(Number);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((new Date(y, m - 1, d).getTime() - t0) / 86400000);
}
/** Rush level a due date calls for: 3 days or less = 100%, under 7 days = 50%. */
export function rushForDate(due: string, today = new Date()): Rush {
  if (!due) return 0;
  const n = daysUntil(due, today);
  return n <= 3 ? 100 : n < 7 ? 50 : 0;
}
/** Product subtotal the rush applies to (unit price × billed qty; one-time fees excluded). */
export function rushBase(lines: CounterLine[], priced: Record<string, Priced | undefined>): number {
  return lines.reduce((a, l) => {
    const p = priced[l.id];
    const s = chosen(l, p);
    return !s || !p || p.blocker || l.qty <= 0 ? a : a + s.unit_price * p.billedQty;
  }, 0);
}
export const rushAmount = (base: number, rush: Rush) => Number(((base * rush) / 100).toFixed(2));
export const rushLabel = (rush: Rush) =>
  rush === 100 ? "Rush charge (2–3 days, +100%)" : rush === 50 ? "Rush charge (under 7 days, +50%)" : "";

export interface CounterExtras {
  dueDate: string;            // yyyy-mm-dd or ""
  rush: Rush;                 // rush charge %, set at the counter (suggested from the due date)
  notes: string;
  needsArtHelp: boolean;
  shipping: boolean;
  nonprofit: boolean;
  ownGarments: boolean;       // customer-supplied — never priced at the counter
}

/** Look up a returning customer by phone or email. */
export async function findCustomer(db: any, phone: string, email: string) {
  const e = email.trim().toLowerCase();
  const p = phone.trim();
  if (e) {
    const { data } = await db.from("customers").select("id, name, email, phone, company").ilike("email", e).limit(1).maybeSingle();
    if (data) return data;
  }
  if (p.replace(/\D/g, "").length >= 7) {
    const { data } = await db.from("customers").select("id, name, email, phone, company").eq("phone", p).limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function upsertCustomer(db: any, c: CounterContact): Promise<string | null> {
  const found = await findCustomer(db, c.phone, c.email);
  if (found) return found.id;
  const { data, error } = await db
    .from("customers")
    .insert({ name: c.name.trim(), email: c.email.trim().toLowerCase() || null, phone: c.phone.trim() || null, company: c.company.trim() || null, source: "counter" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const SERVICE_TYPE: Record<Method, string> = {
  screen_print: "screen_print", dtf: "dtf", embroidery: "embroidery", patch: "leather_patch", hat_embroidery: "embroidery",
};

function tomorrowNine(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export async function saveCounterQuote(
  db: any,
  userId: string,
  contact: CounterContact,
  extras: CounterExtras,
  lines: CounterLine[],
  priced: Record<string, Priced | undefined>,
): Promise<{ quoteId: string; quoteNumber: string | null; actionItemId: string | null }> {
  const customerId = await upsertCustomer(db, contact);

  const considerations = [
    extras.ownGarments && "Customer wants to bring their own garments. Needs management approval before quoting.",
    (extras.rush ?? 0) > 0 && `RUSH: ${rushLabel(extras.rush)}${extras.dueDate ? `, due ${extras.dueDate}` : ""}. Confirm the schedule before taking it.`,
    extras.needsArtHelp && "Needs help with artwork.",
    extras.shipping && "Wants it shipped.",
    extras.nonprofit && "Nonprofit / tax exempt. Get the certificate.",
    extras.notes.trim() && extras.notes.trim(),
  ].filter(Boolean) as string[];

  const usable = lines.filter((l) => l.qty > 0);
  const rush = extras.ownGarments ? 0 : rushAmount(rushBase(usable, priced), extras.rush ?? 0);
  const grand = extras.ownGarments ? 0 : usable.reduce((a, l) => a + lineTotal(l, priced[l.id]), 0) + rush;

  const { data: quote, error: qErr } = await db
    .from("quotes")
    .insert({
      customer_name: contact.name.trim(),
      customer_email: contact.email.trim().toLowerCase() || null,
      customer_phone: contact.phone.trim() || null,
      customer_id: customerId,
      company: contact.company.trim() || null,
      state: "ID",
      delivery_method: extras.shipping ? "ship" : "pickup",
      requested_date: extras.dueDate || null,
      notes: ["Walk-in (counter quote).", ...considerations].join("\n"),
      is_nonprofit: extras.nonprofit,
      apply_sales_tax: !extras.nonprofit,
      tax_rate: 6.0,
      status: "draft",
      total_price: Number(grand.toFixed(2)),
      created_by: userId,
    })
    .select("id, quote_number")
    .single();
  if (qErr) throw qErr;

  // Line items: one per product line, then one per one-time fee.
  const rows: any[] = [];
  for (const l of usable) {
    const p = priced[l.id];
    const s = chosen(l, p);
    const qty = p?.billedQty ?? l.qty;
    const priceIt = !!s && !p?.blocker && !extras.ownGarments;
    rows.push({
      quote_id: quote.id,
      service_type: SERVICE_TYPE[l.method],
      description: describeLine(l, s),
      style_number: l.item === "hat" ? l.hatStyle.toUpperCase() : s?.style ?? null,
      color: l.color.trim() || null,
      placement: l.placements.join(", ") || null,
      quantity: qty,
      sizes: {},
      garment_cost: priceIt ? s!.garment_cost : 0,
      garment_markup_pct: priceIt ? s!.markup_pct : 0,
      decoration_cost: priceIt ? s!.decoration_cost : 0,
      decoration_params: {
        source: "counter",
        method: l.method,
        placements: l.placements,
        ...(l.method === "screen_print" ? { colors: screenColorsFor(l).reduce((a, c) => a + c, 0), colorsByLocation: Object.fromEntries(l.placements.map((pl, i) => [pl, screenColorsFor(l)[i]])) } : {}),
        ...(l.method === "dtf" ? { dtfSizes: Object.fromEntries(l.placements.map((pl) => [pl, DTF_SIZES[dtfColFor(l, pl)]])) } : {}),
        ...(l.item === "hat" ? { hatStyle: l.hatStyle, ...(l.method === "hat_embroidery" ? { stitches: HAT_STITCH_TIERS[l.stitchTier ?? 0]?.label ?? "over 16k", ...(l.puff ? { puff: true } : {}) } : {}), ...(l.method === "patch" ? { tier: l.tier } : {}) } : l.usePick && p?.requested ? { customerPick: l.style.trim().toUpperCase() } : { tier: l.tier }),
      },
      line_total: priceIt ? Number((s!.unit_price * qty).toFixed(2)) : 0,
      notes: [...(p?.notes ?? []), p?.blocker ?? "", p?.approval ? `MANAGER APPROVAL: ${p.approval}` : "",
        p?.requestedMissing ? `Customer asked for ${l.style.trim().toUpperCase()} — not in catalog, priced as house ${l.tier}. Confirm.` : "", priceIt && s!.upcharge_2xl > 0 ? `2XL+ add ${money(s!.upcharge_2xl)} each` : ""].filter(Boolean).join(" ") || null,
    });
    if (priceIt) for (const f of p!.fees) {
      rows.push({
        quote_id: quote.id, service_type: "other", description: f.label, quantity: 1, sizes: {},
        garment_cost: 0, garment_markup_pct: 0, decoration_cost: f.amount, line_total: f.amount, notes: null,
      });
    }
  }
  if (rush > 0) {
    rows.push({
      quote_id: quote.id, service_type: "other", description: rushLabel(extras.rush), quantity: 1, sizes: {},
      garment_cost: 0, garment_markup_pct: 0, decoration_cost: rush, line_total: rush, notes: null,
    });
  }
  if (rows.length) {
    const { error } = await db.from("quote_line_items").insert(rows.map((r, i) => ({ ...r, sort_order: i })));
    if (error) throw error;
  }

  // One action item — the replacement for the sticky note.
  const summary = usable.map((l) => `${l.qty} ${itemLabel(l).toLowerCase()}`).join(" + ") || "items TBD";
  const priceLines = usable.map((l) => {
    const p = priced[l.id];
    const s = chosen(l, p);
    if (extras.ownGarments) return `• ${describeLine(l, s)}: not priced (customer-supplied garments)`;
    if (!s || p?.blocker) return `• ${describeLine(l, s)}: ${p?.blocker ?? "not priced"}`;
    return `• ${p!.billedQty} × ${describeLine(l, s)} @ ${money(s.unit_price)}${s.upcharge_2xl > 0 ? ` (2XL+ +${money(s.upcharge_2xl)})` : ""}`;
  });
  const checklist = [
    "Get artwork / logo file",
    "Get size breakdown",
    "Confirm garment colors",
    ...(extras.ownGarments ? ["Management approval for customer-supplied garments", "Signed waiver + extra test piece (new, unworn items only)"] : []),
    ...(extras.nonprofit ? ["Get tax-exempt certificate"] : []),
    ...usable.filter((l) => priced[l.id]?.requestedMissing).map((l) => `Look up ${l.style.trim().toUpperCase()} and confirm price`),
    "Send to Printavo",
  ].map((text) => ({ id: crypto.randomUUID(), text, done: false }));

  const { data: ai, error: aiErr } = await db
    .from("action_items")
    .insert({
      title: `Counter Quote: ${contact.name.trim()} — ${summary}`,
      description: [
        `Walk-in quote ${quote.quote_number || ""} — quoted at the counter${extras.dueDate ? `, needed by ${extras.dueDate}` : ""}.`,
        ...priceLines,
        rush > 0 ? `• ${rushLabel(extras.rush)}: ${money(rush)}` : "",
        !extras.ownGarments && grand > 0 ? `Estimated total: ${money(grand)} + tax` : "",
        ...considerations.map((c) => `⚠️ ${c}`),
      ].filter(Boolean).join("\n"),
      customer_name: contact.name.trim(),
      customer_email: contact.email.trim().toLowerCase() || null,
      customer_phone: contact.phone.trim() || null,
      customer_id: customerId,
      quote_id: quote.id,
      source: "counter",
      priority: "high",
      status: "open",
      checklist,
      due_date: tomorrowNine(),
      created_by: userId,
    })
    .select("id")
    .single();
  if (aiErr) console.error("counter action item failed", aiErr);

  return { quoteId: quote.id, quoteNumber: quote.quote_number ?? null, actionItemId: ai?.id ?? null };
}

/** Quick note — when there's no time for a full quote. Still lands in Action Items, not on a sticky note. */
export async function saveQuickNote(db: any, userId: string, contact: CounterContact, what: string) {
  const { error } = await db.from("action_items").insert({
    title: `Counter Note: ${contact.name.trim() || "Walk-in"} — ${what.trim().slice(0, 80) || "follow up"}`,
    description: what.trim() || null,
    customer_name: contact.name.trim() || null,
    customer_email: contact.email.trim().toLowerCase() || null,
    customer_phone: contact.phone.trim() || null,
    source: "counter",
    priority: "high",
    status: "open",
    checklist: [{ id: crypto.randomUUID(), text: "Call back with a price", done: false }],
    due_date: tomorrowNine(),
    created_by: userId,
  });
  if (error) throw error;
}

export async function pushToPrintavo(db: any, quoteId: string, actionItemId: string | null) {
  const { data, error } = await db.functions.invoke("push-to-printavo", { body: { quoteId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (actionItemId) {
    const { data: ai } = await db.from("action_items").select("checklist").eq("id", actionItemId).single();
    const list = Array.isArray(ai?.checklist) ? ai.checklist : [];
    await db.from("action_items").update({
      checklist: list.map((c: any) => (c.text === "Send to Printavo" ? { ...c, done: true } : c)),
    }).eq("id", actionItemId);
  }
  return data as { printavoVisualId?: string };
}
