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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is authenticated
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const printavoEmail = Deno.env.get("PRINTAVO_API_EMAIL");
    const printavoToken = Deno.env.get("PRINTAVO_API_TOKEN");
    if (!printavoEmail || !printavoToken) {
      throw new Error("Printavo API credentials not configured");
    }

    // Use service role to read/write garments
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get garments missing images that have a Printavo line item ID
    const { data: garments, error: fetchError } = await serviceClient
      .from("job_garments")
      .select("id, printavo_line_item_id, job_id, style, color")
      .is("image_url", null)
      .not("printavo_line_item_id", "is", null)
      .limit(300);

    if (fetchError) throw fetchError;
    if (!garments || garments.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No garments need images", updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${garments.length} garments for image backfill via Printavo`);

    // Get the job external_ids (Printavo invoice IDs) for these garments
    const jobIds = [...new Set(garments.map(g => g.job_id))];
    const { data: jobs } = await serviceClient
      .from("jobs")
      .select("id, external_id")
      .in("id", jobIds.slice(0, 500))
      .not("external_id", "is", null);

    const jobExternalMap = new Map<string, string>();
    for (const job of jobs || []) {
      if (job.external_id) jobExternalMap.set(job.id, job.external_id);
    }

    // Group garments by job (Printavo invoice)
    const byInvoice = new Map<string, typeof garments>();
    for (const g of garments) {
      const invoiceId = jobExternalMap.get(g.job_id);
      if (!invoiceId) continue;
      if (!byInvoice.has(invoiceId)) byInvoice.set(invoiceId, []);
      byInvoice.get(invoiceId)!.push(g);
    }

    console.log(`Fetching mockups from ${byInvoice.size} Printavo invoices`);

    const lineItemsQuery = `
      query GetInvoiceLineItems($id: ID!) {
        invoice(id: $id) {
          lineItemGroups(first: 10) {
            nodes {
              lineItems(first: 20) {
                nodes {
                  id
                  mockups(first: 1) { nodes { fullImageUrl thumbnailUrl } }
                }
              }
            }
          }
        }
      }
    `;

    let updated = 0;
    let failed = 0;

    for (const [invoiceId, invoiceGarments] of byInvoice) {
      try {
        const resp = await fetch(PRINTAVO_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            email: printavoEmail,
            token: printavoToken,
          },
          body: JSON.stringify({ query: lineItemsQuery, variables: { id: invoiceId } }),
        });

        if (!resp.ok) {
          console.log(`Printavo request failed for invoice ${invoiceId}: ${resp.status}`);
          failed++;
          await resp.text();
          continue;
        }

        const data = await resp.json();
        if (data.errors) {
          console.log(`GraphQL error for ${invoiceId}:`, data.errors);
          failed++;
          continue;
        }

        // Build lineItemId → imageUrl map
        const imageMap = new Map<string, string>();
        const groups = data.data?.invoice?.lineItemGroups?.nodes || [];
        for (const group of groups) {
          const items = group.lineItems?.nodes || [];
          for (const item of items) {
            const mockupNodes = item.mockups?.nodes || [];
            if (mockupNodes.length > 0) {
              const url = mockupNodes[0].fullImageUrl || mockupNodes[0].thumbnailUrl;
              if (url) imageMap.set(item.id, url);
            }
          }
        }

        // Update garments
        for (const g of invoiceGarments) {
          const imageUrl = imageMap.get(g.printavo_line_item_id);
          if (imageUrl) {
            const { error: updateError } = await serviceClient
              .from("job_garments")
              .update({ image_url: imageUrl })
              .eq("id", g.id);
            if (!updateError) updated++;
          }
        }

        // Small delay
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        console.log(`Failed for invoice ${invoiceId}:`, e);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalGarments: garments.length,
      invoicesQueried: byInvoice.size,
      updated,
      failed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
