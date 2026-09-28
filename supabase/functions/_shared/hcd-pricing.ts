import { richardsonCost } from "./richardson-2026.ts";
// HCD Good / Better / Best pricing — used by email intake to suggest a first price.
//
// Formula matches Printavo exactly:  (garment cost × markup%) + decoration price
//   e.g. markup 200 → garment cost × 2.00   (NOT cost × 3)
//
// Decoration matrices are copied from Phil's Printavo "Pricing Matrix Export" CSVs (2026-09-28).
// If Phil changes a matrix in Printavo, update the numbers here (or re-export and paste).
// Garment costs: product_catalog (SanMar import) first, then the fallback list below
// (SanMar SDL standard piece price, size L, colored garment, 2026-09-28).
// Order: SanMar (product_catalog → fallback list) first, then the Richardson 2026 wholesale list.
// Phil quotes from SanMar list price on purpose — his volume discount is margin cushion.
//
// Suggestions only. Nothing here is sent to customers; Phil reviews every quote.

type Row = { qty: number; prices: number[]; markup: number };
type Matrix = { columns: string[]; rows: Row[] };

export const MATRICES: Record<string, Matrix> = {
  screen_print: {
    columns: ["1 color", "2 color", "3 color", "4 color", "5 color", "6 color", "7 color", "8 color", "9 color"],
    rows: [
      { qty: 12, prices: [3.57, 4.56, 5.56, 6.56, 7.55, 8.55, 9.55, 10.54, 11.54], markup: 200 },
      { qty: 24, prices: [2.48, 3.68, 4.87, 6.07, 7.26, 8.46, 9.66, 10.85, 12.06], markup: 200 },
      { qty: 72, prices: [1.62, 2.82, 4.02, 5.21, 6.41, 7.6, 8.8, 9.99, 11.19], markup: 175 },
      { qty: 144, prices: [1.3, 1.5, 1.9, 2.3, 2.7, 3.1, 3.5, 3.9, 4.3], markup: 160 },
      { qty: 240, prices: [1.2, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8, 4.2], markup: 150 },
      { qty: 360, prices: [1.0, 1.3, 1.7, 2.1, 2.5, 2.9, 3.3, 3.7, 4.1], markup: 150 },
      { qty: 500, prices: [0.9, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2, 3.6, 4.0], markup: 150 },
      { qty: 1200, prices: [0.8, 1.1, 1.5, 1.9, 2.3, 2.7, 3.1, 3.5, 3.9], markup: 150 },
      { qty: 2500, prices: [0.6, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8], markup: 150 },
      { qty: 5000, prices: [0.5, 0.9, 1.3, 1.7, 2.1, 2.5, 2.9, 3.3, 3.7], markup: 150 },
    ],
  },
  dtf: {
    columns: ["4 x 4", "11 x 5", "11 x 14"],
    rows: [
      { qty: 1, prices: [1.5, 3.0, 4.75], markup: 200 },
      { qty: 15, prices: [1.2, 3.0, 4.75], markup: 200 },
      { qty: 50, prices: [1.1, 2.75, 4.75], markup: 175 },
      { qty: 100, prices: [1.0, 2.0, 4.0], markup: 160 },
      { qty: 250, prices: [1.0, 1.5, 4.0], markup: 140 },
    ],
  },
  embroidery: {
    columns: ["0-5000", "6001-7000", "7001-8000", "8001-9000", "9001-10000", "10000+", "40K-50K", "60K-80K"],
    rows: [
      { qty: 1, prices: [12, 15, 15, 15, 15, 18, 50, 70], markup: 200 },
      { qty: 25, prices: [12, 15, 15, 15, 15, 15, 50, 70], markup: 190 },
      { qty: 50, prices: [12, 15, 15, 15, 15, 15, 50, 70], markup: 190 },
      { qty: 100, prices: [12, 15, 14, 14, 14, 14, 50, 70], markup: 180 },
      { qty: 250, prices: [12, 12, 14, 14, 14, 14, 50, 70], markup: 150 },
    ],
  },
  leather_patch: {
    columns: ["Patch"],
    rows: [
      { qty: 1, prices: [10], markup: 200 },
      { qty: 25, prices: [8], markup: 200 },
      { qty: 50, prices: [7], markup: 200 },
      { qty: 100, prices: [6], markup: 150 },
      { qty: 250, prices: [5], markup: 150 },
    ],
  },
};

