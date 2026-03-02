import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ───────────────────────────────────────────

const SERVICE_TYPE_MAP: Record<string, string> = {
  custom_hats: "leather_patch",
  embroidery: "embroidery",
  screen_print: "screen_print",
  dtf: "dtf",
  garments: "other",
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

/** Build a human-readable description from details */
function buildDescription(
  serviceType: string,
  details: Record<string, unknown>,
  timeline?: string,
  artworkNotes?: string,
  estimate?: { low: number; high: number } | null
): string {
  const parts: string[] = [];

  if (serviceType === "custom_hats") {
    const patch = PATCH_LABELS[details.patchType as string] || details.patchType || "";
    const hat = HAT_LABELS[details.hatStyle as string] || details.hatStyle || "";
    if (patch) parts.push(`Patch: ${patch}`);
    if (hat) parts.push(`Hat: ${hat}`);
    if (details.hatColors) parts.push(`Colors: ${details.hatColors}`);
  } else if (serviceType === "dtf") {
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
  const mappedService = SERVICE_TYPE_MAP[serviceType] || "other";

  // Build a description from the details
  let description = "";
  if (serviceType === "custom_hats") {
    const hat = HAT_LABELS[details.hatStyle as string] || details.hatStyle || "Custom Hat";
    const patch = PATCH_LABELS[details.patchType as string] || details.patchType || "";
    description = `${hat} — ${patch}`;
  } else if (serviceType === "dtf") {
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
    style_number: null,
    color: (details.hatColors as string) || null,
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

    // 6. Create action item for follow-up
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
      });

    if (aiErr) {
      console.error("Action item error:", aiErr);
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
