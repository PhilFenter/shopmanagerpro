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
  hatPrice,
  hatNextTier,
  matrixNextTier,
  screenPrintMin,
  screenFees,
  SMALL_MIN,
  SMALL_ORDER_UNDER,
  SMALL_ORDER_FEE,
  SCREEN_FEE,
  SCREEN_FEE_WAIVE_QTY,
  HAT_MIN,
  HAT_UPCHARGES,
  CUSTOM_QUOTE_QTY,
  type Suggestion,
  type Tier,
} from "../../supabase/functions/_shared/hcd-pricing.ts";

export type Item = "tee" | "hoodie" | "crew" | "polo" | "hat";
export type Method = "screen_print" | "dtf" | "embroidery" | "patch" | "hat_embroidery";

export const ITEMS: { id: Item; label: string }[] = [
  { id: "tee", label: "T-Shirts" },
  { id: "hoodie", label: "Hoodies" },
  { id: "crew", label: "Crewnecks" },
  { id: "polo", label: "Polos" },
  { id: "hat", label: "Hats" },
];

export const METHOD_LABELS: Record<Method, string> = {
  screen_print: "Screen Print",
  dtf: "Full-Color Print (DTF)",
  embroidery: "Embroidery",
  patch: "Leather Patch",
  hat_embroidery: "Embroidery",
};

export function methodsFor(item: Item): Method[] {
  if (item === "hat") return ["patch", "hat_embroidery"];
  if (item === "polo") return ["embroidery"]; // polos: left-chest embroidery only
  return ["screen_print", "dtf", "embroidery"];
}

export function placementsFor(item: Item, method: Method): string[] {
  if (item === "hat") return ["Front", "Side", "Back"];
  if (item === "polo") return ["Left chest"];
  if (method === "embroidery") return ["Left chest", "Center front", "Sleeve"]; // no back embroidery
  return ["Front", "Back", "Left chest", "Sleeve"];
}

export const DTF_SIZES = ["4 x 4", "11 x 5", "11 x 14"];
export const HAT_STYLES = Object.entries(HAT_UPCHARGES).map(([style, v]) => ({ style, name: v.name, add: v.add }));
export const TIER_LABELS: Record<Tier, string> = { good: "Value", better: "Mid-Grade", best: "Premium" };

export interface CounterLine {
  id: string;
  item: Item;
  qty: number;
  method: Method;
  colors: number; // screen print
  dtfSize: number; // 0..2
  placements: string[];
  hatStyle: string;
  tier: Tier;
  color: string; // garment color, free text
}

export function newLine(item: Item = "tee"): CounterLine {
  return {
    id: crypto.randomUUID(),
    item,
    qty: item === "hat" ? 24 : 24,
    method: methodsFor(item)[0],
    colors: 1,
    dtfSize: 1,
    placements: [placementsFor(item, methodsFor(item)[0])[0]],
    hatStyle: "112",
    tier: "better",
    color: "",
  };
}

export interface Fee { label: string; amount: number }
export interface Priced {
  tiers: Suggestion[];       // 3 for garments, 1 for hats
  billedQty: number;         // hats under 12 bill at 12
  fees: Fee[];
  notes: string[];           // friendly, customer-safe notes
  blocker: string | null;    // can't price at the counter (custom / below minimum)
  suggestDtf: boolean;       // screen print below minimum → offer DTF
  nextBreak: { qty: number; unit: number } | null;
}

const service = (m: Method) => (m === "patch" || m === "hat_embroidery" ? "hat" : m);

function apparelFees(line: CounterLine, qty: number): Fee[] {
  const locs = Math.max(line.placements.length, 1);
  if (line.method === "screen_print") {
    const f = screenFees(line.colors, locs, qty);
    return f > 0 ? [{ label: `Screen setup (${f / SCREEN_FEE} screen${f / SCREEN_FEE > 1 ? "s" : ""}, one-time)`, amount: f }] : [];
  }
  if (qty >= SMALL_MIN && qty < SMALL_ORDER_UNDER) return [{ label: "Small order fee (under 12)", amount: SMALL_ORDER_FEE }];
  return [];
}