export type Tier = "good" | "better" | "best";
type Pick = { style: string; name: string; cost: number; cost2xl: number; msrp: number; map?: number };

// Phil's Good / Better / Best picks. Costs = fallback only.
export const PICKS: Record<string, Record<Tier, Pick>> = {
  tee: {
    good: { style: "5000", name: "Gildan 5000 Heavy Cotton", cost: 4.11, cost2xl: 6.01, msrp: 6.22 },
    better: { style: "64000", name: "Gildan Softstyle 64000", cost: 4.58, cost2xl: 6.18, msrp: 7.16 },
    best: { style: "NL6210", name: "Next Level 6210 CVC", cost: 5.19, cost2xl: 6.76, msrp: 8.38 },
  },
  hoodie: {
    good: { style: "PC78H", name: "Port & Co PC78H Core Fleece", cost: 14.63, cost2xl: 17.57, msrp: 25.26 },
    better: { style: "PC90H", name: "Port & Co PC90H Essential Fleece", cost: 18.5, cost2xl: 21.97, msrp: 29.0 },
    // Carhartt has a $55 MAP; 2x markup would be ~$80. Priced at MAP + decoration. Phil to confirm.
    best: { style: "CTK121", name: "Carhartt K121 Midweight", cost: 39.75, cost2xl: 39.75, msrp: 55, map: 55 },
  },
  polo: {
    good: { style: "ST550", name: "Sport-Tek ST550 Competitor", cost: 9.26, cost2xl: 10.26, msrp: 14.52 },
    better: { style: "K500", name: "Port Authority K500 Silk Touch", cost: 12.04, cost2xl: 13.04, msrp: 20.08 },
    best: { style: "ST650", name: "Sport-Tek ST650 Micropique", cost: 14.48, cost2xl: 15.48, msrp: 25.96 },
  },
  hat: {
    good: { style: "C402", name: "Port Authority C402 Snapback Trucker", cost: 4.58, cost2xl: 4.58, msrp: 7.16 },
    better: { style: "112", name: "Richardson 112 Trucker", cost: 8.75, cost2xl: 8.75, msrp: 13.5 },
    best: { style: "168", name: "Richardson 168 7-Panel", cost: 9.5, cost2xl: 9.5, msrp: 15 },
  },
};

export function categoryOf(item: string | null | undefined): string | null {
  const s = String(item || "").toLowerCase();
  if (/hat|cap|beanie/.test(s)) return "hat";
  if (/hood|sweat|crew/.test(s)) return "hoodie";
  if (/polo/.test(s)) return "polo";
  if (/tee|t-shirt|shirt/.test(s)) return "tee";
  return null;
}

export function matrixRow(service: string, qty: number): Row | null {
  const m = MATRICES[service];
  if (!m) return null;
  let row: Row | null = null;
  for (const r of m.rows) if (qty >= r.qty) row = r;
  return row ?? m.rows[0];
}

export type Suggestion = {
  tier: Tier;
  style: string;
  name: string;
  garment_cost: number;
  markup_pct: number;
  decoration_cost: number;
  unit_price: number;
  total: number;
  upcharge_2xl: number;
};

/** Decoration column index. Defaults: 1-color screen print, 11x5 DTF, <5k stitches. */
function decoColumn(service: string, colors: number | null): number {
  if (service === "screen_print") return Math.min(Math.max((colors || 1) - 1, 0), 8);
  if (service === "dtf") return 1;
  return 0;
}

