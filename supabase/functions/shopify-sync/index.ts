import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ShopifyLineItem {
  id: number;
  name: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: string;
}

interface ShopifyOrder {
  id: number;
  name: string;
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
  total_tax: string;
  note?: string;
  line_items: ShopifyLineItem[];
  fulfillment_status: string | null;
  financial_status: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

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

    let shopifyStoreDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    const shopifyApiToken = Deno.env.get("SHOPIFY_ADMIN_API_TOKEN");

    if (!shopifyStoreDomain || !shopifyApiToken) {
      return new Response(
        JSON.stringify({ error: "Shopify API credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    shopifyStoreDomain = shopifyStoreDomain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (shopifyStoreDomain.includes("admin.shopify.com")) {
      const match = shopifyStoreDomain.match(/store\/([^\/]+)/);
      if (match) shopifyStoreDomain = `${match[1]}.myshopify.com`;
    }
    console.log("Using store domain:", shopifyStoreDomain);

    const body = await req.json().catch(() => ({}));
    const {
      startDate = `${new Date().getFullYear()}-01-01`,
      endDate = null,
      minOrderNumber = null,
      maxPages = 10,
    } = body;

    console.log(`Sync options: startDate=${startDate}, endDate=${endDate}, minOrderNumber=${minOrderNumber}, maxPages=${maxPages}`);

    const baseUrl = `https://${shopifyStoreDomain}/admin/api/2024-01/orders.json`;

    let allOrders: ShopifyOrder[] = [];
    let pageCount = 0;
    let nextPageUrl: string | null = baseUrl;
    const pageSize = 250;

    const startBound = startDate ? new Date(startDate) : null;
    const endBound = endDate ? new Date(endDate + "T23:59:59") : null;
    const minOrderNum = minOrderNumber ? parseInt(minOrderNumber, 10) : null;

    while (pageCount < maxPages) {
      if (nextPageUrl === null) break;
      const currentUrlStr: string = nextPageUrl;
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);

      const url: URL = new URL(currentUrlStr);
      if (pageCount === 1) {
        url.searchParams.set("limit", pageSize.toString());
        url.searchParams.set("status", "any");
        url.searchParams.set("order", "created_at desc");
        if (startDate) url.searchParams.set("created_at_min", `${startDate}T00:00:00-00:00`);
        if (endDate) url.searchParams.set("created_at_max", `${endDate}T23:59:59-00:00`);
        if (minOrderNum) url.searchParams.set("since_id", (minOrderNum - 1).toString());
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
          JSON.stringify({ error: `Shopify API error: ${response.status}`, details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const orders: ShopifyOrder[] = data.orders || [];
      console.log(`Page ${pageCount}: found ${orders.length} orders`);

      for (const order of orders) {
        const createdAt = new Date(order.created_at);
        if (startBound && createdAt < startBound) continue;
        if (endBound && createdAt > endBound) continue;
        if (minOrderNum && order.order_number < minOrderNum) continue;
        allOrders.push(order);
      }

      const linkHeader: string | null = response.headers.get("Link");
      nextPageUrl = null;
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch?.[1]) nextPageUrl = nextMatch[1];
      }

      if (nextPageUrl !== null && pageCount < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`Fetched ${allOrders.length} total orders across ${pageCount} pages`);

    // Get existing jobs
    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("external_id, id")
      .eq("source", "shopify");

    // Use a Set for dedup lookup (handles pre-existing duplicates in DB)
    const existingExternalIds = new Set(existingJobs?.map((j) => j.external_id) || []);
    // Keep a map for date updates (first occurrence per external_id)
    const existingMap = new Map<string, string>();
    for (const j of existingJobs || []) {
      if (j.external_id && !existingMap.has(j.external_id)) {
        existingMap.set(j.external_id, j.id);
      }
    }

    const newOrders = allOrders.filter((o) => !existingExternalIds.has(o.id.toString()));
    const existingOrders = allOrders.filter((o) => existingExternalIds.has(o.id.toString()));

    const newJobs = newOrders.map((order) => {
      const customerName = order.customer
        ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || "Unknown"
        : "Unknown";

      const description = order.line_items
        .map((item) => `${item.quantity}x ${item.name}`)
        .join(", ");

      let stage = "received";
      if (order.fulfillment_status === "fulfilled") stage = "shipped";
      else if (order.fulfillment_status === "partial") stage = "in_production";

      return {
        external_id: order.id.toString(),
        source: "shopify",
        order_number: order.name.replace("#", ""),
        invoice_number: order.name.replace("#", ""),
        customer_name: customerName,
        customer_email: order.customer?.email || null,
        customer_phone: order.customer?.phone || null,
        description: order.note || description || null,
        service_type: "other" as const,
        quantity: order.line_items.reduce((sum, item) => sum + item.quantity, 0),
        sale_price: parseFloat(order.total_price) || 0,
        tax_collected: parseFloat(order.total_tax) || 0,
        stage: stage,
        created_by: userId,
        created_at: order.created_at,
      };
    });

    // Update existing jobs' created_at and tax_collected
    let updatedDates = 0;
    for (const order of existingOrders) {
      const jobId = existingMap.get(order.id.toString());
      if (jobId) {
        const { error } = await supabase
          .from("jobs")
          .update({ 
            created_at: order.created_at,
            tax_collected: parseFloat(order.total_tax) || 0,
          })
          .eq("id", jobId);
        if (!error) updatedDates++;
      }
    }
    console.log(`Updated ${updatedDates} existing Shopify job dates`);

    console.log(`Creating ${newJobs.length} new jobs (${existingOrders.length} already exist)`);

    let insertedCount = 0;
    const batchSize = 50;
    const insertedJobIds: Map<string, string> = new Map();

    for (let i = 0; i < newJobs.length; i += batchSize) {
      const batch = newJobs.slice(i, i + batchSize);
      const { data: inserted, error: insertError } = await supabase
        .from("jobs")
        .insert(batch)
        .select("id, external_id");

      if (insertError) {
        console.error(`Error inserting batch:`, insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create jobs", details: insertError, partialImport: insertedCount }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const job of inserted || []) {
        insertedJobIds.set(job.external_id, job.id);
      }
      insertedCount += inserted?.length || 0;
    }

    // Now store garments from line items
    let garmentsInserted = 0;
    const allJobMap = new Map(existingMap);
    for (const [extId, jobId] of insertedJobIds) {
      allJobMap.set(extId, jobId);
    }

    // Delete existing garments for all synced jobs, then re-insert fresh data
    const jobIdsToSync = [...allJobMap.values()];
    for (let i = 0; i < jobIdsToSync.length; i += 100) {
      const batch = jobIdsToSync.slice(i, i + 100);
      await supabase.from("job_garments").delete().in("job_id", batch);
    }

    const garmentRows: any[] = [];

    for (const order of allOrders) {
      const jobId = allJobMap.get(order.id.toString());
      if (!jobId) continue;

      for (const item of order.line_items) {
        // Parse variant_title for size/color (Shopify format: "Size / Color" or "Color / Size")
        const variantParts = item.variant_title?.split(" / ") || [];

        garmentRows.push({
          job_id: jobId,
          style: item.title || item.name || null,
          item_number: item.sku || null,
          color: variantParts.length > 1 ? variantParts[1] : (variantParts[0] || null),
          description: item.variant_title || null,
          sizes: variantParts.length > 0 ? { [variantParts[0] || "OS"]: item.quantity } : { OS: item.quantity },
          quantity: item.quantity,
          unit_cost: parseFloat(item.price) || 0,
          printavo_line_item_id: null, // Not from Printavo
        });
      }
    }

    console.log(`Inserting ${garmentRows.length} garment records from Shopify`);

    for (let i = 0; i < garmentRows.length; i += batchSize) {
      const batch = garmentRows.slice(i, i + batchSize);
      const { data: inserted, error: garmentError } = await supabase
        .from("job_garments")
        .insert(batch)
        .select("id");

      if (garmentError) {
        console.error("Error inserting garments:", garmentError);
      } else {
        garmentsInserted += inserted?.length || 0;
      }
    }

    // Auto-match garment costs from product catalog
    let costsMatched = 0;
    if (garmentRows.length > 0) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Load full catalog into memory for prefix matching
      const { data: catalogItems } = await serviceClient
        .from("product_catalog")
        .select("style_number, piece_price, case_price")
        .gt("piece_price", 0);

      if (catalogItems && catalogItems.length > 0) {
        // Build a price map keyed by uppercase style_number
        const priceMap = new Map<string, number>();
        for (const item of catalogItems) {
          const key = item.style_number.toUpperCase();
          if (!priceMap.has(key)) {
            priceMap.set(key, item.piece_price || item.case_price || 0);
          }
        }

        // Helper: try exact match, then prefix match (SKU like "PC54-RED-L" -> "PC54")
        const findPrice = (sku: string): number => {
          const upper = sku.toUpperCase().trim();
          if (priceMap.has(upper)) return priceMap.get(upper)!;
          // Try splitting on common delimiters
          for (const sep of ["-", "_", " "]) {
            const prefix = upper.split(sep)[0];
            if (prefix && priceMap.has(prefix)) return priceMap.get(prefix)!;
          }
          return 0;
        };

        // Update garments with catalog prices per job
        const jobIdsForCost = [...allJobMap.values()];
        for (let i = 0; i < jobIdsForCost.length; i += 50) {
          const batch = jobIdsForCost.slice(i, i + 50);
          const { data: garments } = await supabase
            .from("job_garments")
            .select("id, item_number, quantity, style")
            .in("job_id", batch);

          for (const g of garments || []) {
            const sku = g.item_number || g.style || "";
            if (!sku) continue;
            const price = findPrice(sku);
            if (price > 0) {
              await supabase
                .from("job_garments")
                .update({ total_cost: price * g.quantity })
                .eq("id", g.id);
              costsMatched++;
            }
          }
        }

        // Aggregate garment costs into jobs.material_cost
        for (const jobId of jobIdsForCost) {
          const { data: jg } = await supabase
            .from("job_garments")
            .select("total_cost")
            .eq("job_id", jobId)
            .gt("total_cost", 0);

          if (jg && jg.length > 0) {
            const totalMaterial = jg.reduce((sum, g) => sum + (g.total_cost || 0), 0);
            await supabase
              .from("jobs")
              .update({ material_cost: totalMaterial })
              .eq("id", jobId);
          }
        }
      }
      console.log(`Auto-matched ${costsMatched} garment costs from catalog`);
    }

    console.log(`Successfully imported ${insertedCount} jobs, ${garmentsInserted} garments, ${costsMatched} costs matched`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedCount,
        skipped: existingOrders.length,
        total: allOrders.length,
        pages: pageCount,
        garments: garmentsInserted,
        costsMatched,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
