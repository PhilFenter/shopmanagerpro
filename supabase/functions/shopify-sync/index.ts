import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ShopifyOrder {
  id: number;
  name: string; // Order number like "#1001"
  order_number: number;
  created_at: string;
  customer?: {
    id: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  total_price: string;
  note?: string;
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: string;
  }>;
  fulfillment_status: string | null;
  financial_status: string;
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

    // Get Shopify credentials
    const shopifyStoreDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    const shopifyApiToken = Deno.env.get("SHOPIFY_ADMIN_API_TOKEN");

    if (!shopifyStoreDomain || !shopifyApiToken) {
      console.error("Shopify credentials not configured");
      return new Response(
        JSON.stringify({ error: "Shopify API credentials not configured" }),
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
      maxPages = 10 // Safety limit
    } = body;

    console.log(`Sync options: startDate=${startDate}, endDate=${endDate}, minOrderNumber=${minOrderNumber}, maxPages=${maxPages}`);

    // Build Shopify API URL
    const baseUrl = `https://${shopifyStoreDomain}/admin/api/2024-01/orders.json`;
    
    // Fetch orders with pagination
    let allOrders: ShopifyOrder[] = [];
    let pageCount = 0;
    let nextPageUrl: string | null = baseUrl;
    const pageSize = 250; // Shopify max

    // Parse date bounds
    const startBound = startDate ? new Date(startDate) : null;
    const endBound = endDate ? new Date(endDate + "T23:59:59") : null;
    const minOrderNum = minOrderNumber ? parseInt(minOrderNumber, 10) : null;

    console.log(`Date bounds: start=${startBound?.toISOString()}, end=${endBound?.toISOString()}`);

    while (pageCount < maxPages) {
      if (nextPageUrl === null) break;
      
      const currentUrlStr: string = nextPageUrl;
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);

      // Build query params
      const url: URL = new URL(currentUrlStr);
      if (pageCount === 1) {
        url.searchParams.set("limit", pageSize.toString());
        url.searchParams.set("status", "any"); // Include all orders
        url.searchParams.set("order", "created_at desc");
        
        // Apply date filters directly to API if available
        if (startDate) {
          url.searchParams.set("created_at_min", `${startDate}T00:00:00-00:00`);
        }
        if (endDate) {
          url.searchParams.set("created_at_max", `${endDate}T23:59:59-00:00`);
        }
        if (minOrderNum) {
          url.searchParams.set("since_id", (minOrderNum - 1).toString());
        }
      }

      const response: Response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": shopifyApiToken,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify API error on page ${pageCount}:`, response.status, errorText);
        return new Response(
          JSON.stringify({
            error: `Shopify API error: ${response.status}`,
            details: errorText,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data = await response.json();
      const orders: ShopifyOrder[] = data.orders || [];

      console.log(`Page ${pageCount}: found ${orders.length} orders`);

      // Apply filters
      for (const order of orders) {
        const createdAt = new Date(order.created_at);
        
        // Skip if outside date range (API should handle this, but double-check)
        if (startBound && createdAt < startBound) continue;
        if (endBound && createdAt > endBound) continue;

        // Order number filtering
        if (minOrderNum && order.order_number < minOrderNum) continue;

        allOrders.push(order);
      }

      // Check for next page via Link header
      const linkHeader: string | null = response.headers.get("Link");
      nextPageUrl = null;
      
      if (linkHeader) {
        const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch && nextMatch[1]) {
          nextPageUrl = nextMatch[1];
        }
      }

      // Small delay to be nice to the API
      if (nextPageUrl !== null && pageCount < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Fetched ${allOrders.length} total orders across ${pageCount} pages`);

    // Get existing jobs to avoid duplicates
    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("external_id")
      .eq("source", "shopify");

    const existingIds = new Set(existingJobs?.map((j) => j.external_id) || []);

    // Map orders to jobs
    const newJobs = allOrders
      .filter((order) => !existingIds.has(order.id.toString()))
      .map((order) => {
        // Build customer name
        const customerName = order.customer
          ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || "Unknown"
          : "Unknown";

        // Build description from line items
        const description = order.line_items
          .map((item) => `${item.quantity}x ${item.name}`)
          .join(", ");

        // Map fulfillment status to a reasonable initial stage
        let stage = "received";
        if (order.fulfillment_status === "fulfilled") {
          stage = "shipped";
        } else if (order.fulfillment_status === "partial") {
          stage = "in_production";
        }

        return {
          external_id: order.id.toString(),
          source: "shopify",
          order_number: order.name.replace("#", ""), // Remove # prefix
          invoice_number: order.name.replace("#", ""),
          customer_name: customerName,
          customer_email: order.customer?.email || null,
          customer_phone: order.customer?.phone || null,
          description: order.note || description || null,
          service_type: "other" as const,
          quantity: order.line_items.reduce((sum, item) => sum + item.quantity, 0),
          sale_price: parseFloat(order.total_price) || 0,
          stage: stage,
          created_by: userId,
        };
      });

    console.log(`Creating ${newJobs.length} new jobs (${allOrders.length - newJobs.length} already exist)`);

    // Insert new jobs in batches
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
        skipped: allOrders.length - newJobs.length,
        total: allOrders.length,
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
