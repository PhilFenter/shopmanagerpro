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

// DTF pressing charge per print: $80/hr shop rate ÷ ~50 presses/hr (Phil 2026-10-15).
export const DTF_SHOP_RATE = 80;
export const DTF_PRESSES_PER_HOUR = 50;
export const DTF_PRESS = Number((DTF_SHOP_RATE / DTF_PRESSES_PER_HOUR).toFixed(2)); // 1.60
/** Supacolor transfer prices → HCD sell prices (transfer + pressing). */
const dtfRow = (supacolor: number[]) => supacolor.map((c) => Number((c + DTF_PRESS).toFixed(2)));

export const MATRICES: Record<string, Matrix> = {
  // New 2027 tables (Phil approved 2026-09-28): breaks 12/24/48/72/144/288/500, 700+ custom.
  // Upload the matching -NEW.csv files to Printavo so quotes and invoices agree.
  screen_print: {
    columns: ["1 color", "2 color", "3 color", "4 color", "5 color", "6 color", "7 color", "8 color", "9 color"],
    rows: [
      { qty: 24, prices: [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5], markup: 190 },
      { qty: 48, prices: [2, 2.95, 3.9, 4.85, 5.8, 6.75, 7.7, 8.65, 9.6], markup: 180 },
      { qty: 72, prices: [1.65, 2.55, 3.45, 4.35, 5.25, 6.15, 7.05, 7.95, 8.85], markup: 170 },
      { qty: 144, prices: [1.3, 2.05, 2.8, 3.55, 4.3, 5.05, 5.8, 6.55, 7.3], markup: 160 },
      { qty: 288, prices: [1.15, 1.75, 2.35, 2.95, 3.55, 4.15, 4.75, 5.35, 5.95], markup: 150 },
      { qty: 500, prices: [0.95, 1.45, 1.95, 2.45, 2.95, 3.45, 3.95, 4.45, 4.95], markup: 150 },
    ],
  },
  // DTF = replacement cost + pressing (Phil 2026-10-15).
  //   Transfer: Supacolor SupaDTF volume price (1–9 / 10–49 / 50–99 / 100+ → HCD 6 / 12–48 / 72 / 144+),
  //   checked against Phil's Supacolor screenshots 2026-10-15. If the Hydra is down, HCD buys
  //   the transfer and is still whole; printed in-house, the difference is margin.
  //   Pressing: DTF_PRESS per print = $80/hr shop rate at ~50 presses/hr. Charged on EVERY print —
  //   going from left chest to back means re-threading the shirt on the pallet, a full cycle.
  //   12 x 22 added for 12"-wide and full-length prints (fits up to the 18" print area).
  dtf: {
    columns: ["4 x 4", "11 x 5", "11 x 14", "12 x 22"],
    rows: [
      { qty: 6, prices: dtfRow([3.04, 6.59, 11.79, 15.77]), markup: 200 },
      { qty: 12, prices: dtfRow([2.01, 4.33, 7.62, 12.78]), markup: 200 },
      { qty: 24, prices: dtfRow([2.01, 4.33, 7.62, 12.78]), markup: 190 },
      { qty: 48, prices: dtfRow([2.01, 4.33, 7.62, 12.78]), markup: 180 },
      { qty: 72, prices: dtfRow([1.7, 3.66, 6.49, 11.14]), markup: 170 },
      { qty: 144, prices: dtfRow([1.39, 2.99, 5.3, 9.52]), markup: 160 },
      { qty: 288, prices: dtfRow([1.39, 2.99, 5.3, 9.52]), markup: 150 },
      { qty: 500, prices: dtfRow([1.39, 2.99, 5.3, 9.52]), markup: 150 },
    ],
  },
  // Phil (2026-09-28): embroidery is mostly small batches, so keep it simple —
  // $15 shirts / $20 jackets up to 10,000 stitches, +$1.50 per 1,000 over that.
  // Same price at any quantity (a 700-jacket job was quoted by hand at $12). 21k+ = custom.
  embroidery: {
    columns: ["Shirts up to 10,000", "Jackets up to 10,000", "Shirts 10,001-12,000", "Jackets 10,001-12,000",
      "Shirts 12,001-15,000", "Jackets 12,001-15,000", "Shirts 15,001-21,000", "Jackets 15,001-21,000"],
    rows: [
      { qty: 12, prices: [15, 20, 18, 23, 22.5, 27.5, 31.5, 36.5], markup: 200 },
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

// Sleeve / extra embroidery spot on apparel (no back embroidery offered).
export const EMB_EXTRA_LOCATION = 8;

// Minimums and fees (Phil, 2026-09-28)
// Screen print: 24 minimum for 1 color, +12 shirts per extra color (2c 36, 3c 48 ...).
// $20 screen fee per color per location, waived at SCREEN_FEE_WAIVE_QTY+ (CTS + auto reclaim, screens aren't kept).
export const SCREEN_MIN_BASE = 24;
export const SCREEN_MIN_PER_COLOR = 12;
export const SCREEN_FEE = 20;
export const SCREEN_FEE_WAIVE_QTY = 144;
// DTF / embroidery: 6-piece minimum, $30 small order fee under 12.
export const SMALL_MIN = 6;
export const SMALL_ORDER_UNDER = 12;
export const SMALL_ORDER_FEE = 30;
// Embroidery digitizing (Phil, 2026-10-07): same rule for hats and apparel —
// $45 one-time to set up the logo, waived at 50+ pieces.
export const DIGITIZING_FEE = 45;
export const DIGITIZING_WAIVE_QTY = 50;

// DTF size by placement (Phil, 2026-10-07):
//   left chest / pocket / sleeve / nape → 4x4
//   back → 11x14. Quote the larger size on purpose: if the art is smaller the customer
//         gets a lower final price; quoting small and raising it later is a worse conversation.
//   anything else (front, full front, unknown) → 11x5
export const DTF_COLS = { small: 0, standard: 1, large: 2, xl: 3 } as const; // xl (12x22) is counter-screen only
export function dtfColForPlacement(placement: string): number {
  const s = String(placement || "").toLowerCase();
  if (/\bback\b/.test(s) && !/back of (the )?(cap|hat)|\bneck\b|\bnape\b|\byoke\b/.test(s)) return DTF_COLS.large;
  if (/chest|pocket|sleeve|\bnape\b|\bneck\b|\byoke\b|4 ?x ?4/.test(s)) return DTF_COLS.small;
  return DTF_COLS.standard;
}
const DTF_SIZE_NAMES = ["4x4", "11x5", "11x14", "12x22"];

export function screenPrintMin(colors: number | null | undefined): number {
  return SCREEN_MIN_BASE + SCREEN_MIN_PER_COLOR * (Math.max(colors || 1, 1) - 1);
}
/** Screen fees for the job: front colors + 1 screen per extra location (1-color assumed). */
export function screenFees(colors: number | null | undefined, locations: number, qty: number): number {
  if (qty >= SCREEN_FEE_WAIVE_QTY) return 0;
  const screens = Math.max(colors || 1, 1) + Math.max(locations - 1, 0);
  return screens * SCREEN_FEE;
}

export type Tier = "good" | "better" | "best";
type Pick = { style: string; name: string; cost: number; cost2xl: number; msrp: number; map?: number };

// Phil's Good / Better / Best picks (Oct 2026). cost / cost2xl = SanMar LIST piece price
// (SDL file, highest color, size L / 2XL). Phil 2026-10-14: quote from list price on purpose —
// his own (lower) SanMar price is margin cushion. These win over product_catalog for these styles.
export const PICKS: Record<string, Record<Tier, Pick>> = {
  tee: {
    good: { style: "PC54", name: "Port & Co PC54 Core Cotton", cost: 4.0, cost2xl: 5.96, msrp: 6.0 },
    better: { style: "NL6210", name: "Next Level 6210 CVC", cost: 5.19, cost2xl: 6.76, msrp: 8.38 },
    best: { style: "BC3413", name: "Bella+Canvas 3413 Triblend", cost: 8.94, cost2xl: 10.21, msrp: 13.88 }, // Phil 2026-10-14: triblend is premium, not the 3001
  },
  longsleeve: {
    good: { style: "PC54LS", name: "Port & Co PC54LS Core Cotton Long Sleeve", cost: 6.89, cost2xl: 7.92, msrp: 9.98 },
    better: { style: "NL6211", name: "Next Level 6211 CVC Long Sleeve", cost: 8.46, cost2xl: 9.51, msrp: 12.68 },
    best: { style: "BC3513", name: "Bella+Canvas 3513 Triblend Long Sleeve", cost: 11.62, cost2xl: 13.51, msrp: 19.24 },
  },
  hoodie: {
    good: { style: "DT6100", name: "District DT6100 V.I.T. Fleece Hoodie", cost: 14.41, cost2xl: 15.41, msrp: 24.82 },
    better: { style: "DT6150", name: "District DT6150 V.I.T. Heavyweight Hoodie", cost: 18.99, cost2xl: 19.99, msrp: 29.98 },
    best: { style: "DT7800", name: "District DT7800 Cloud Fleece Hoodie", cost: 20.55, cost2xl: 21.55, msrp: 33.1 },
  },
  crew: {
    good: { style: "PC78", name: "Port & Co PC78 Core Fleece Crew", cost: 11.23, cost2xl: 12.33, msrp: 18.46 },
    better: { style: "DT6104", name: "District DT6104 V.I.T. Fleece Crew", cost: 13.37, cost2xl: 14.37, msrp: 22.74 },
    best: { style: "DT7804", name: "District DT7804 Cloud Fleece Crew", cost: 19.51, cost2xl: 20.51, msrp: 31.02 },
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

// Other styles we know the cost of when a customer asks for them by name (same basis).
export const KNOWN_STYLES: Pick[] = [
  { style: "BC3001", name: "Bella+Canvas 3001", cost: 5.8, cost2xl: 7.07, msrp: 9.6 },
  { style: "BC3501", name: "Bella+Canvas 3501 Long Sleeve", cost: 9.69, cost2xl: 11.58, msrp: 15.38 },
  { style: "NL6010", name: "Next Level 6010 Tri-Blend", cost: 7.76, cost2xl: 9.34, msrp: 11.52 },
  { style: "5000", name: "Gildan 5000 Heavy Cotton", cost: 4.11, cost2xl: 6.01, msrp: 5.48 },
  { style: "64000", name: "Gildan Softstyle 64000", cost: 4.58, cost2xl: 6.18, msrp: 7.16 },
  { style: "5400", name: "Gildan 5400 Heavy Cotton Long Sleeve", cost: 6.89, cost2xl: 7.99, msrp: 9.98 },
  { style: "PC55", name: "Port & Co PC55 Core Blend Tee", cost: 4.37, cost2xl: 6.19, msrp: 6.5 },
  { style: "PC61", name: "Port & Co PC61 Essential Tee", cost: 4.45, cost2xl: 6.21, msrp: 6.5 },
  { style: "PC78H", name: "Port & Co PC78H Core Fleece Hoodie", cost: 14.63, cost2xl: 17.57, msrp: 25.26 },
  { style: "PC850", name: "Port & Co PC850 Fan Favorite Fleece Crew", cost: 12.51, cost2xl: 14.1, msrp: 20.0 },
  { style: "PC850H", name: "Port & Co PC850H Fan Favorite Fleece Hoodie", cost: 14.58, cost2xl: 17.1, msrp: 24.0 },
  { style: "DT1101", name: "District DT1101 Perfect Weight Fleece Hoodie", cost: 19.84, cost2xl: 20.84, msrp: 31.68 },
  { style: "DT8100", name: "District DT8100 Re-Fleece Hoodie", cost: 15.44, cost2xl: 16.44, msrp: 26.88 },
  { style: "PC90H", name: "Port & Co PC90H Essential Fleece", cost: 18.5, cost2xl: 21.97, msrp: 29.0 },
  // Carhartt has a $55 MAP; priced at MAP + decoration.
  { style: "CTK121", name: "Carhartt K121 Midweight", cost: 39.75, cost2xl: 39.75, msrp: 55, map: 55 },
];

// Quantity not given: the draft gives a range from a basic pick to the premium one, priced at the 12 minimum.
export const RANGE_ANCHORS: Record<string, [string, string]> = {
  hoodie: ["PC78H", "CTK121"],
  tee: ["PC54", "BC3413"],
  longsleeve: ["PC54LS", "BC3513"],
  crew: ["PC78", "DT7804"],
  polo: ["ST550", "ST650"],
};

export function categoryOf(item: string | null | undefined): string | null {
  const s = String(item || "").toLowerCase();
  if (/hat|cap|beanie/.test(s)) return "hat";
  if (/hood/.test(s)) return "hoodie";
  if (/crew ?neck|sweatshirt|\bcrews?\b(?! ?members?)|sweats?\b/.test(s)) return "crew";
  if (/polo/.test(s)) return "polo";
  if (/long ?sleeve|\bl\/s\b|\bls\b/.test(s)) return "longsleeve";
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

/** Decoration column index. Defaults: 1-color screen print, 11x5 DTF, 6k–10k stitches. */
function decoColumn(service: string, colors: number | null, jacket = false): number {
  if (service === "screen_print") return Math.min(Math.max((colors || 1) - 1, 0), 8);
  if (service === "dtf") return 1;
  // Embroidery: ~80% of HCD designs are under 10,000 stitches → shirt or jacket base column.
  if (service === "embroidery") return jacket ? 1 : 0;
  return 0;
}

// product_catalog rows for quoting: "LIST S-XL" / "LIST 2XL" rows written by the live SanMar / S&S
// lookup (list piece price). The older "(X)S-(X)L" / "2XL" rows held HCD's own price and are ignored.
export const LIST_ROWS = { reg: "LIST S-XL", big: "LIST 2XL" } as const;
export const CATALOG_FRESH_DAYS = 60;
export async function freshCatalogCost(db: any, style: string): Promise<{ cost: number | null; cost2xl: number | null }> {
  try {
    const since = new Date(Date.now() - CATALOG_FRESH_DAYS * 86_400_000).toISOString();
    const { data } = await db
      .from("product_catalog")
      .select("piece_price, size_range, updated_at")
      .eq("style_number", style.toUpperCase())
      .in("size_range", [LIST_ROWS.reg, LIST_ROWS.big])
      .gt("piece_price", 0)
      .gte("updated_at", since)
      .limit(10);
    const rows = (data || []) as { piece_price: number; size_range: string; updated_at: string }[];
    const newest = (sz: string) => rows.filter((r) => r.size_range === sz).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
    const reg = newest(LIST_ROWS.reg), big = newest(LIST_ROWS.big);
    return { cost: reg ? Number(reg.piece_price) : null, cost2xl: big ? Number(big.piece_price) : null };
  } catch (_) {
    return { cost: null, cost2xl: null };
  }
}

export async function garmentCost(db: any, pick: Pick, qty = 12): Promise<number> {
  if (pick.cost > 0) return pick.cost; // SanMar list price table above
  const fresh = await freshCatalogCost(db, pick.style);
  if (fresh.cost) return fresh.cost;
  return richardsonCost(pick.style, qty) ?? 0; // then Richardson wholesale
}

// screenColors: screen print with a different design per location, one color count per
// location in order (e.g. [1, 3] = 1-color front + 3-color back). Each location is priced at
// its own color column. Without it, extra locations are treated as 1-color.
export type PriceOpts = { colors?: number | null; locations?: number; jacket?: boolean; dtfCols?: number[]; placements?: string[]; screenColors?: number[] };

const screenCol = (c: number) => Math.min(Math.max((c || 1) - 1, 0), 8);
function screenColorsOf(service: string, opts: PriceOpts): number[] | null {
  if (service !== "screen_print" || !opts.screenColors?.length) return null;
  return opts.screenColors.map((c) => Math.max(Math.floor(c || 1), 1));
}
/** Decoration price per piece for one matrix row — shared by every suggestion path. */
function decoPrice(row: Row, service: string, opts: PriceOpts): number {
  const sc = screenColorsOf(service, opts);
  if (sc) return Number(sc.reduce((sum, c) => sum + (row.prices[screenCol(c)] ?? row.prices[0]), 0).toFixed(2));
  const dtfCols = dtfColsOf(service, opts);
  if (dtfCols) return Number(dtfCols.reduce((sum, c) => sum + (row.prices[c] ?? row.prices[1]), 0).toFixed(2));
  const col = decoColumn(service, opts.colors ?? null, opts.jacket ?? false);
  // Extra locations: screen print/DTF at 1-color / 4x4; embroidery (sleeve etc.) $8 each.
  const extraLocs = Math.max((opts.locations || 1) - 1, 0);
  const extra = service === "screen_print" || service === "dtf" ? row.prices[0] : service === "embroidery" ? EMB_EXTRA_LOCATION : 0;
  return Number(((row.prices[col] ?? row.prices[0]) + extraLocs * extra).toFixed(2));
}

/** Screens for a multi-design job: one per color per location ($20 each, waived at 144+). */
export function screenFeesByLocation(colorsPerLoc: number[], qty: number): number {
  if (qty >= SCREEN_FEE_WAIVE_QTY) return 0;
  return colorsPerLoc.reduce((n, c) => n + Math.max(Math.floor(c || 1), 1), 0) * SCREEN_FEE;
}

function dtfColsOf(service: string, opts: PriceOpts): number[] | null {
  if (service !== "dtf") return null;
  if (opts.dtfCols?.length) return opts.dtfCols;
  const list = (opts.placements || []).map((p) => String(p).trim()).filter(Boolean);
  return list.length ? list.map(dtfColForPlacement) : null;
}

export async function suggestTiers(
  db: any,
  category: string,
  service: string,
  qty: number,
  // DTF: price each placement at its own size. dtfCols (counter screen) = explicit columns
  // (0 = 4x4, 1 = 11x5, 2 = 11x14, 3 = 12x22); placements (email/website) = location names, mapped by
  // dtfColForPlacement. Neither given → old rule (first location 11x5, extras 4x4).
  opts: PriceOpts = {},
): Promise<Suggestion[]> {
  const picks = PICKS[category];
  const row = matrixRow(service, qty);
  if (!picks || !row || qty <= 0) return [];
  const deco = decoPrice(row, service, opts);
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
      upcharge_2xl: p.map ? 0 : Number((Math.max(p.cost2xl - p.cost, 0) * (row.markup / 100)).toFixed(2)),
    });
  }
  return out;
}

export function assumptionsFor(service: string, colors: number | null, placements?: string[]): string {
  const list = (placements || []).map((p) => String(p).trim()).filter(Boolean);
  if (service === "dtf" && list.length) {
    const sized = list.map((p) => `${p} ${DTF_SIZE_NAMES[dtfColForPlacement(p)]}`).join(" + ");
    const back = list.some((p) => dtfColForPlacement(p) === DTF_COLS.large);
    return `DTF ${sized}${back ? " (back priced at full 11x14; smaller art = lower price)" : ""}`;
  }
  if (service === "screen_print") return `${colors || 1}-color print${colors ? "" : " (assumed — confirm after art)"}`;
  if (service === "embroidery") return "up to 10,000 stitches (+$1.50 per 1,000 over — confirm after digitizing)";
  if (service === "dtf") return "11x5 transfer";
  if (service === "leather_patch") return "sewn leather patch";
  return "";
}

/** Pull a style number out of what the customer wrote, e.g. "Richardson 112PT hats" → "112PT". */
export function styleFromText(text: string | null | undefined): string | null {
  const m = String(text || "").toUpperCase().match(/\b([A-Z]{0,4}\d{2,6}[A-Z]{0,4})\b/g);
  const ALIAS: Record<string, string> = { "6210": "NL6210", "3600": "NL3600", "3001": "BC3001", "3413": "BC3413", "3513": "BC3513", "3501": "BC3501", "6010": "NL6010", "K121": "CTK121", "G500": "5000" };
  const hit = m ? m.find((s) => !/^\d{4}$/.test(s) || ["5000", "8000", "2000", "1717", "3001", "6210", "3600", "3413", "3513", "3501", "6010"].includes(s)) ?? null : null;
  return hit ? (ALIAS[hit] ?? hit) : null;
}

/** Price the exact style the customer asked for (if we can find its cost). */
export async function suggestRequested(
  db: any, style: string, service: string, qty: number, opts: PriceOpts = {},
): Promise<Suggestion | null> {
  const row = matrixRow(service, qty);
  if (!row || qty <= 0) return null;
  const known = knownStyle(style);
  const cost = await garmentCost(db, known ?? { style, name: style, cost: 0, cost2xl: 0, msrp: 0 }, qty);
  if (!cost) return null;
  return suggestFromCost(style, cost, service, qty, opts);
}

function knownStyle(style: string) {
  return [...Object.values(PICKS).flatMap((t) => Object.values(t)), ...KNOWN_STYLES].find((p) => p.style === style.toUpperCase());
}

/** Price a specific style from a known garment cost (e.g. a live SanMar lookup). */
export function suggestFromCost(
  style: string, cost: number, service: string, qty: number, opts: PriceOpts = {},
): Suggestion | null {
  const row = matrixRow(service, qty);
  if (!row || qty <= 0 || !(cost > 0)) return null;
  const known = knownStyle(style);
  const deco = decoPrice(row, service, opts);
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
  "112P": { name: "Richardson 112P Printed Trucker", add: 1.5 },   // Phil's 544-hat order: 112P $20 vs 880/882 $18.50
  "880": { name: "Richardson 880 Blaze/Camo Trucker", add: 0 },
  "882": { name: "Richardson 882 Blaze Trucker", add: 0 },
  "110": { name: "Richardson 110 R-Flex", add: 1.25 },
  "6606": { name: "YP Classics 6606 Retro Trucker", add: 1.05 },
  "OFA": { name: "Legacy OFA", add: 2 },
  "112PT": { name: "Richardson 112PT Printed Tactical", add: 2 },
  "112PL": { name: "Richardson 112+ R-Flex", add: 2 },
};
export const HAT_MIN = 12;
// Anything this size or bigger is a custom quote (a few a year) — no auto price.
export const CUSTOM_QUOTE_QTY = 700;

// Embroidered hats: same price as a patch up to 8,000 stitches, one location.
// 2nd and 3rd locations (embroidered) +$8 each. Side flag +$5 (upsell).
export const HAT_EXTRA_LOCATION = 8;
export const HAT_SIDE_FLAG = 5;
export const HAT_STITCH_LIMIT = 8000;
// Hat stitch tiers (Phil 2026-10-18): up to 8k included, 8–12k +$1, 12–16k +$2, over 16k is quoted per job.
// Stacks with 3D puff. Patch hats and the $45 digitizing aren't affected.
export const HAT_STITCH_TIERS = [
  { id: 0, label: "Up to 8k", max: 8000, add: 0 },
  { id: 1, label: "8–12k", max: 12000, add: 1 },
  { id: 2, label: "12–16k", max: 16000, add: 2 },
] as const;
export const HAT_STITCH_QUOTE_OVER = 16000;
export const HAT_STITCH_NOTE = "up to 8,000 stitches included; 8–12k +$1, 12–16k +$2, over 16k quoted per job";
/** Per-hat stitch add-on for a stitch count; null = over 16k, quote per job. */
export function hatStitchAdd(stitches: number): number | null {
  const t = HAT_STITCH_TIERS.find((x) => stitches <= x.max);
  return t ? t.add : null;
}
// 3D puff embroidery: +$3 per hat (Phil 2026-10-18).
export const HAT_PUFF = 3;

export function hatPrice(style: string | null, qty: number, opts: { locations?: number; puff?: boolean; stitchAdd?: number } = {}): Suggestion | null {
  if (qty <= 0) return null;
  const q = Math.max(qty, HAT_MIN);
  const tier = HAT_PRICE_TIERS.find((t) => q >= t.min)!;
  const key = (style || "112").toUpperCase();
  const known = HAT_UPCHARGES[key];
  const extraLocs = Math.min(Math.max((opts.locations || 1) - 1, 0), 2);
  const unit = Number((tier.price + (known?.add ?? 0) + extraLocs * HAT_EXTRA_LOCATION + (opts.puff ? HAT_PUFF : 0) + (opts.stitchAdd ?? 0)).toFixed(2));
  return {
    tier: "better", style: key, name: (known?.name ?? `${key} (not on hat list — priced as a 112, check it)`) + (opts.puff ? ", 3D puff" : ""),
    garment_cost: 0, markup_pct: 0, decoration_cost: unit, unit_price: unit,
    total: Number((unit * q).toFixed(2)), upcharge_2xl: 0,
  };
}

// Hat patch Good/Better/Best (Phil 2026-10-17). Sewn real leather is the standard (the price list above);
// leatherette (pressed, incl. specialty colors / carbon fiber) is the value option at -$2; full-color textured
// UV (pressed; sewn on request, no charge) is the premium at +$2. No sewing fee — sewn is how we do leather.
// Embroidery prices like the standard (+ digitizing). PVC is on request only: outsourced, ~2 weeks, priced by hand.
export const HAT_PATCH_TIERS: Record<Tier, { label: string; add: number }> = {
  good: { label: "leatherette patch", add: -2 },
  better: { label: "leather patch, sewn on", add: 0 },
  best: { label: "full-color textured UV patch", add: 2 },
};

/** Good/Better/Best for patch hats on one hat style: leatherette / sewn leather / full-color UV. */
export function hatTiers(style: string | null, qty: number, opts: { locations?: number } = {}): Suggestion[] {
  const base = hatPrice(style, qty, opts);
  if (!base) return [];
  return (["good", "better", "best"] as Tier[]).map((t) => {
    const unit = Number((base.unit_price + HAT_PATCH_TIERS[t].add).toFixed(2));
    return { ...base, tier: t, name: `${base.name}, ${HAT_PATCH_TIERS[t].label}`, decoration_cost: unit, unit_price: unit,
      total: Number((unit * Math.max(qty, HAT_MIN)).toFixed(2)) };
  });
}

/** Next price break above qty for hats (null at the top tier). */
export function hatNextTier(qty: number): number | null {
  const q = Math.max(qty, HAT_MIN);
  const ups = HAT_PRICE_TIERS.map((t) => t.min).filter((m) => m > q && m < CUSTOM_QUOTE_QTY).sort((a, b) => a - b);
  return ups[0] ?? null;
}

/** Next price break above qty in a decoration matrix (null at the top). */
export function matrixNextTier(service: string, qty: number): number | null {
  const m = MATRICES[service];
  if (!m) return null;
  // Skip breaks only a few pieces away (DTF 12 → 15 isn't useful); need at least +12.
  const up = m.rows.map((r) => r.qty).filter((x) => x >= qty + 12 && x < CUSTOM_QUOTE_QTY).sort((a, b) => a - b);
  return up[0] ?? null;
}
