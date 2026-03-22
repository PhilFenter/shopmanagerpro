import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const printavoEmail = Deno.env.get("PRINTAVO_API_EMAIL");
    const printavoToken = Deno.env.get("PRINTAVO_API_TOKEN");
    if (!printavoEmail || !printavoToken) {
      throw new Error("Printavo API credentials not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch existing Printavo quote IDs so we skip duplicates
    const { data: existingQuotes } = await supabase
      .from("quotes")
      .select("printavo_order_id")
      .not("printavo_order_id", "is", null);

    const existingIds = new Set(
      (existingQuotes || []).map((q: any) => q.printavo_order_id)
    );

    // Query Printavo for all open quotes (paginated)
    const makePrintavoRequest = async (query: string, variables: Record<string, unknown>) => {
      const res = await fetch(PRINTAVO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          email: printavoEmail,
          token: printavoToken,
        },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json();
      if (json.errors) {
        console.error("Printavo GraphQL errors:", JSON.stringify(json.errors));
        throw new Error(json.errors[0]?.message || "Printavo API error");
      }
      return json.data;
    };

    // Fetch quotes from Printavo using the quotes query
    // We'll get recent quotes and filter for ones not yet in our system
    let hasNextPage = true;
    let cursor: string | null = null;
    let imported = 0;
    let skipped = 0;
    let totalFetched = 0;

    while (hasNextPage) {
      const variables: Record<string, unknown> = { first: 10 };
      if (cursor) variables.after = cursor;

      // Step 1: Fetch quote summaries (lightweight query)
      const data = await makePrintavoRequest(
        `query GetQuotes($first: Int!, $after: String) {
          quotes(first: $first, after: $after) {
            nodes {
              id
              visualId
              createdAt
              customerDueAt
              total
              productionNote
              status { name }
              contact {
                fullName
                email
                phone
                customer { companyName }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }`,
        variables
      );

      const nodes = data.quotes?.nodes || [];
      const pageInfo = data.quotes?.pageInfo;
      totalFetched += nodes.length;

      const nodes = data.quotes?.nodes || [];
      const pageInfo = data.quotes?.pageInfo;
      totalFetched += nodes.length;

      for (const pq of nodes) {
        // Skip if already imported
        if (existingIds.has(pq.id)) {
          skipped++;
          continue;
        }

        // Determine local status from Printavo status name
        const statusName = (pq.status?.name || "").trim().toLowerCase();
        let localStatus = "draft";
        if (["quote approval sent", "quote sent", "approval sent"].includes(statusName)) {
          localStatus = "sent";
        } else if (["quote approved", "approved", "order confirmed", "confirmed"].includes(statusName)) {
          localStatus = "approved";
        } else if (["invoice paid", "paid", "payment received", "completed"].includes(statusName)) {
          localStatus = "paid";
        }

        const contactName = pq.contact?.fullName || "Unknown";
        const contactEmail = pq.contact?.email || null;
        const contactPhone = pq.contact?.phone || null;
        const companyName = pq.contact?.customer?.companyName || null;

        // Insert the quote
        const { data: insertedQuote, error: insertErr } = await supabase
          .from("quotes")
          .insert({
            printavo_order_id: pq.id,
            printavo_visual_id: pq.visualId,
            customer_name: contactName,
            customer_email: contactEmail,
            customer_phone: contactPhone,
            company: companyName,
            status: localStatus,
            total_price: pq.total || pq.subtotal || 0,
            notes: pq.productionNote || pq.customerNote || null,
            requested_date: pq.customerDueAt || null,
            quote_sent_at: localStatus === "sent" ? new Date().toISOString() : null,
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error(`Failed to insert quote ${pq.visualId}:`, insertErr.message);
          continue;
        }

        // Import line items from lineItemGroups
        const lineItemGroups = pq.lineItemGroups?.nodes || [];
        let sortOrder = 0;
        for (const group of lineItemGroups) {
          const lineItems = group.lineItems?.nodes || [];
          for (const li of lineItems) {
            sortOrder++;
            const styleNumber = li.itemNumber || li.product?.itemNumber || null;
            const description = li.description || li.product?.description || null;
            const brand = li.product?.brand || null;

            // Convert Printavo size enums back to readable sizes
            const sizesObj: Record<string, number> = {};
            if (li.sizes && Array.isArray(li.sizes)) {
              for (const s of li.sizes) {
                if (s.count > 0) {
                  const readable = s.size
                    .replace("size_", "")
                    .replace("2xl", "2XL")
                    .replace("3xl", "3XL")
                    .replace("4xl", "4XL")
                    .replace("5xl", "5XL")
                    .toUpperCase();
                  sizesObj[readable] = s.count;
                }
              }
            }

            const totalQty = li.items || Object.values(sizesObj).reduce((a, b) => a + b, 0) || 1;
            const unitPrice = li.price || 0;

            await supabase.from("quote_line_items").insert({
              quote_id: insertedQuote.id,
              style_number: styleNumber,
              description: description ? `${brand ? brand + " " : ""}${description}` : styleNumber,
              color: li.color || null,
              quantity: totalQty,
              sizes: Object.keys(sizesObj).length > 0 ? sizesObj : null,
              garment_cost: unitPrice,
              line_total: unitPrice * totalQty,
              sort_order: sortOrder,
              service_type: "other",
            });
          }
        }

        imported++;
        existingIds.add(pq.id); // Prevent re-import within same run
      }

      hasNextPage = pageInfo?.hasNextPage === true && totalFetched < 500;
      cursor = pageInfo?.endCursor || null;
    }

    console.log(`Printavo quote import: fetched=${totalFetched}, imported=${imported}, skipped=${skipped}`);

    return new Response(
      JSON.stringify({ success: true, fetched: totalFetched, imported, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("printavo-quote-import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
