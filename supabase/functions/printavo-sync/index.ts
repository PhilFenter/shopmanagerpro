import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Printavo GraphQL endpoint
const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

interface PrintavoInvoice {
  id: string;
  visualId: string;
  customerDueAt?: string | null;
  createdAt?: string | null;
  productionNote?: string | null;
  status?: {
    id: string;
    name: string;
  } | null;
  contact?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  total?: number | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub;
    console.log("Authenticated user:", userId);

    // Get Printavo credentials
    const printavoEmail = Deno.env.get("PRINTAVO_API_EMAIL");
    const printavoToken = Deno.env.get("PRINTAVO_API_TOKEN");

    if (!printavoEmail || !printavoToken) {
      console.error("Printavo credentials not configured");
      return new Response(
        JSON.stringify({ error: "Printavo API credentials not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body for options
    const body = await req.json().catch(() => ({}));
    const { 
      startDate = null, 
      endDate = null, 
      minOrderNumber = null,
      maxPages = 10 // Safety limit to prevent runaway pagination
    } = body;

    console.log(`Sync options: startDate=${startDate}, endDate=${endDate}, minOrderNumber=${minOrderNumber}, maxPages=${maxPages}`);

    // GraphQL query - includes createdAt for date filtering
    const query = `
      query GetOrders($first: Int!, $after: String, $sortOn: OrderSortField!, $sortDescending: Boolean!) {
        orders(first: $first, after: $after, sortOn: $sortOn, sortDescending: $sortDescending) {
          nodes {
            ... on Invoice {
              id
              visualId
              createdAt
              customerDueAt
              productionNote
              status { id name }
              contact { id fullName email phone }
              total
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Make GraphQL request to Printavo
    const makePrintavoRequest = async (variables: Record<string, unknown>) => {
      return await fetch(PRINTAVO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          email: printavoEmail,
          token: printavoToken,
        },
        body: JSON.stringify({ query, variables }),
      });
    };

    // Fetch all pages of orders
    let allInvoices: PrintavoInvoice[] = [];
    let hasNextPage = true;
    let endCursor: string | null = null;
    let pageCount = 0;
    const pageSize = 25; // Printavo max

    // Parse date bounds
    const startBound = startDate ? new Date(startDate) : null;
    const endBound = endDate ? new Date(endDate + "T23:59:59") : null;
    const minOrderNum = minOrderNumber ? parseInt(minOrderNumber, 10) : null;

    console.log(`Date bounds: start=${startBound?.toISOString()}, end=${endBound?.toISOString()}`);

    while (hasNextPage && pageCount < maxPages) {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);

      const variables: Record<string, unknown> = {
        first: pageSize,
        sortOn: "VISUAL_ID",
        sortDescending: true,
      };
      if (endCursor) {
        variables.after = endCursor;
      }

      const response = await makePrintavoRequest(variables);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Printavo API error on page ${pageCount}:`, response.status, errorText);
        return new Response(
          JSON.stringify({
            error: `Printavo API error: ${response.status}`,
            details: errorText,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error("GraphQL errors:", data.errors);
        return new Response(
          JSON.stringify({
            error: "Printavo GraphQL error",
            details: data.errors,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const pageData = data.data?.orders;
      const nodes = pageData?.nodes || [];
      const invoices: PrintavoInvoice[] = nodes.filter(
        (node: any) => node?.id && node?.visualId
      );

      console.log(`Page ${pageCount}: found ${invoices.length} invoices`);

      // Apply filters and check if we've gone past our date range
      let shouldStop = false;
      for (const invoice of invoices) {
        // Date filtering
        const createdAt = invoice.createdAt ? new Date(invoice.createdAt) : null;
        
        // If we have a start date and this order is before it, we're done (orders are desc)
        if (startBound && createdAt && createdAt < startBound) {
          console.log(`Invoice ${invoice.visualId} (${createdAt.toISOString()}) is before start date, stopping pagination`);
          shouldStop = true;
          break;
        }

        // Skip if after end date
        if (endBound && createdAt && createdAt > endBound) {
          console.log(`Invoice ${invoice.visualId} skipped: after end date`);
          continue;
        }

        // Order number filtering
        if (minOrderNum) {
          const numericMatch = invoice.visualId.match(/(\d+)/);
          if (numericMatch) {
            const orderNum = parseInt(numericMatch[1], 10);
            if (orderNum < minOrderNum) {
              console.log(`Invoice ${invoice.visualId} is below minOrderNumber, stopping pagination`);
              shouldStop = true;
              break;
            }
          }
        }

        allInvoices.push(invoice);
      }

      if (shouldStop) {
        break;
      }

      hasNextPage = pageData?.pageInfo?.hasNextPage || false;
      endCursor = pageData?.pageInfo?.endCursor || null;

      // Small delay to be nice to the API
      if (hasNextPage && pageCount < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Fetched ${allInvoices.length} total invoices across ${pageCount} pages`);

    // Get existing jobs to avoid duplicates
    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("external_id")
      .eq("source", "printavo");

    const existingIds = new Set(existingJobs?.map((j) => j.external_id) || []);

    // Map all invoices to jobs (no status filtering - import everything)
    const newJobs = allInvoices
      .filter((invoice) => !existingIds.has(invoice.id))
      .map((invoice) => {
        return {
          external_id: invoice.id,
          source: "printavo",
          order_number: invoice.visualId,
          invoice_number: invoice.visualId,
          customer_name: invoice.contact?.fullName || "Unknown",
          customer_email: invoice.contact?.email || null,
          customer_phone: invoice.contact?.phone || null,
          description: invoice.productionNote || null,
          service_type: "other" as const,
          quantity: 1,
          sale_price: invoice.total || 0,
          printavo_status: invoice.status?.name || null,
          created_by: userId,
        };
      });

    console.log(`Creating ${newJobs.length} new jobs (${allInvoices.length - newJobs.length} already exist)`);

    // Insert new jobs in batches to handle large imports
    let insertedCount = 0;
    const batchSize = 50;
    
    for (let i = 0; i < newJobs.length; i += batchSize) {
      const batch = newJobs.slice(i, i + batchSize);
      const { data: inserted, error: insertError } = await supabase
        .from("jobs")
        .insert(batch)
        .select();

      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
        return new Response(
          JSON.stringify({ 
            error: "Failed to create jobs", 
            details: insertError,
            partialImport: insertedCount
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      insertedCount += inserted?.length || 0;
      console.log(`Inserted batch ${i / batchSize + 1}: ${inserted?.length} jobs`);
    }

    console.log(`Successfully imported ${insertedCount} jobs`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedCount,
        skipped: allInvoices.length - newJobs.length,
        total: allInvoices.length,
        pages: pageCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
