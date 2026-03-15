import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const hatCode = readDetailString(details, ["hatStyle", "hatModel", "style_number", "style"]);
  const hatLabel = HAT_LABELS[hatCode] || (hatCode ? toDisplayLabel(hatCode) : "");

  const hatColorRaw = readDetailString(details, ["hatColors", "hatColor", "colors"]);
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
    hatColor,
    patchLabel,
  };
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
    const { hatLabel, hatColor, patchLabel } = resolveHatDetails(details);

    parts.push(`Patch: ${patchLabel || "⚠️ Not specified"}`);
    parts.push(`Hat: ${hatLabel || "⚠️ Not specified"}`);
    parts.push(`Colors: ${hatColor || "⚠️ Not specified"}`);

    if (!patchLabel) missingFields.push("patch type");
    if (!hatLabel) missingFields.push("hat style");
    if (!hatColor) missingFields.push("hat colors");
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
  if (estimate) parts.push(`Estimate: $${estimate.low}–$${estimate.high}`);

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
  estimate?: { low: number; high: number } | null
) {
  const normalizedServiceType = normalizeServiceType(serviceType);
  const mappedService = SERVICE_TYPE_MAP[normalizedServiceType] || "other";

  // Build a description from the details
  let description = "";
  let styleNumber: string | null = null;
  let color: string | null = null;

  if (normalizedServiceType === "custom_hats") {
    const { hatCode, hatLabel, hatColor, patchLabel } = resolveHatDetails(details);
    description = [hatLabel || "Custom Hat", patchLabel].filter(Boolean).join(" — ");
    styleNumber = hatCode || null;
    color = hatColor || null;
  } else if (normalizedServiceType === "dtf") {
    const garment = GARMENT_LABELS[details.garmentType as string] || details.garmentType || "DTF Transfers";
    const orderType = details.orderType === "transfers" ? "Loose transfers" : "Finished garments";
    description = `${garment} (${orderType})`;
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
    placement: Array.isArray(details.printLocations)
      ? details.printLocations.join(", ")
      : Array.isArray(details.embroideryLocations)
        ? details.embroideryLocations.join(", ")
        : null,
    garment_cost: 0,
    garment_markup_pct: 200,
    decoration_cost: 0,
    decoration_params: decorationParams,
    line_total: estimate ? estimate.high : 0,
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
  const serviceLabel =
    p.serviceType === "custom_hats" ? "Custom Hats"
    : p.serviceType === "embroidery" ? "Embroidery"
    : p.serviceType === "screen_print" ? "Screen Printing"
    : p.serviceType === "dtf" ? "DTF Transfers"
    : p.serviceType === "garments" ? "Custom Garments"
    : "Custom Order";

  // Build summary rows
  const summaryRows: string[] = [];
  summaryRows.push(row("Service", serviceLabel));
  if (p.quantity > 0) summaryRows.push(row("Quantity", `${p.quantity} pieces`));

  if (p.details) {
    if (p.serviceType === "custom_hats") {
      const hat = HAT_LABELS[p.details.hatStyle as string] || p.details.hatStyle;
      const patch = PATCH_LABELS[p.details.patchType as string] || p.details.patchType;
      if (hat) summaryRows.push(row("Hat Style", String(hat)));
      if (patch) summaryRows.push(row("Patch Type", String(patch)));
      if (p.details.hatColors) summaryRows.push(row("Colors", String(p.details.hatColors)));
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
      estimate,
    } = payload;

    const resolvedCompany = company || customer_company || null;

    if (!customer_name) {
      return new Response(
        JSON.stringify({ error: "customer_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // 2. Build enriched notes for the quote
    const detailDescription = details
      ? buildDescription(serviceType || "other", details, timeline, artworkNotes, estimate)
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
    if ((!Array.isArray(resolvedLineItems) || resolvedLineItems.length === 0) && details && serviceType) {
      const qty = parseInt(String(quantity), 10) || 0;
      resolvedLineItems = [buildLineItem(quote.id, serviceType, qty, details, notes || "", estimate)];
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
    }

    // 5. Build action item title
    const serviceLabel = SERVICE_TYPE_MAP[serviceType] || serviceType || "quote";
    const totalQty = Array.isArray(resolvedLineItems)
      ? resolvedLineItems.reduce((sum: number, li: any) => sum + (parseInt(String(li.quantity), 10) || 0), 0)
      : parseInt(String(quantity), 10) || 0;

    const actionTitle = `Website Quote: ${customer_name} — ${serviceLabel} (${totalQty} pcs)`;

    // Build rich description for the action item
    const actionDescParts = [
      `Quote ${quote.quote_number || quote.id} submitted from website.`,
    ];
    if (resolvedCompany) actionDescParts.push(`Company: ${resolvedCompany}`);
    if (detailDescription) actionDescParts.push(detailDescription);
    if (notes && !detailDescription.includes(notes)) actionDescParts.push(`Notes: ${notes}`);

    // 6. Build auto-checklist for missing info
    const autoChecklist: Array<{ id: string; text: string; done: boolean }> = [];
    if (details && serviceType === "custom_hats") {
      const hasPatch = !!(PATCH_LABELS[details.patchType as string] || details.patchType);
      const hasHat = !!(HAT_LABELS[details.hatStyle as string] || details.hatStyle);
      const hasColors = !!details.hatColors;
      if (!hasHat) autoChecklist.push({ id: crypto.randomUUID(), text: "Confirm hat style (Richardson 112, etc.)", done: false });
      if (!hasColors) autoChecklist.push({ id: crypto.randomUUID(), text: "Confirm hat colors", done: false });
      if (!hasPatch) autoChecklist.push({ id: crypto.randomUUID(), text: "Confirm patch type (laser leather, UV, etc.)", done: false });
    }
    autoChecklist.push({ id: crypto.randomUUID(), text: "Review artwork / logo files", done: false });
    autoChecklist.push({ id: crypto.randomUUID(), text: "Send final quote to customer", done: false });

    // 7. Create action item for follow-up
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
        created_by: "00000000-0000-0000-0000-000000000000",
        checklist: autoChecklist,
      });

    if (aiErr) {
      console.error("Action item error:", aiErr);
    }

    // 7. Send confirmation email to customer
    if (email) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const emailHtml = buildConfirmationEmail({
            customerName: customer_name,
            serviceType,
            quantity: totalQty,
            estimate,
            timeline,
            eventDate: details?.eventDate as string | undefined,
            quoteNumber: quote.quote_number || quote.id,
            artworkNotes,
            details,
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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
