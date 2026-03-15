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
    const { quoteId } = body;
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

    // --- Step 1: Find or create customer ---
    let contactId: string | null = null;

    if (quote.customer_email) {
      // Search by email
      const searchData = await makePrintavoRequest(
        `query SearchContacts($query: String!) {
          contacts(first: 5, query: $query) {
            nodes { id fullName email }
          }
        }`,
        { query: quote.customer_email }
      );
      const matchingContact = searchData.contacts?.nodes?.find(
        (c: any) => c.email?.toLowerCase() === quote.customer_email.toLowerCase()
      );
      if (matchingContact) {
        contactId = matchingContact.id;
        console.log(`Found existing Printavo contact: ${contactId}`);
      }
    }

    if (!contactId) {
      // Create new contact
      const createData = await makePrintavoRequest(
        `mutation CreateContact($input: ContactInput!) {
          contactCreate(input: $input) {
            contact { id fullName email }
            errors { message }
          }
        }`,
        {
          input: {
            fullName: quote.customer_name,
            email: quote.customer_email || undefined,
            phone: quote.customer_phone || undefined,
          },
        }
      );
      if (createData.contactCreate?.errors?.length) {
        throw new Error(createData.contactCreate.errors[0].message);
      }
      contactId = createData.contactCreate.contact.id;
      console.log(`Created Printavo contact: ${contactId}`);
    }

    // --- Step 2: Build line item groups ---
    // Printavo expects lineItemGroups with lineItems inside them
    // We'll create one group per line item for simplicity
    const lineItemGroupInputs = lineItems.map((li: any) => {
      // Build sizes object for Printavo: { sizeS: count, sizeM: count, ... }
      const sizeMapping: Record<string, string> = {
        XS: "sizeXs",
        S: "sizeS",
        M: "sizeM",
        L: "sizeL",
        XL: "sizeXl",
        "2XL": "size2xl",
        "3XL": "size3xl",
        "4XL": "size4xl",
        "5XL": "size5xl",
      };

      const sizeInputs: Record<string, number> = {};
      if (li.sizes && typeof li.sizes === "object") {
        for (const [size, qty] of Object.entries(li.sizes)) {
          const key = sizeMapping[size.toUpperCase()] || sizeMapping[size];
          if (key && typeof qty === "number" && qty > 0) {
            sizeInputs[key] = qty;
          }
        }
      }

      return {
        description: li.description || li.style_number || "Line Item",
        lineItems: [
          {
            color: li.color || null,
            description: li.description || li.style_number || "",
            itemNumber: li.style_number || null,
            items: li.quantity || 1,
            ...sizeInputs,
          },
        ],
      };
    });

    // --- Step 3: Create the invoice ---
    const noteParts: string[] = [];
    if (quote.notes) noteParts.push(quote.notes);
    if (quote.delivery_method) noteParts.push(`Delivery: ${quote.delivery_method}`);
    if (quote.shipping_address) noteParts.push(`Ship to: ${quote.shipping_address}`);
    if (quote.is_nonprofit) noteParts.push("⚠️ Nonprofit");
    if (quote.po_number) noteParts.push(`PO: ${quote.po_number}`);
    const productionNote = noteParts.join("\n") || null;

    const invoiceInput: Record<string, unknown> = {
      contactId,
      productionNote,
    };

    if (quote.requested_date) {
      invoiceInput.customerDueAt = quote.requested_date;
    }

    if (lineItemGroupInputs.length > 0) {
      invoiceInput.lineItemGroups = lineItemGroupInputs;
    }

    console.log("Creating Printavo invoice with input:", JSON.stringify(invoiceInput, null, 2));

    const invoiceData = await makePrintavoRequest(
      `mutation CreateInvoice($input: InvoiceCreateInput!) {
        invoiceCreate(input: $input) {
          invoice {
            id
            visualId
          }
          errors { message }
        }
      }`,
      { input: invoiceInput }
    );

    if (invoiceData.invoiceCreate?.errors?.length) {
      throw new Error(invoiceData.invoiceCreate.errors[0].message);
    }

    const printavoInvoice = invoiceData.invoiceCreate.invoice;
    console.log(`Created Printavo invoice: ${printavoInvoice.id} (Visual ID: ${printavoInvoice.visualId})`);

    // --- Step 4: Link back to the quote ---
    // Use service role to update since the quote may not have RLS for the user
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient
      .from("quotes")
      .update({
        printavo_order_id: printavoInvoice.id,
        printavo_visual_id: printavoInvoice.visualId,
        status: "sent",
      })
      .eq("id", quoteId);

    return new Response(
      JSON.stringify({
        success: true,
        printavoOrderId: printavoInvoice.id,
        printavoVisualId: printavoInvoice.visualId,
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
