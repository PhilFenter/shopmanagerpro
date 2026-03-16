import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const printavoEmail = Deno.env.get("PRINTAVO_API_EMAIL");
    const printavoToken = Deno.env.get("PRINTAVO_API_TOKEN");
    if (!printavoEmail || !printavoToken) {
      return new Response(
        JSON.stringify({ error: "Printavo API credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { quoteId, customerName: overrideName, customerEmail: overrideEmail, customerPhone: overridePhone } = body;
    if (!quoteId) {
      return new Response(
        JSON.stringify({ error: "quoteId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch quote + line items
    const [quoteRes, lineItemsRes] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", quoteId).single(),
      supabase.from("quote_line_items").select("*").eq("quote_id", quoteId).order("sort_order"),
    ]);

    if (quoteRes.error || !quoteRes.data) {
      return new Response(
        JSON.stringify({ error: "Quote not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const quote = quoteRes.data;
    const lineItems = lineItemsRes.data ?? [];

    // Apply overrides from action item if quote fields are empty
    const effectiveName = quote.customer_name || overrideName || "Unknown";
    const effectiveEmail = quote.customer_email || overrideEmail || null;
    const effectivePhone = quote.customer_phone || overridePhone || null;
    const effectiveCompany = quote.company || null;

    // Check if already pushed
    if (quote.printavo_order_id) {
      return new Response(
        JSON.stringify({
          error: `Already pushed to Printavo as #${quote.printavo_visual_id || quote.printavo_order_id}`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Printavo GraphQL helper ---
    const makePrintavoRequest = async (gqlQuery: string, variables: Record<string, unknown>) => {
      const res = await fetch(PRINTAVO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          email: printavoEmail,
          token: printavoToken,
        },
        body: JSON.stringify({ query: gqlQuery, variables }),
      });
      const json = await res.json();
      if (json.errors) {
        console.error("Printavo GraphQL errors:", JSON.stringify(json.errors));
        throw new Error(json.errors[0]?.message || "Printavo API error");
      }
      return json.data;
    };

    // --- Step 1: Find contact by email, or create customer + primary contact ---
    let contactId: string | null = null;

    if (effectiveEmail) {
      const searchData = await makePrintavoRequest(
        `query SearchContacts($query: String!) {
          contacts(first: 5, query: $query) {
            nodes { id fullName email }
          }
        }`,
        { query: effectiveEmail }
      );

      const matchingContact = searchData.contacts?.nodes?.find(
        (c: any) => c.email?.toLowerCase() === effectiveEmail.toLowerCase()
      );

      if (matchingContact) {
        contactId = matchingContact.id;
        console.log(`Found existing Printavo contact: ${contactId}`);
      }
    }

    if (!contactId) {
      const fullName = (effectiveName).trim();
      const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
      const lastName = rest.join(" ") || undefined;

      // Build billing address from quote data
      const billingAddress: Record<string, unknown> = {};
      if (effectiveCompany) billingAddress.company = effectiveCompany;
      if (effectiveName) billingAddress.name = effectiveName;
      if (effectivePhone) billingAddress.phone = effectivePhone;
      if (quote.address_line1) billingAddress.address1 = quote.address_line1;
      if (quote.address_line2) billingAddress.address2 = quote.address_line2;
      if (quote.city) billingAddress.city = quote.city;
      if (quote.state) billingAddress.state = quote.state;
      if (quote.zip) billingAddress.zip = quote.zip;
      billingAddress.country = "United States";

      const customerData = await makePrintavoRequest(
        `mutation CreateCustomer($input: CustomerCreateInput!) {
          customerCreate(input: $input) {
            id
            primaryContact {
              id
              fullName
              email
            }
          }
        }`,
        {
          input: {
            companyName: effectiveCompany || effectiveName,
            primaryContact: {
              firstName: firstName || effectiveName,
              lastName,
              email: effectiveEmail ? [effectiveEmail] : undefined,
              phone: effectivePhone || undefined,
            },
            ...(Object.keys(billingAddress).length > 1 ? { billingAddress, shippingAddress: billingAddress } : {}),
          },
        }
      );

      contactId = customerData.customerCreate?.primaryContact?.id ?? null;
      if (!contactId) {
        throw new Error("Failed to create/find Printavo contact");
      }

      console.log(`Created Printavo customer + primary contact: ${contactId}`);
    }

    // --- Step 2: Build line item groups for quoteCreate ---
    const sizeEnumMap: Record<string, string> = {
      XS: "size_xs",
      S: "size_s",
      M: "size_m",
      L: "size_l",
      XL: "size_xl",
      "2XL": "size_2xl",
      "3XL": "size_3xl",
      "4XL": "size_4xl",
      "5XL": "size_5xl",
      YXS: "size_yxs",
      YS: "size_ys",
      YM: "size_ym",
      YL: "size_yl",
      YXL: "size_yxl",
    };

    const toLineItemSizes = (sizesRaw: unknown, fallbackQty: number) => {
      const sizeCounts: Record<string, number> = {};

      if (sizesRaw && typeof sizesRaw === "object" && !Array.isArray(sizesRaw)) {
        for (const [size, qty] of Object.entries(sizesRaw as Record<string, unknown>)) {
          if (typeof qty !== "number" || qty <= 0) continue;
          const normalized = size.trim().toUpperCase();
          const sizeKey = sizeEnumMap[normalized] ?? "size_other";
          sizeCounts[sizeKey] = (sizeCounts[sizeKey] ?? 0) + qty;
        }
      }

      if (Object.keys(sizeCounts).length === 0 && fallbackQty > 0) {
        sizeCounts.size_other = fallbackQty;
      }

      return Object.entries(sizeCounts).map(([size, count]) => ({ size, count }));
    };

    const lineItemGroupInputs = lineItems.map((li: any, index: number) => {
      const quantity = typeof li.quantity === "number" && li.quantity > 0 ? li.quantity : 1;
      const unitPrice =
        typeof li.line_total === "number" && quantity > 0
          ? Number((li.line_total / quantity).toFixed(2))
          : typeof li.garment_cost === "number"
            ? li.garment_cost
            : undefined;

      return {
        position: index + 1,
        lineItems: [
          {
            position: 1,
            color: li.color || undefined,
            description: li.description || li.style_number || `Line item ${index + 1}`,
            itemNumber: li.style_number || undefined,
            price: unitPrice,
            sizes: toLineItemSizes(li.sizes, quantity),
          },
        ],
      };
    });

    // --- Step 3: Create the quote ---
    // Build concise production note from line items (not raw quote notes)
    const prodParts: string[] = [];
    for (const li of lineItems) {
      const desc = li.description || li.style_number || "Line item";
      const color = li.color ? ` — ${li.color}` : "";
      const qty = li.quantity || 1;
      prodParts.push(`${desc}${color} × ${qty}`);

      // Add patch/decoration details from decoration_params if present
      const params = li.decoration_params as Record<string, unknown> | null;
      if (params) {
        const patchShape = params.patchShape || params.shape;
        const patchSize = params.patchSize || params.size;
        const leatherColor = params.leatherColor;
        const patchParts = [
          patchShape ? `Shape: ${patchShape}` : "",
          patchSize ? `Size: ${patchSize}` : "",
          leatherColor ? `Leather: ${leatherColor}` : "",
        ].filter(Boolean);
        if (patchParts.length > 0) prodParts.push(`  ${patchParts.join(" · ")}`);
      }
    }
    if (quote.delivery_method) prodParts.push(`Delivery: ${quote.delivery_method}`);
    if (quote.shipping_address) prodParts.push(`Ship to: ${quote.shipping_address}`);
    if (quote.is_nonprofit) prodParts.push("⚠️ Nonprofit");
    if (quote.po_number) prodParts.push(`PO: ${quote.po_number}`);
    const productionNote = prodParts.join("\n") || undefined;

    const now = new Date();
    const dueDate = quote.requested_date ? new Date(quote.requested_date) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const customerDueAt = dueDate.toISOString().split("T")[0];
    const dueAt = dueDate.toISOString();

    const quoteInput: Record<string, unknown> = {
      contact: { id: contactId },
      customerDueAt,
      dueAt,
      productionNote,
      lineItemGroups: lineItemGroupInputs,
      visualPoNumber: quote.po_number || undefined,
    };

    console.log("Creating Printavo quote with input:", JSON.stringify(quoteInput, null, 2));

    const quoteData = await makePrintavoRequest(
      `mutation CreateQuote($input: QuoteCreateInput!) {
        quoteCreate(input: $input) {
          id
          visualId
          publicUrl
          url
        }
      }`,
      { input: quoteInput }
    );

    const printavoQuote = quoteData.quoteCreate;
    if (!printavoQuote?.id) {
      throw new Error("Printavo quote creation failed");
    }

    console.log(`Created Printavo quote: ${printavoQuote.id} (Visual ID: ${printavoQuote.visualId})`);

    // --- Step 4: Link back to the quote ---
    // Use service role to update since the quote may not have RLS for the user
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient
      .from("quotes")
      .update({
        printavo_order_id: printavoQuote.id,
        printavo_visual_id: printavoQuote.visualId,
        status: "sent",
      })
      .eq("id", quoteId);

    return new Response(
      JSON.stringify({
        success: true,
        printavoOrderId: printavoQuote.id,
        printavoVisualId: printavoQuote.visualId,
        contactId,
        lineItems: lineItems.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Push to Printavo error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
