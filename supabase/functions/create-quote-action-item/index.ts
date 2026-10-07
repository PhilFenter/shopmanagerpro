import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  suggestTiers, suggestRequested, styleFromText, hatPrice, hatNextTier, matrixNextTier, assumptionsFor,
  screenPrintMin, screenFees, HAT_SIDE_FLAG, HAT_STITCH_LIMIT, CUSTOM_QUOTE_QTY, SCREEN_FEE, SCREEN_FEE_WAIVE_QTY,
  SMALL_MIN, SMALL_ORDER_UNDER, SMALL_ORDER_FEE, type Tier,
} from "../_shared/hcd-pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ───────────────────────────────────────────

const SERVICE_TYPE_MAP: Record<string, string> = {
  custom_hats: "leather_patch",
  leather_patch_hats: "leather_patch",
  embroidery: "embroidery",
  screen_print: "screen_print",
  dtf: "dtf",
  garments: "other",
};

const SERVICE_TITLE_LABELS: Record<string, string> = {
  custom_hats: "Custom Hats",
  leather_patch_hats: "Custom Hats",
  embroidery: "Embroidery",
  screen_print: "Screen Print",
  dtf: "DTF",
  garments: "Custom Garments",
  other: "Quote",
};

const PATCH_LABELS: Record<string, string> = {
  "laser-leather": "Laser Engraved Leather Patch",
  "uv-printed": "UV Printed Patch",
  "direct-embroidery": "Direct Embroidery",
  "embroidered-patch": "Embroidered Patch",
  other: "Patch (TBD)",
};

const HAT_LABELS: Record<string, string> = {
  "richardson-112": "Richardson 112",
  "richardson-112pfp": "Richardson 112PFP",
  "richardson-110": "Richardson 110",
  "yp-classics-6606": "YP Classics 6606",
  "legacy-ofa": "Legacy OFA",
  other: "Custom Hat Style",
};

const GARMENT_LABELS: Record<string, string> = {
  tshirt: "T-Shirt",
  hoodie: "Hoodie / Sweatshirt",
  polo: "Polo",
  jacket: "Jacket / Soft Shell",
  safety: "Safety Vest / Hi-Vis",
  tshirts: "T-Shirts",
  hoodies: "Hoodies",
  tanks: "Tank Tops",
  hats: "Hats",
  bags: "Bags / Totes",
  "not-sure": "Apparel (TBD)",
  other: "Other Garment",
};

const TIMELINE_LABELS: Record<string, string> = {
  standard: "Standard (2–3 weeks)",
  rush: "Rush (1–2 weeks)",
  flexible: "No rush — flexible",
  asap: "ASAP",
};

const CUSTOM_HAT_SERVICE_TYPES = new Set([
  "custom_hats",
  "custom_hat",
  "leather_patch_hats",
  "leather_patch_hat",
]);

function normalizeServiceType(serviceType?: string): string {
  if (!serviceType) return "other";

  const normalized = serviceType
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (CUSTOM_HAT_SERVICE_TYPES.has(normalized)) return "custom_hats";
  if (normalized === "screenprint") return "screen_print";

  return normalized;
}

// ── Crew / team intake helpers ────────────────────────
// The Crew Team form asks "how many people" as a range ("12 to 50") instead of
// an exact quantity. Previously that fell through to quantity 1, which made the
// action item read "Custom Garment ×1". These helpers turn the range into a
// clear "qty TBD" line and a sensible starting quantity (the low end).
const TEAM_SIZE_RANGES: Record<string, { low: number; high: number | null }> = {
  "under 12": { low: 12, high: 12 },
  "12 to 50": { low: 12, high: 50 },
  "51 to 200": { low: 51, high: 200 },
  "200 or more": { low: 200, high: null },
};

function isCrewTeamSubmission(details: Record<string, unknown>, source?: string): boolean {
  return source === "website-crew-team" || details.source === "website-crew-team";
}

function parseTeamSize(teamSize: unknown): { low: number; high: number | null; label: string } | null {
  if (typeof teamSize !== "string" || !teamSize.trim()) return null;
  const range = TEAM_SIZE_RANGES[teamSize.trim().toLowerCase()];
  return range ? { ...range, label: teamSize.trim() } : null;
}

function crewItemsLabel(items: unknown): string {
  const list = Array.isArray(items) ? items.map(String) : typeof items === "string" ? [items] : [];
  if (list.includes("Both") || (list.includes("Shirts") && list.includes("Hats"))) return "Shirts + Hats";
  if (list.includes("Shirts")) return "Shirts";
  if (list.includes("Hats")) return "Hats";
  return "Apparel (items TBD)";
}

