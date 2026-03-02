import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    } = payload;

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

      if (existing) {
        customerId = existing.id;
      }
    }

    if (!customerId && phone) {
      const { data: existing } = await serviceClient
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();

      if (existing) {
        customerId = existing.id;
      }
    }

    if (!customerId) {
      const { data: newCustomer, error: custErr } = await serviceClient
        .from("customers")
        .insert({
          name: customer_name,
          email: email || null,
          phone: phone || null,
          company: company || null,
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

    // 2. Create quote
    const { data: quote, error: quoteErr } = await serviceClient
      .from("quotes")
      .insert({
        customer_name,
        customer_email: email || null,
        customer_phone: phone || null,
        customer_id: customerId,
        company: company || null,
        address_line1: address_line1 || null,
        address_line2: address_line2 || null,
        city: city || null,
        state: state || state || "ID",
        zip: zip || null,
        delivery_method: delivery_method || "pickup",
        shipping_address: shipping_address || null,
        requested_date: requested_date || null,
        notes: notes || null,
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

    // 3. Create quote line items
    if (Array.isArray(line_items) && line_items.length > 0) {
      const rows = line_items.map((item: any, idx: number) => ({
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

    // 4. Build service summary for action item title
    const serviceTypes = Array.isArray(line_items)
      ? [...new Set(line_items.map((li: any) => li.service_type || "other"))].join(", ")
      : "quote";

    const totalQty = Array.isArray(line_items)
      ? line_items.reduce((sum: number, li: any) => sum + (li.quantity || 1), 0)
      : 0;

    // 5. Create action item for follow-up
    // Use service role to bypass created_by RLS — set a placeholder UUID
    const { error: aiErr } = await serviceClient
      .from("action_items")
      .insert({
        title: `Website Quote: ${customer_name} — ${serviceTypes} (${totalQty} pcs)`,
        description: `Quote ${quote.quote_number || quote.id} submitted from website.\n${company ? `Company: ${company}\n` : ""}${notes ? `Notes: ${notes}` : ""}`,
        customer_name,
        customer_email: email || null,
        customer_phone: phone || null,
        customer_id: customerId,
        quote_id: quote.id,
        source: "website",
        priority: "high",
        status: "open",
        created_by: "00000000-0000-0000-0000-000000000000", // system-generated
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