export async function garmentCost(db: any, pick: Pick, qty = 12): Promise<number> {
  try {
    const { data } = await db
      .from("product_catalog")
      .select("piece_price, size_range")
      .eq("style_number", pick.style.toUpperCase())
      .gt("piece_price", 0)
      .limit(50);
    const rows = (data || []).filter((r: any) => !/2XL|3XL|4XL|5XL|XXL/i.test(String(r.size_range || "")));
    if (rows.length) {
      const prices = rows.map((r: any) => Number(r.piece_price)).sort((a: number, b: number) => a - b);
      return prices[Math.floor(prices.length / 2)];
    }
  } catch (_) { /* fall back */ }
  if (pick.cost > 0) return pick.cost; // SanMar list (fallback table)
  return richardsonCost(pick.style, qty) ?? 0; // then Richardson wholesale
}

export async function suggestTiers(
  db: any,
  category: string,
  service: string,
  qty: number,
  opts: { colors?: number | null; locations?: number } = {},
): Promise<Suggestion[]> {
  const picks = PICKS[category];
  const row = matrixRow(service, qty);
  if (!picks || !row || qty <= 0) return [];
  const col = decoColumn(service, opts.colors ?? null);
  const firstLoc = row.prices[col] ?? row.prices[0];
  // Extra locations on screen print/DTF are priced at 1-color / 4x4.
  const extraLocs = Math.max((opts.locations || 1) - 1, 0);
  const extra = service === "screen_print" ? row.prices[0] : service === "dtf" ? row.prices[0] : 0;
  const deco = Number((firstLoc + extraLocs * extra).toFixed(2));
  const out: Suggestion[] = [];
  for (const tier of ["good", "better", "best"] as Tier[]) {
    const p = picks[tier];
    const cost = await garmentCost(db, p, qty);
    const garmentSell = p.map ? p.map : cost * (row.markup / 100);
    const unit = Number((garmentSell + deco).toFixed(2));
    out.push({
      tier,
      style: p.style,
      name: p.name,
      garment_cost: cost,
      markup_pct: p.map ? Number(((p.map / cost) * 100).toFixed(1)) : row.markup,
      decoration_cost: deco,
      unit_price: unit,
      total: Number((unit * qty).toFixed(2)),
      upcharge_2xl: p.map ? 0 : Number(((p.cost2xl - p.cost) * (row.markup / 100)).toFixed(2)),
    });
  }
  return out;
}

export function assumptionsFor(service: string, colors: number | null): string {
  if (service === "screen_print") return `${colors || 1}-color print${colors ? "" : " (assumed — confirm after art)"}`;
  if (service === "embroidery") return "under 5,000 stitches (assumed — confirm after digitizing)";
  if (service === "dtf") return "11x5 transfer";
  if (service === "leather_patch") return "sewn leather patch";
  return "";
}

/** Pull a style number out of what the customer wrote, e.g. "Richardson 112PT hats" → "112PT". */
export function styleFromText(text: string | null | undefined): string | null {
  const m = String(text || "").toUpperCase().match(/\b([A-Z]{0,4}\d{2,6}[A-Z]{0,4})\b/g);
  const ALIAS: Record<string, string> = { "6210": "NL6210", "3600": "NL3600", "3001": "BC3001", "K121": "CTK121" };
  const hit = m ? m.find((s) => !/^\d{4}$/.test(s) || ["5000", "8000", "2000", "1717", "3001", "6210", "3600"].includes(s)) ?? null : null;
  return hit ? (ALIAS[hit] ?? hit) : null;
}