function readDetailString(details: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = details[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function toDisplayLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveHatDetails(details: Record<string, unknown>) {
  const hatCode = readDetailString(details, ["hatModel", "hatStyle", "style_number", "style"]);
  const hatLabel = HAT_LABELS[hatCode] || (hatCode ? toDisplayLabel(hatCode) : "");

  const hatBrand = readDetailString(details, ["hatBrand"]);
  const hatBrandLabel = hatBrand ? toDisplayLabel(hatBrand) : "";

  const hatColorRaw = readDetailString(details, ["hatColor", "hatColors", "colors"]);
  const hatColor = hatColorRaw ? toDisplayLabel(hatColorRaw) : "";

  const patchTypeKey = readDetailString(details, ["patchType", "patch_type"]);
  let patchLabel = PATCH_LABELS[patchTypeKey] || (patchTypeKey ? toDisplayLabel(patchTypeKey) : "");

  if (!patchLabel) {
    const patchShape = readDetailString(details, ["patchShape", "shape"]);
    const patchSize = readDetailString(details, ["patchSize", "size"]);
    const leatherColor = readDetailString(details, ["leatherColor"]);

    const extras = [patchSize, patchShape, leatherColor]
      .filter(Boolean)
      .map((value) => toDisplayLabel(value));

    patchLabel = extras.length > 0
      ? `Leather Patch (${extras.join(" · ")})`
      : "Leather Patch";
  }

  return {
    hatCode,
    hatLabel,
    hatBrand: hatBrandLabel,
    hatColor,
    patchLabel,
  };
}


// ── Suggested pricing for website requests (same rules as email intake) ──
// Internal notes only: shown on the action item for Phil, never sent to the customer.
const GARMENT_CATEGORY: Record<string, string> = {
  tshirt: "tee", tshirts: "tee", tanks: "tee", hoodie: "hoodie", hoodies: "hoodie", crewneck: "crew", crewnecks: "crew", sweatshirt: "crew", sweatshirts: "crew", polo: "polo", jacket: "jacket",
};

async function websitePricingLines(
  db: any, serviceType: string, details: Record<string, unknown>, qty: number,
): Promise<string[]> {
  if (!qty || qty <= 0) return [];
  if (qty >= CUSTOM_QUOTE_QTY) return ["", `💲 ${qty} pcs — CUSTOM QUOTE (${CUSTOM_QUOTE_QTY}+ pieces). Price this one by hand.`];
  const out: string[] = [""];

  if (serviceType === "custom_hats") {
    const { hatCode } = resolveHatDetails(details);
    const style = (String(hatCode || "").match(/\d{2,4}[a-z]*/i)?.[0] || "112").toUpperCase();
    const patchType = readDetailString(details, ["patchType", "patch_type"]);
    const embroidery = patchType === "direct-embroidery";
    const hp = hatPrice(style, qty);
    const nq = hatNextTier(qty);
    const np = nq ? hatPrice(style, nq) : null;
    if (!hp) return [];
    out.push(`💲 Suggested price (${qty} hats, hat price list, shipping included${embroidery ? `, up to ${HAT_STITCH_LIMIT.toLocaleString()} stitches: +$3 to 10k, +$6 max to 21k` : ""}${embroidery && qty < 50 ? ", +$45 digitizing" : ""}${qty < 12 ? ", 12 minimum" : ""}):`);
    out.push(`  ${hp.name}: $${hp.unit_price.toFixed(2)} ea / $${hp.total.toFixed(2)}`);
    if (np && nq) out.push(`  NEXT BREAK: ${nq} hats — $${np.unit_price.toFixed(2)} ea`);
    out.push(`  UPSELL: side flag +$${HAT_SIDE_FLAG.toFixed(2)} per hat. 2nd/3rd embroidered location +$8 each.`);
    return out;
  }

  const garmentKey = String(details.garmentType || "");
  const cat = GARMENT_CATEGORY[garmentKey] || null;
  const colors = parseInt(String(details.printColors ?? ""), 10) || null;
  const rec = String(details.recommendedDecoration || "").toLowerCase();
  let method = serviceType === "screen_print" || serviceType === "embroidery" || serviceType === "dtf"
    ? serviceType
    : /embroid/.test(rec) ? "embroidery" : /dtf|transfer/.test(rec) ? "dtf" : /screen/.test(rec) ? "screen_print"
    : qty >= screenPrintMin(colors) ? "screen_print" : "dtf";
  const locs = method === "embroidery" ? details.embroideryLocations : details.printLocations;
  const locList = Array.isArray(locs) ? locs.map(String) : [];
  const backEmb = method === "embroidery" && locList.some((l) => /\bback\b/i.test(l));
  const locations = Math.max(locList.length - (backEmb ? 1 : 0), 1);
  const flags: string[] = [];
  if (backEmb) flags.push("Asked for BACK embroidery — we don't offer it. Suggest screen print/DTF for the back. Priced front only.");
  if (method === "screen_print" && qty < screenPrintMin(colors)) {
    flags.push(`${qty} pcs is under the screen print minimum (${screenPrintMin(colors)} for ${colors || 1} color) — priced as DTF.`);
    method = "dtf";
  }
  const fees: string[] = [];
  if ((method === "dtf" || method === "embroidery") && qty < SMALL_MIN) flags.push(`${qty} pcs is under our ${SMALL_MIN}-piece minimum.`);
  else if ((method === "dtf" || method === "embroidery") && qty < SMALL_ORDER_UNDER) fees.push(`+$${SMALL_ORDER_FEE} small order fee (under ${SMALL_ORDER_UNDER})`);
  if (method === "screen_print") {
    const sf = screenFees(colors, locations, qty);
    fees.push(sf ? `+$${sf} screen fees ($${SCREEN_FEE} per color per location, waived at ${SCREEN_FEE_WAIVE_QTY}+)` : "screen fees waived");
  }
  const jacket = garmentKey === "jacket";
  const style = styleFromText(String(details.style || details.styleNumber || details.garmentStyle || ""));
  const tierHint = (["good", "better", "best"].includes(String(details.poloTier || "").toLowerCase()) ? String(details.poloTier).toLowerCase() : "better") as Tier;
  let tiers: Awaited<ReturnType<typeof suggestTiers>> = [];
  let requested = null as Awaited<ReturnType<typeof suggestRequested>>;
  try {
    if (cat && cat !== "jacket") tiers = await suggestTiers(db, cat, method, qty, { colors, locations, jacket, placements: locList });
    if (style) requested = await suggestRequested(db, style, method, qty, { colors, locations, jacket, placements: locList });
  } catch (e) {
    console.error("website pricing failed:", e);
  }
  if (!tiers.length && !requested) {
    if (jacket && method === "embroidery") out.push("💲 Jacket embroidery: garment × 200% + $20 (up to 10,000 stitches), +$8 per sleeve/extra spot. Pick the jacket and price by hand.");
    return [...(out.length > 1 ? out : []), ...flags.map((f) => `⚠ ${f}`)];
  }
  const assumptions = [assumptionsFor(method, colors, locList), ...fees].filter(Boolean).join(", ");
  out.push(`💲 Suggested price (${qty} pcs, ${method.replace(/_/g, " ")}${assumptions ? `, ${assumptions}` : ""}):`);
  if (requested) out.push(`  ★ ASKED FOR: ${requested.name} — $${requested.unit_price.toFixed(2)} ea / $${requested.total.toFixed(2)}`);
  for (const t of tiers) {
    out.push(`  ${!requested && t.tier === tierHint ? "→ " : "  "}${t.tier.toUpperCase()}: ${t.name} — $${t.unit_price.toFixed(2)} ea / $${t.total.toFixed(2)}${t.upcharge_2xl > 0 ? ` (2XL+ add $${t.upcharge_2xl.toFixed(2)})` : ""}`);
  }
  const nq = matrixNextTier(method, qty);
  if (nq && cat && cat !== "jacket") {
    try {
      const np = requested ? await suggestRequested(db, requested.style, method, nq, { colors, locations, jacket, placements: locList })
        : (await suggestTiers(db, cat, method, nq, { colors, locations, jacket, placements: locList })).find((x) => x.tier === tierHint) ?? null;
      if (np) out.push(`  NEXT BREAK: ${nq} pcs of ${np.name} — $${np.unit_price.toFixed(2)} ea`);
    } catch (e) {
      console.error("website next-break pricing failed:", e);
    }
  }
  out.push("  (SanMar list cost × markup + decoration. Check before sending.)");
  return [...out, ...flags.map((f) => `⚠ ${f}`)];
}

/** Build a human-readable description from details */
function buildDescription(
  serviceType: string,
  details: Record<string, unknown>,
  timeline?: string,
  artworkNotes?: string,
  estimate?: { low: number; high: number } | null
): string {
  const parts: string[] = [];
  const missingFields: string[] = [];
  const normalizedServiceType = normalizeServiceType(serviceType);

  if (normalizedServiceType === "custom_hats") {
    const { hatLabel, hatBrand, hatColor, patchLabel } = resolveHatDetails(details);

    parts.push(`Patch: ${patchLabel || "⚠️ Not specified"}`);
    parts.push(`Hat: ${[hatBrand, hatLabel].filter(Boolean).join(" ") || "⚠️ Not specified"}`);
    parts.push(`Colors: ${hatColor || "⚠️ Not specified"}`);

    if (!patchLabel) missingFields.push("patch type");
    if (!hatLabel) missingFields.push("hat style");
    if (!hatColor) missingFields.push("hat colors");
  } else if (isCrewTeamSubmission(details)) {
    const team = parseTeamSize(details.teamSize);
    parts.push(`Items: ${crewItemsLabel(details.itemsLookingFor)}`);
    parts.push(`People to outfit: ${team?.label || "⚠️ Not specified"}`);
    if (details.organizationType) parts.push(`Organization: ${details.organizationType}`);
    if (details.whatYouDoAndWhoYouServe) parts.push(`What they do: ${details.whatYouDoAndWhoYouServe}`);
    if (details.orderType) parts.push(`Order type: ${details.orderType}`);
    if (details.artworkStatus) parts.push(`Artwork: ${details.artworkStatus}`);
    if (details.deadlineDate) parts.push(`Needed by: ${details.deadlineDate}`);
    // Shop rule: screen print minimum is 24 for 1 color (+12 per extra color); below that is DTF.
    if (team) {
      parts.push(team.high !== null && team.high < 24
        ? "Suggested method: DTF (under the 24-pc screen print minimum)"
        : team.low >= 24
          ? "Suggested method: Screen print if qty ≥ 24 for 1 color (+12 per extra color), otherwise DTF"
          : "Suggested method: DTF or screen print — depends on final qty (24 pcs for 1 color, +12 per extra color)");
    }
    missingFields.push("exact quantity + sizes");
    if (crewItemsLabel(details.itemsLookingFor).includes("TBD")) missingFields.push("which items (shirts / hats)");
  } else if (normalizedServiceType === "dtf") {
    if (details.orderType) parts.push(`Order type: ${details.orderType}`);
    if (details.garmentType) parts.push(`Garment: ${GARMENT_LABELS[details.garmentType as string] || details.garmentType}`);
  } else {
    // garments / screen_print / embroidery
    if (details.intent) parts.push(`Intent: ${details.intent}`);
    if (details.garmentType) parts.push(`Garment: ${GARMENT_LABELS[details.garmentType as string] || details.garmentType}`);
    if (details.poloTier) parts.push(`Tier: ${details.poloTier}`);
    if (details.recommendedDecoration) parts.push(`Decoration: ${details.recommendedDecoration}`);
    if (Array.isArray(details.printLocations) && details.printLocations.length > 0)
      parts.push(`Print locations: ${details.printLocations.join(", ")}`);
    if (Array.isArray(details.embroideryLocations) && details.embroideryLocations.length > 0)
      parts.push(`Embroidery locations: ${details.embroideryLocations.join(", ")}`);
    if (details.printColors) parts.push(`Print colors: ${details.printColors}`);
    if (details.eventDate) parts.push(`Event date: ${details.eventDate}`);
  }

  if (timeline) parts.push(`Timeline: ${TIMELINE_LABELS[timeline] || timeline}`);
  if (artworkNotes) parts.push(`Artwork notes: ${artworkNotes}`);
  if (estimate) parts.push(`Estimate: $${Math.round(estimate.low * 100) / 100}–$${Math.round(estimate.high * 100) / 100}`);

  // Brand/questionnaire fields are stored in decoration_params on line items
  // and displayed as structured fields in the UI — don't duplicate in description

  if (missingFields.length > 0) {
    parts.push(`\n⚠️ MISSING INFO — follow up on: ${missingFields.join(", ")}`);
  }

  return parts.join("\n");
}

/** Build line item row from the website payload */
function buildLineItem(
  quoteId: string,
  serviceType: string,
  quantity: number,
  details: Record<string, unknown>,
  notes: string,
  estimate?: { low: number; high: number } | null,
  artworkUrl?: string | null
) {
  const normalizedServiceType = normalizeServiceType(serviceType);
  const mappedService = SERVICE_TYPE_MAP[normalizedServiceType] || "other";

  // Build a description from the details
  let description = "";
  let styleNumber: string | null = null;
  let color: string | null = null;

  if (normalizedServiceType === "custom_hats") {
    const { hatCode, hatLabel, hatBrand, hatColor, patchLabel } = resolveHatDetails(details);
    const hatFull = [hatBrand, hatLabel].filter(Boolean).join(" ") || "Custom Hat";
    description = [hatFull, patchLabel].filter(Boolean).join(" — ");
    styleNumber = hatCode || null;
    color = hatColor || null;
  } else if (normalizedServiceType === "dtf") {
    const garment = GARMENT_LABELS[details.garmentType as string] || details.garmentType || "DTF Transfers";
    const orderType = details.orderType === "transfers" ? "Loose transfers" : "Finished garments";
    description = `${garment} (${orderType})`;
  } else if (isCrewTeamSubmission(details)) {
    const team = parseTeamSize(details.teamSize);
    description = `Crew outfitting — ${crewItemsLabel(details.itemsLookingFor)}${team ? ` (${team.label} people, qty TBD)` : " (qty TBD)"}`;
    if (!quantity && team) quantity = team.low;
  } else {
    const garment = GARMENT_LABELS[details.garmentType as string] || details.garmentType || "Custom Garment";
    const tier = details.poloTier ? ` — ${details.poloTier}` : "";
    description = `${garment}${tier}`;
  }

  // Decoration params — store all the raw details for reference
  const decorationParams: Record<string, unknown> = { ...details };

  return {
    quote_id: quoteId,
    service_type: mappedService,
    description,
    quantity: quantity || 1,
    sizes: {},
    style_number: styleNumber,
    color,
    image_url: artworkUrl || null,
    placement: Array.isArray(details.printLocations)
      ? details.printLocations.join(", ")
      : Array.isArray(details.embroideryLocations)
        ? details.embroideryLocations.join(", ")
        : null,
    garment_cost: 0,
    garment_markup_pct: 200,
    decoration_cost: 0,
    decoration_params: decorationParams,
    line_total: estimate ? Math.round(estimate.high * 100) / 100 : 0,
    notes: notes || null,
    sort_order: 0,
  };
}

// ── Email builder ─────────────────────────────────────

interface EmailParams {
  customerName: string;
  serviceType?: string;
  quantity: number;
  estimate?: { low: number; high: number } | null;
  timeline?: string;
  eventDate?: string;
  quoteNumber: string;
  artworkNotes?: string;
  details?: Record<string, unknown>;
}

function buildConfirmationEmail(p: EmailParams): string {
  const normalizedServiceType = normalizeServiceType(p.serviceType);
  const serviceLabel =
    normalizedServiceType === "custom_hats" ? "Custom Hats"
    : normalizedServiceType === "embroidery" ? "Embroidery"
    : normalizedServiceType === "screen_print" ? "Screen Printing"
    : normalizedServiceType === "dtf" ? "DTF Transfers"
    : normalizedServiceType === "garments" ? "Custom Garments"
    : "Custom Order";

  // Build summary rows
  const summaryRows: string[] = [];
  summaryRows.push(row("Service", serviceLabel));
  if (p.quantity > 0) summaryRows.push(row("Quantity", `${p.quantity} pieces`));

  if (p.details) {
    if (normalizedServiceType === "custom_hats") {
      const { hatLabel, hatBrand, patchLabel, hatColor } = resolveHatDetails(p.details);
      const hatFull = [hatBrand, hatLabel].filter(Boolean).join(" ");
      if (hatFull) summaryRows.push(row("Hat Style", hatFull));
      if (patchLabel) summaryRows.push(row("Patch Type", patchLabel));
      if (hatColor) summaryRows.push(row("Colors", hatColor));
    } else {
      const garment = GARMENT_LABELS[p.details.garmentType as string] || p.details.garmentType;
      if (garment) summaryRows.push(row("Garment", String(garment)));
      if (p.details.printLocations && Array.isArray(p.details.printLocations))
        summaryRows.push(row("Print Locations", p.details.printLocations.join(", ")));
      if (p.details.embroideryLocations && Array.isArray(p.details.embroideryLocations))
        summaryRows.push(row("Embroidery Locations", p.details.embroideryLocations.join(", ")));
      if (p.details.printColors) summaryRows.push(row("Colors", String(p.details.printColors)));
    }
  }

  if (p.timeline) summaryRows.push(row("Timeline", TIMELINE_LABELS[p.timeline] || p.timeline));
  if (p.eventDate) {
    try {
      summaryRows.push(row("Event Date", new Date(p.eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })));
    } catch { /* skip */ }
  }

  const estimateBlock = p.estimate
    ? `<tr><td colspan="2" style="padding:16px 0 8px 0;">
        <div style="background:#1a1a2e;border-radius:8px;padding:20px;text-align:center;">
          <div style="color:#a0a0b0;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Estimated Range</div>
          <div style="color:#ffffff;font-size:28px;font-weight:700;">$${p.estimate.low.toLocaleString()} – $${p.estimate.high.toLocaleString()}</div>
          <div style="color:#a0a0b0;font-size:12px;margin-top:6px;">Final pricing confirmed after we review your details</div>
        </div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0f0f1a;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">HELL'S CANYON DESIGNS</div>
          <div style="color:#a0a0b0;font-size:13px;margin-top:4px;">Custom Apparel &amp; Headwear — Lewiston, ID</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px;">
          <h1 style="margin:0 0 8px 0;font-size:22px;color:#1a1a2e;">Hey ${p.customerName.split(" ")[0]}! 👋</h1>
          <p style="margin:0 0 24px 0;color:#555;font-size:15px;line-height:1.6;">
            We got your quote request and we're on it. Here's a summary of what you asked for:
          </p>

          <!-- Summary Table -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8ed;border-radius:8px;overflow:hidden;">
            ${summaryRows.join("")}
            ${estimateBlock}
          </table>

          ${p.artworkNotes ? `<div style="margin-top:20px;padding:16px;background:#f8f8fb;border-radius:8px;border-left:4px solid #0f0f1a;">
            <div style="font-size:12px;text-transform:uppercase;color:#888;letter-spacing:0.5px;margin-bottom:4px;">Your Artwork Notes</div>
            <div style="color:#333;font-size:14px;">${escapeHtml(p.artworkNotes)}</div>
          </div>` : ""}

          <!-- Next Steps -->
          <div style="margin-top:32px;padding:24px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
            <h2 style="margin:0 0 12px 0;font-size:16px;color:#166534;">What happens next?</h2>
            <ol style="margin:0;padding-left:20px;color:#333;font-size:14px;line-height:1.8;">
              <li>We review your request (usually within a few hours)</li>
              <li>We'll reach out to confirm sizes, colors, and artwork</li>
              <li>You'll get a final quote with exact pricing</li>
              <li>Once approved, we get to work!</li>
            </ol>
          </div>

          <!-- Artwork disclaimer -->
          <p style="margin:24px 0 0 0;color:#888;font-size:12px;line-height:1.5;">
            <em>For the best print/embroidery results, please have artwork in vector format (.ai, .eps, .svg) or high-resolution PNG (300+ DPI). We can work with most files — just send what you have.</em>
          </p>

          <!-- CTA -->
          <div style="margin-top:32px;text-align:center;">
            <a href="mailto:info@hellscanyondesigns.com" style="display:inline-block;background:#0f0f1a;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">Reply to This Email</a>
          </div>

          <!-- Text CTA -->
          <div style="margin-top:24px;text-align:center;padding:20px;background:#f8f8fb;border-radius:8px;">
            <div style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Prefer to text?</div>
            <a href="sms:2087486242" style="font-size:20px;font-weight:700;color:#0f0f1a;text-decoration:none;">208-748-6242</a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8f8fb;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#aaa;font-size:12px;">
            Hell's Canyon Designs · Lewiston, Idaho<br>
            <a href="https://hellscanyondesigns.com" style="color:#888;">hellscanyondesigns.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:12px 16px;font-size:13px;color:#888;border-bottom:1px solid #f0f0f3;width:40%;">${label}</td>
    <td style="padding:12px 16px;font-size:14px;color:#1a1a2e;font-weight:500;border-bottom:1px solid #f0f0f3;">${value}</td>
  </tr>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Main handler ──────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    const {
      customer_name,
      customer_email,
      customer_phone,
      company,
      customer_company,
      address_line1,
      address_line2,
      city,
      state,
      zip,
      delivery_method,
      shipping_address,
      requested_date,
      notes,
      is_nonprofit,
      apply_sales_tax,
      tax_rate,
      line_items,
      source,
      // Website quote builder fields
      serviceType,
      quantity,
      details,
      timeline,
      artworkNotes,
      artworkUrl,
      estimate,
    } = payload;

    const resolvedCompany = company || customer_company || null;

    if (!customer_name) {
      return new Response(
        JSON.stringify({ error: "customer_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // This endpoint is intentionally public — it backs the quote request form on
    // the marketing site, so anonymous visitors must be able to reach it. It
    // writes with a service-role client though, so everything below is bounded
    // before it touches the database.
    const bad = (error: string) =>
      new Response(JSON.stringify({ error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const oversized = Object.entries({
      customer_name, customer_email, customer_phone, company: resolvedCompany,
      address_line1, address_line2, city, state, zip, notes, details,
      timeline, artworkNotes, artworkUrl, shipping_address,
    }).find(([, value]) => typeof value === "string" && value.length > 2000);
    if (oversized) return bad(`${oversized[0]} exceeds the maximum length`);

    if (customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer_email).trim())) {
      return bad("Invalid customer_email");
    }

    if (line_items !== undefined && (!Array.isArray(line_items) || line_items.length > 200)) {
      return bad("line_items must be an array of at most 200 entries");
    }

    if (quantity !== undefined && quantity !== null) {
      // The Embroidery, Screen Print, and DTF builders send a preset range
      // label here ("6-12", "96+", "not-sure") rather than a number — every
      // submission through those three forms was rejected by this check
      // (added 2026-07-31) since Number("6-12") is NaN. Downstream this value
      // is only ever read via parseInt(...) || 0 (see buildLineItem/totalQty
      // below), which already tolerates a label like that gracefully, so a
      // non-numeric quantity only needs a sane length bound, not strict
      // numeric validation — that's still enforced for real numeric input
      // (Hats, Custom Apparel, Leather, Wholesale Patches all send an actual
      // number and keep getting the full range/finite check).
      const quantityStr = String(quantity);
      const parsedQuantity = Number(quantityStr.trim());
      // Number() (unlike parseInt) requires the *whole* string to be a valid
      // numeric literal, so it doubles as the numeric/label discriminator:
      // "-5" and "48" parse (and still get the full range check below);
      // "6-12" and "not-sure" don't, and fall through to the length check.
      const isNumeric = Number.isFinite(parsedQuantity) && quantityStr.trim() !== "";
      if (isNumeric) {
        if (parsedQuantity < 0 || parsedQuantity > 1_000_000) {
          return bad("Invalid quantity");
        }
      } else if (quantityStr.length > 50) {
        return bad("Invalid quantity");
      }
    }

    // ── Duplicate / double-submit guard ────────────────────
    // If the same email submitted a quote in the last 60 seconds, return it
    // instead of creating a duplicate.
    const dedupeEmail = (customer_email || "").trim().toLowerCase();
    if (dedupeEmail) {
      const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
      const { data: recentQuote } = await serviceClient
        .from("quotes")
        .select("id, quote_number")
        .ilike("customer_email", dedupeEmail)
        .gte("created_at", sixtySecondsAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentQuote) {
        console.log(`Duplicate submission blocked for ${dedupeEmail} — existing quote ${recentQuote.quote_number}`);
        return new Response(
          JSON.stringify({
            success: true,
            duplicate: true,
            quoteId: recentQuote.id,
            quoteNumber: recentQuote.quote_number,
            message: "Quote already received — thank you!",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 1. Find or create customer
    let customerId: string | null = null;
    const email = customer_email?.trim().toLowerCase();
    const phone = customer_phone?.trim();

    if (email) {
      const { data: existing } = await serviceClient
        .from("customers")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (existing) customerId = existing.id;
    }

    if (!customerId && phone) {
      const { data: existing } = await serviceClient
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      if (existing) customerId = existing.id;
    }

    if (!customerId) {
      const { data: newCustomer, error: custErr } = await serviceClient
        .from("customers")
        .insert({
          name: customer_name,
          email: email || null,
          phone: phone || null,
          company: resolvedCompany,
          address_line1: address_line1 || null,
          address_line2: address_line2 || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          source: source || "website",
        })
        .select("id")
        .single();

      if (custErr) {
        console.error("Customer create error:", custErr);
        return new Response(
          JSON.stringify({ error: "Failed to create customer", details: custErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      customerId = newCustomer.id;
    }

    const normalizedServiceType = normalizeServiceType(serviceType);
    const normalizedDetails = (details && typeof details === "object" && !Array.isArray(details))
      ? details as Record<string, unknown>
      : {};

    // 2. Build enriched notes for the quote
    const detailDescription = Object.keys(normalizedDetails).length > 0
      ? buildDescription(normalizedServiceType, normalizedDetails, timeline, artworkNotes, estimate)
      : "";
    const fullNotes = [notes, detailDescription].filter(Boolean).join("\n\n---\n");

    // 3. Create quote
    const { data: quote, error: quoteErr } = await serviceClient
      .from("quotes")
      .insert({
        customer_name,
        customer_email: email || null,
        customer_phone: phone || null,
        customer_id: customerId,
        company: resolvedCompany,
        address_line1: address_line1 || null,
        address_line2: address_line2 || null,
        city: city || null,
        state: state || "ID",
        zip: zip || null,
        delivery_method: delivery_method || "pickup",
        shipping_address: shipping_address || null,
        requested_date: requested_date || null,
        notes: fullNotes || null,
        is_nonprofit: is_nonprofit ?? false,
        apply_sales_tax: apply_sales_tax ?? true,
        tax_rate: tax_rate ?? 6.0,
        status: "draft",
      })
      .select("id, quote_number")
      .single();

    if (quoteErr) {
      console.error("Quote create error:", quoteErr);
      return new Response(
        JSON.stringify({ error: "Failed to create quote", details: quoteErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Create quote line items
    let resolvedLineItems = line_items;

    // If no explicit line_items but we have details from the website builder, synthesize one
    if ((!Array.isArray(resolvedLineItems) || resolvedLineItems.length === 0) && Object.keys(normalizedDetails).length > 0) {
      const qty = parseInt(String(quantity), 10) || 0;
      resolvedLineItems = [buildLineItem(quote.id, normalizedServiceType, qty, normalizedDetails, notes || "", estimate, artworkUrl)];
    }

    if (Array.isArray(resolvedLineItems) && resolvedLineItems.length > 0) {
      const rows = resolvedLineItems.map((item: any, idx: number) => ({
        quote_id: quote.id,
        service_type: item.service_type || "other",
        description: item.description || null,
        quantity: item.quantity || 1,
        sizes: item.sizes || {},
        style_number: item.style_number || null,
        color: item.color || null,
        placement: item.placement || null,
        garment_cost: item.garment_cost ?? 0,
        garment_markup_pct: item.garment_markup_pct ?? 200,
        decoration_cost: item.decoration_cost ?? 0,
        decoration_params: item.decoration_params || {},
        image_url: item.image_url || null,
        line_total: item.line_total ?? 0,
        notes: item.notes || null,
        sort_order: idx,
      }));

      const { error: liErr } = await serviceClient
        .from("quote_line_items")
        .insert(rows);

      if (liErr) {
        console.error("Line items error:", liErr);
      }

      // Auto-sync artwork to Dropbox (fire and forget)
      const dropboxToken = Deno.env.get("DROPBOX_ACCESS_TOKEN");
      if (dropboxToken) {
        for (const row of rows) {
          if (row.image_url && typeof row.image_url === "string" && row.image_url.includes("/storage/v1/object/public/quote-artwork/")) {
            try {
              const artFilename = decodeURIComponent(row.image_url.split("/").pop() || "artwork");
              const safeName = customer_name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Unknown";
              const dropboxPath = `/${safeName}/${artFilename}`;

              const fileRes = await fetch(row.image_url);
              if (fileRes.ok) {
                const fileBuffer = await fileRes.arrayBuffer();
                const dbxRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${dropboxToken}`,
                    "Dropbox-API-Arg": JSON.stringify({ path: dropboxPath, mode: "add", autorename: true, mute: false }),
                    "Content-Type": "application/octet-stream",
                  },
                  body: fileBuffer,
                });
                if (dbxRes.ok) {
                  const dbxResult = await dbxRes.json();
                  console.log("Auto-synced artwork to Dropbox:", dbxResult.path_display);
                } else {
                  console.error("Dropbox auto-sync failed:", dbxRes.status, await dbxRes.text());
                }
              }
            } catch (dbxErr) {
              console.error("Dropbox auto-sync error:", dbxErr);
            }
          }
        }
      }
    }

    // 5. Build action item title
    const serviceLabel = SERVICE_TITLE_LABELS[normalizedServiceType] || serviceType || "Quote";
    const totalQty = Array.isArray(resolvedLineItems)
      ? resolvedLineItems.reduce((sum: number, li: any) => sum + (parseInt(String(li.quantity), 10) || 0), 0)
      : parseInt(String(quantity), 10) || 0;

    const crewTeam = isCrewTeamSubmission(normalizedDetails, source);
    const crewSize = crewTeam ? parseTeamSize(normalizedDetails.teamSize) : null;
    const actionTitle = crewTeam
      ? `Website Quote: ${customer_name}${resolvedCompany ? ` (${resolvedCompany})` : ""} — Crew Outfitting, ${crewSize ? `${crewSize.label} people` : "qty TBD"}`
      : `Website Quote: ${customer_name} — ${serviceLabel} (${totalQty} pcs)`;

    // Build rich description for the action item
    const actionDescParts = [
      `Quote ${quote.quote_number || quote.id} submitted from website.`,
    ];
    if (resolvedCompany) actionDescParts.push(`Company: ${resolvedCompany}`);
    if (detailDescription) actionDescParts.push(detailDescription);
    if (notes && !detailDescription.includes(notes)) actionDescParts.push(`Notes: ${notes}`);
    // Suggested pricing (internal only) — same rules as the email intake
    try {
      actionDescParts.push(...await websitePricingLines(serviceClient, normalizedServiceType, normalizedDetails, crewTeam ? 0 : totalQty));
    } catch (e) {
      console.error("website pricing lines failed:", e);
    }

    // 6. Build auto-checklist for missing info
    const autoChecklist: Array<{ id: string; text: string; done: boolean }> = [];
    if (Object.keys(normalizedDetails).length > 0 && normalizedServiceType === "custom_hats") {
      const { patchLabel, hatLabel, hatColor } = resolveHatDetails(normalizedDetails);
      if (!hatLabel) autoChecklist.push({ id: crypto.randomUUID(), text: "Confirm hat style (Richardson 112, etc.)", done: false });
      if (!hatColor) autoChecklist.push({ id: crypto.randomUUID(), text: "Confirm hat colors", done: false });
      if (!patchLabel) autoChecklist.push({ id: crypto.randomUUID(), text: "Confirm patch type (laser leather, UV, etc.)", done: false });
    }
    if (crewTeam) {
      autoChecklist.push({ id: crypto.randomUUID(), text: "Get exact quantity + size breakdown", done: false });
      autoChecklist.push({ id: crypto.randomUUID(), text: "Confirm items (shirts / hats) and Good / Better / Best garment", done: false });
      autoChecklist.push({ id: crypto.randomUUID(), text: "Confirm print locations (left chest, back, etc.)", done: false });
    }
    autoChecklist.push({ id: crypto.randomUUID(), text: "Review artwork / logo files", done: false });
    autoChecklist.push({ id: crypto.randomUUID(), text: "Send final quote to customer", done: false });

    // 7. Create action item for follow-up
    // created_by is left null — this is the public website endpoint, so there's
    // no authenticated team member to attribute it to. fanout_action_item_new()
    // already treats a null created_by as "no specific owner" and notifies
    // everyone, so this is the value that trigger was designed for.
    const { error: aiErr } = await serviceClient
      .from("action_items")
      .insert({
        title: actionTitle,
        description: actionDescParts.join("\n"),
        customer_name,
        customer_email: email || null,
        customer_phone: phone || null,
        customer_id: customerId,
        quote_id: quote.id,
        source: "website",
        priority: "high",
        status: "open",
        checklist: autoChecklist,
      });

    if (aiErr) {
      console.error("Action item error:", aiErr);
      // The quote itself is already saved — never fail the customer-facing
      // response over this. But a failure here used to be completely silent
      // (nothing but a log line nobody was watching), which is how quotes went
      // unactioned for weeks. Best-effort alert a human instead.
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const alertEmail = Deno.env.get("NEW_QUOTE_ALERT_EMAIL");
        if (resendApiKey && alertEmail) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Hell's Canyon Designs <alerts@hellscanyondesigns.com>",
              to: [alertEmail],
              subject: `Action item failed to create for quote ${quote.quote_number || quote.id}`,
              html: `<p>Quote <strong>${quote.quote_number || quote.id}</strong> from ${escapeHtml(customer_name)} was saved, but its action item failed to create and needs manual follow-up.</p><p>Error: ${escapeHtml(aiErr.message)}</p>`,
            }),
          });
        }
      } catch (alertErr) {
        console.error("Action item failure alert also failed:", alertErr);
      }
    }

    // 7. Notify Phil that a new action item arrived (fire-and-forget)
    // This was missing — action items were created silently with no alert.
    // Skipped when the insert failed (the failure alert above already went out).
    if (!aiErr) try {
      await serviceClient.functions.invoke("notify-new-action-item", {
        body: {
          action_item: {
            title: actionTitle,
            description: actionDescParts.join("\n"),
            customer_name,
            source: "website",
            priority: "high",
          },
        },
      });
    } catch (notifyErr) {
      console.error("New action item notification failed:", notifyErr);
      // Never let this block the quote — the action item is already saved.
    }

    // 8. Send confirmation email to customer
    if (email) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const emailHtml = buildConfirmationEmail({
            customerName: customer_name,
            serviceType: normalizedServiceType,
            quantity: totalQty,
            estimate,
            timeline,
            eventDate: normalizedDetails.eventDate as string | undefined,
            quoteNumber: quote.quote_number || quote.id,
            artworkNotes,
            details: Object.keys(normalizedDetails).length > 0 ? normalizedDetails : undefined,
          });

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Hell's Canyon Designs <info@mail.hellscanyondesigns.com>",
              to: [email],
              subject: `We got your quote request! — Hell's Canyon Designs`,
              html: emailHtml,
              reply_to: "info@hellscanyondesigns.com",
            }),
          });

          if (!emailRes.ok) {
            const errBody = await emailRes.text();
            console.error("Resend email error:", emailRes.status, errBody);
          } else {
            console.log("Confirmation email sent to", email);
          }
        } else {
          console.warn("RESEND_API_KEY not configured, skipping confirmation email");
        }
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
        // Don't fail the whole request if email fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        quote_id: quote.id,
        quote_number: quote.quote_number,
        customer_id: customerId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("create-quote-action-item error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