// db = the browser supabase client; used only to read live SanMar prices from product_catalog.
export async function priceLine(db: unknown, line: CounterLine): Promise<Priced> {
  const qty = Math.max(0, Math.floor(line.qty || 0));
  const locs = Math.max(line.placements.length, 1);
  const out: Priced = { tiers: [], billedQty: qty, fees: [], notes: [], blocker: null, suggestDtf: false, nextBreak: null };
  if (qty <= 0) return out;
  if (qty >= CUSTOM_QUOTE_QTY) {
    out.blocker = `${CUSTOM_QUOTE_QTY}+ pieces is a custom quote. Phil will price this one, and we'll get back to you quickly.`;
    return out;
  }

  if (line.item === "hat") {
    const s = hatPrice(line.hatStyle, qty, { locations: locs });
    if (!s) return out;
    out.tiers = [s];
    out.billedQty = Math.max(qty, HAT_MIN);
    if (qty < HAT_MIN) out.notes.push(`Hats start at ${HAT_MIN}. You can split the 12 across hat colors.`);
    if (line.method === "hat_embroidery" && out.billedQty < 50) out.fees.push({ label: "Digitizing (one-time, to set up your logo)", amount: 45 });
    out.notes.push(line.method === "patch" ? "Includes the hat, leather patch, and sewing." : "Includes the hat and embroidery up to 8,000 stitches.");
    if (!HAT_UPCHARGES[line.hatStyle.toUpperCase()]) out.notes.push("Style isn't on our hat list yet, so it's priced like a 112. We'll confirm.");
    const nq = hatNextTier(out.billedQty);
    if (nq) {
      const ns = hatPrice(line.hatStyle, nq, { locations: locs });
      if (ns && ns.unit_price < s.unit_price) out.nextBreak = { qty: nq, unit: ns.unit_price };
    }
    return out;
  }

  const svc = service(line.method);
  const opts = { colors: line.colors, locations: locs, dtfCol: line.dtfSize };
  out.tiers = await suggestTiers(db, line.item, svc, qty, opts);
  out.fees = apparelFees(line, qty);

  if (line.method === "screen_print") {
    const min = screenPrintMin(line.colors);
    if (qty < min) {
      out.blocker = `Screen print starts at ${min} pieces for ${line.colors} color${line.colors > 1 ? "s" : ""}.`;
      out.suggestDtf = true;
    }
    out.notes.push(`${line.colors}-color print. We'll lock it in once we see the art.`);
    if (qty < SCREEN_FEE_WAIVE_QTY) out.notes.push(`Screen setup is waived at ${SCREEN_FEE_WAIVE_QTY}+ pieces.`);
  } else {
    if (qty < SMALL_MIN) out.blocker = `${METHOD_LABELS[line.method]} starts at ${SMALL_MIN} pieces.`;
    if (line.method === "embroidery") out.notes.push("Embroidery up to 10,000 stitches (most logos). We confirm after digitizing.");
    if (line.method === "dtf") out.notes.push(`${DTF_SIZES[line.dtfSize]} full-color print. No screen fees.`);
  }

  const nq = matrixNextTier(svc, qty);
  if (nq) {
    const next = await suggestTiers(db, line.item, svc, nq, opts);
    const cur = out.tiers.find((t) => t.tier === line.tier);
    const nxt = next.find((t) => t.tier === line.tier);
    if (cur && nxt && nxt.unit_price < cur.unit_price) out.nextBreak = { qty: nq, unit: nxt.unit_price };
  }
  return out;
}

export function chosen(line: CounterLine, p: Priced | undefined): Suggestion | undefined {
  if (!p) return undefined;
  return line.item === "hat" ? p.tiers[0] : p.tiers.find((t) => t.tier === line.tier);
}

export function lineTotal(line: CounterLine, p: Priced | undefined): number {
  const s = chosen(line, p);
  if (!s || !p || p.blocker) return 0;
  return s.unit_price * p.billedQty + p.fees.reduce((a, f) => a + f.amount, 0);
}

export function describeLine(line: CounterLine, s?: Suggestion): string {
  const what = line.item === "hat" ? (s?.name ?? `Hat ${line.hatStyle}`) : (s?.name ?? ITEMS.find((i) => i.id === line.item)!.label);
  const deco =
    line.method === "screen_print" ? `${line.colors}-color screen print` :
    line.method === "dtf" ? `DTF ${DTF_SIZES[line.dtfSize]}` :
    METHOD_LABELS[line.method];
  return `${what} — ${deco}, ${line.placements.join(" + ") || "location TBD"}`;
}

export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// ── Save ───────────────────────────────────────────────────────────────

export interface CounterContact { name: string; phone: string; email: string; company: string }
export interface CounterExtras {
  dueDate: string;            // yyyy-mm-dd or ""
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
    extras.needsArtHelp && "Needs help with artwork.",
    extras.shipping && "Wants it shipped.",
    extras.nonprofit && "Nonprofit / tax exempt. Get the certificate.",
    extras.notes.trim() && extras.notes.trim(),
  ].filter(Boolean) as string[];

  const usable = lines.filter((l) => l.qty > 0);
  const grand = extras.ownGarments ? 0 : usable.reduce((a, l) => a + lineTotal(l, priced[l.id]), 0);

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
        ...(l.method === "screen_print" ? { colors: l.colors } : {}),
        ...(l.method === "dtf" ? { dtfSize: DTF_SIZES[l.dtfSize] } : {}),
        ...(l.item === "hat" ? { hatStyle: l.hatStyle } : { tier: l.tier }),
      },
      line_total: priceIt ? Number((s!.unit_price * qty).toFixed(2)) : 0,
      notes: [...(p?.notes ?? []), p?.blocker ?? "", priceIt && s!.upcharge_2xl > 0 ? `2XL+ add ${money(s!.upcharge_2xl)} each` : ""].filter(Boolean).join(" ") || null,
    });
    if (priceIt) for (const f of p!.fees) {
      rows.push({
        quote_id: quote.id, service_type: "other", description: f.label, quantity: 1, sizes: {},
        garment_cost: 0, garment_markup_pct: 0, decoration_cost: f.amount, line_total: f.amount, notes: null,
      });
    }
  }
  if (rows.length) {
    const { error } = await db.from("quote_line_items").insert(rows.map((r, i) => ({ ...r, sort_order: i })));
    if (error) throw error;
  }

  // One action item — the replacement for the sticky note.
  const summary = usable.map((l) => `${l.qty} ${ITEMS.find((i) => i.id === l.item)!.label.toLowerCase()}`).join(" + ") || "items TBD";
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
    "Send to Printavo",
  ].map((text) => ({ id: crypto.randomUUID(), text, done: false }));

  const { data: ai, error: aiErr } = await db
    .from("action_items")
    .insert({
      title: `Counter Quote: ${contact.name.trim()} — ${summary}`,
      description: [
        `Walk-in quote ${quote.quote_number || ""} — quoted at the counter${extras.dueDate ? `, needed by ${extras.dueDate}` : ""}.`,
        ...priceLines,
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