/** Price the exact style the customer asked for (if we can find its cost). */
export async function suggestRequested(
  db: any, style: string, service: string, qty: number, opts: { colors?: number | null; locations?: number } = {},
): Promise<Suggestion | null> {
  const row = matrixRow(service, qty);
  if (!row || qty <= 0) return null;
  const known = Object.values(PICKS).flatMap((t) => Object.values(t)).find((p) => p.style === style.toUpperCase());
  const cost = await garmentCost(db, known ?? { style, name: style, cost: 0, cost2xl: 0, msrp: 0 }, qty);
  if (!cost) return null;
  const col = decoColumn(service, opts.colors ?? null);
  const extraLocs = Math.max((opts.locations || 1) - 1, 0);
  const deco = Number(((row.prices[col] ?? row.prices[0]) + extraLocs * (service === "screen_print" || service === "dtf" ? row.prices[0] : 0)).toFixed(2));
  const garmentSell = known?.map ? known.map : cost * (row.markup / 100);
  const unit = Number((garmentSell + deco).toFixed(2));
  return {
    tier: "better", style: style.toUpperCase(), name: known?.name ?? style.toUpperCase(), garment_cost: cost,
    markup_pct: known?.map ? Number(((known.map / cost) * 100).toFixed(1)) : row.markup,
    decoration_cost: deco, unit_price: unit, total: Number((unit * qty).toFixed(2)), upcharge_2xl: 0,
  };
}

// ── Hats: Phil's flat price list (same as the website hat form) ─────────────
// Price per hat on a Richardson 112, patch OR embroidery, includes real leather,
// sewing, and shipping. Embroidery adds a one-time $45 digitizing fee under 50 hats.
export const HAT_PRICE_TIERS = [
  { min: 100, price: 19 },
  { min: 72, price: 21 },
  { min: 48, price: 23 },
  { min: 24, price: 26 },
  { min: 12, price: 27 },
];
// Upcharge vs the 112 (from the website form + Phil's quotes). All numbers match the website (Phil confirmed).
export const HAT_UPCHARGES: Record<string, { name: string; add: number }> = {
  "112": { name: "Richardson 112 Trucker", add: 0 },
  "115": { name: "Richardson 115 Low Pro Trucker", add: 0 },
  "112FP": { name: "Richardson 112FP Five Panel", add: 0 },
  "112PFP": { name: "Richardson 112PFP Printed Five Panel", add: 1.5 },
  "110": { name: "Richardson 110 R-Flex", add: 1.25 },
  "6606": { name: "YP Classics 6606 Retro Trucker", add: 1.05 },
  "OFA": { name: "Legacy OFA", add: 2 },
  "112PT": { name: "Richardson 112PT Printed Tactical", add: 2 },
  "112PL": { name: "Richardson 112+ R-Flex", add: 2 },
};
export const HAT_MIN = 12;

// Embroidered hats: same price as a patch up to 8,000 stitches, one location.
// 2nd and 3rd locations (embroidered) +$8 each. Side flag +$5 (upsell).
export const HAT_EXTRA_LOCATION = 8;
export const HAT_SIDE_FLAG = 5;
export const HAT_STITCH_LIMIT = 8000;

export function hatPrice(style: string | null, qty: number, opts: { locations?: number } = {}): Suggestion | null {
  if (qty <= 0) return null;
  const q = Math.max(qty, HAT_MIN);
  const tier = HAT_PRICE_TIERS.find((t) => q >= t.min)!;
  const key = (style || "112").toUpperCase();
  const known = HAT_UPCHARGES[key];
  const extraLocs = Math.min(Math.max((opts.locations || 1) - 1, 0), 2);
  const unit = Number((tier.price + (known?.add ?? 0) + extraLocs * HAT_EXTRA_LOCATION).toFixed(2));
  return {
    tier: "better", style: key, name: known?.name ?? `${key} (not on hat list — priced as a 112, check it)`,
    garment_cost: 0, markup_pct: 0, decoration_cost: unit, unit_price: unit,
    total: Number((unit * q).toFixed(2)), upcharge_2xl: 0,
  };
}

/** Next price break above qty for hats (null at the top tier). */
export function hatNextTier(qty: number): number | null {
  const q = Math.max(qty, HAT_MIN);
  const ups = HAT_PRICE_TIERS.map((t) => t.min).filter((m) => m > q).sort((a, b) => a - b);
  return ups[0] ?? null;
}

/** Next price break above qty in a decoration matrix (null at the top). */
export function matrixNextTier(service: string, qty: number): number | null {
  const m = MATRICES[service];
  if (!m) return null;
  const up = m.rows.map((r) => r.qty).filter((x) => x > qty).sort((a, b) => a - b);
  return up[0] ?? null;
}
