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

// Statuses that indicate the job is ready to work on (accepted/paid)
const ACCEPTED_STATUSES = [
  "approved",
  "accepted", 
  "confirmed",
  "in production",
  "production",
  "ready",
  "paid",
];

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
    const { limit = 25, minOrderNumber = null } = body;

    console.log(`Fetching orders from Printavo (limit: ${limit}, minOrderNumber: ${minOrderNumber})`);

    // GraphQL query using the orders union type with an Invoice fragment.
    // Keep this intentionally minimal to avoid schema drift issues.
    const query = `
      query GetOrders($first: Int!) {
        orders(first: $first) {
          nodes {
            ... on Invoice {
              id
              visualId
              customerDueAt
              productionNote
              status { id name }
              contact { id fullName email phone }
              total
            }
          }
        }
      }
    `;

    // Make GraphQL request to Printavo
    // Per Printavo API v2 docs, auth is provided via `email` + `token` headers (not Basic auth).
    const printavoResponse = await fetch(PRINTAVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        email: printavoEmail,
        token: printavoToken,
      },
      body: JSON.stringify({
        query,
        variables: { first: limit },
      }),
    });

    if (!printavoResponse.ok) {
      const errorText = await printavoResponse.text();
      console.error("Printavo API error:", printavoResponse.status, errorText);
      return new Response(
        JSON.stringify({
          error: `Printavo API error: ${printavoResponse.status}`,
          details: errorText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const printavoData = await printavoResponse.json();
    console.log("Printavo response received");

    if (printavoData.errors) {
      console.error("GraphQL errors:", printavoData.errors);
      return new Response(
        JSON.stringify({
          error: "Printavo GraphQL error",
          details: printavoData.errors,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Filter to only Invoice types (nodes containing the Invoice fragment)
    const allNodes = printavoData.data?.orders?.nodes || [];
    let invoices: PrintavoInvoice[] = allNodes.filter(
      (node: any) => node?.id && node?.visualId
    );
    console.log(`Found ${invoices.length} invoices from Printavo`);
    
    // Log all visualIds so we can see what format they're in
    console.log(`Invoice visualIds: ${invoices.map(inv => inv.visualId).join(', ')}`);

    // Filter by minimum order number if specified
    if (minOrderNumber) {
      const minNum = parseInt(minOrderNumber, 10);
      const beforeCount = invoices.length;
      invoices = invoices.filter((inv) => {
        // Extract numeric portion from visualId (may have prefix like "INV-" or suffix)
        const numericMatch = inv.visualId.match(/(\d+)/);
        if (!numericMatch) {
          console.log(`Invoice ${inv.visualId}: no numeric portion found`);
          return false;
        }
        const orderNum = parseInt(numericMatch[1], 10);
        const passes = orderNum >= minNum;
        if (!passes) {
          console.log(`Invoice ${inv.visualId}: orderNum=${orderNum} < ${minNum}, filtered out`);
        }
        return passes;
      });
      console.log(`After minOrderNumber filter (>= ${minNum}): ${invoices.length} of ${beforeCount} invoices`);
    }

    // Get existing jobs to avoid duplicates
    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("external_id")
      .eq("source", "printavo");

    const existingIds = new Set(existingJobs?.map((j) => j.external_id) || []);

    // Filter to only accepted orders based on status
    const acceptedOrders = invoices.filter((invoice) => {
      const statusName = invoice.status?.name?.toLowerCase() || "";
      const isAccepted = ACCEPTED_STATUSES.some(s => statusName.includes(s));
      console.log(`Invoice ${invoice.visualId}: status="${statusName}", accepted=${isAccepted}`);
      return isAccepted;
    });

    console.log(`${acceptedOrders.length} of ${invoices.length} orders are accepted`);

    // Map Printavo invoices to jobs
    const newJobs = acceptedOrders
      .filter((invoice) => !existingIds.has(invoice.id))
      .map((invoice) => {
        // Printavo v2 GraphQL schema varies; avoid line-item quantity fields.
        // We can enhance this later once we confirm the exact LineItem fields.
        const totalQty = 1;

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
          quantity: totalQty,
          sale_price: invoice.total || 0,
          created_by: userId,
        };
      });

    console.log(`Creating ${newJobs.length} new jobs (${acceptedOrders.length - newJobs.length} already exist)`);

    // Insert new jobs
    let insertedCount = 0;
    if (newJobs.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("jobs")
        .insert(newJobs)
        .select();

      if (insertError) {
        console.error("Error inserting jobs:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create jobs", details: insertError }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      insertedCount = inserted?.length || 0;
    }

    console.log(`Successfully imported ${insertedCount} jobs`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedCount,
        skipped: acceptedOrders.length - newJobs.length,
        filtered: invoices.length - acceptedOrders.length,
        total: invoices.length,
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
