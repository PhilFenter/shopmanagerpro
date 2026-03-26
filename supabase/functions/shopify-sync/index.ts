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
  cancelled_at?: string | null;
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

    const token = authHeader.replace("Bearer ", "");
    const body: any = await req.json().catch(() => ({}));

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const isServiceRole = token === serviceRoleKey;

    let tokenRole: string | undefined;
    let hasSubClaim = false;
    try {
      const payloadPart = token.split(".")[1];
      if (payloadPart) {
        const payload = JSON.parse(atob(payloadPart));
        tokenRole = payload?.role;
        hasSubClaim = !!payload?.sub;
      }
    } catch {
      // Ignore decode errors, JWT validation happens below for user calls
    }

    const isAnonProjectKeyCall = token === anonKey || (tokenRole === "anon" && !hasSubClaim);
    const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
    const hasClientInfoHeader = !!req.headers.get("x-client-info");
    const hasManualFilters = ["startDate", "endDate", "minOrderNumber", "maxPages", "fullScrape"].some((key) =>
      Object.prototype.hasOwnProperty.call(body, key)
    );

    const isAutomatedCronCall =
      isServiceRole ||
      (isAnonProjectKeyCall && (userAgent.includes("pg_net") || (!hasClientInfoHeader && !hasManualFilters)));

    let supabase;
    let userId: string | undefined;

    if (isAutomatedCronCall) {
      // Cron/automated call — use service role client
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        serviceRoleKey
      );
      // Get first admin user as the created_by
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .single();
      userId = adminRole?.user_id;
      console.log("Automated sync auth, using admin user:", userId);
    } else {
      // User call — validate JWT using getClaims
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        anonKey,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claims, error: authError } = await supabase.auth.getClaims(token);
      if (authError || !claims?.claims?.sub) {
        console.error("Auth error:", authError);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claims.claims.sub as string;
      console.log("Authenticated user:", userId);
    }

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

    const {
      endDate = null,
      minOrderNumber = null,
      maxPages = 10,
      fullScrape = false,
    } = body;

    // Incremental: find the most recent Shopify order's created_at
    let startDate = body.startDate || null;
    if (!startDate && !fullScrape) {
      const { data: latestJob } = await supabase
        .from("jobs")
        .select("created_at")
        .eq("source", "shopify")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (latestJob?.created_at) {
        // Start from the latest order date (will be deduped by external_id)
        startDate = latestJob.created_at.split("T")[0];
        console.log(`Incremental sync: fetching Shopify orders since ${startDate}`);
      } else {
        startDate = `${new Date().getFullYear()}-01-01`;
        console.log(`No existing Shopify orders, defaulting to YTD: ${startDate}`);
      }
    }

    console.log(`Sync options: startDate=${startDate}, endDate=${endDate}, minOrderNumber=${minOrderNumber}, maxPages=${maxPages}, fullScrape=${fullScrape}`);

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
        // Skip cancelled / fully-refunded orders so they don't keep reappearing
        if (order.financial_status === "refunded" || order.financial_status === "voided") continue;
        if (order.fulfillment_status === "restocked") continue;
        if (order.cancelled_at) continue;
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
    const syncedExternalIds = new Set(allOrders.map((order) => order.id.toString()));

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
        paid_at: order.created_at,
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
    const jobIdsToSync = [...syncedExternalIds]
      .map((externalId) => allJobMap.get(externalId))
      .filter((jobId): jobId is string => Boolean(jobId));
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

        // Extract base style number from title for catalog matching
        // e.g. "R-112 Heather Grey/Black Embroidered..." -> SKU "R-112"
        // e.g. "PC54 Navy Crew Neck" -> SKU "PC54"
        const titleStr = item.title || item.name || "";
        const extractedSku = titleStr.match(/^([A-Z]{1,4}[- ]?\d{2,5}\w{0,3})/i)?.[1] || null;

        garmentRows.push({
          job_id: jobId,
          style: titleStr || null,
          item_number: item.sku || extractedSku || null,
          color: variantParts.length > 1 ? variantParts[1] : (variantParts[0] || null),
          description: item.variant_title || null,
          sizes: variantParts.length > 0 ? { [variantParts[0] || "OS"]: item.quantity } : { OS: item.quantity },
          quantity: item.quantity,
          unit_cost: 0, // Will be resolved by catalog/API lookup below
          unit_sell_price: parseFloat(item.price) || 0, // Store the sell price separately
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

    // Auto-match garment costs from product catalog (with SanMar API fallback)
    let costsMatched = 0;
    let sanmarSynced = 0;
    if (garmentRows.length > 0) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      let finalUnmatched = new Set<string>();

      // Helper to build price map from catalog (paginated to avoid 1000-row limit)
      const buildPriceMap = async () => {
        const map = new Map<string, number>();
        let offset = 0;
        const pageSize = 1000;
        while (true) {
          const { data: catalogItems, error: catError } = await serviceClient
            .from("product_catalog")
            .select("style_number, piece_price, case_price")
            .gt("piece_price", 0)
            .range(offset, offset + pageSize - 1);
          if (catError) { console.error("Catalog query error:", catError); break; }
          if (!catalogItems || catalogItems.length === 0) break;
          for (const item of catalogItems) {
            const key = item.style_number.toUpperCase();
            if (!map.has(key)) map.set(key, item.piece_price || item.case_price || 0);
          }
          offset += catalogItems.length;
          if (catalogItems.length < pageSize) break;
        }
        console.log(`Price map built: ${map.size} styles`);
        return map;
      };

      // Helper: try exact match, prefix match, and Richardson "R-XXX" pattern
      const findPrice = (priceMap: Map<string, number>, sku: string): number => {
        const upper = sku.toUpperCase().trim();
        if (priceMap.has(upper)) return priceMap.get(upper)!;
        // Try prefix splits (SKU like "PC54-RED-L" -> "PC54")
        for (const sep of ["-", "_", " "]) {
          const prefix = upper.split(sep)[0];
          if (prefix && priceMap.has(prefix)) return priceMap.get(prefix)!;
        }
        // Handle Richardson-style "R-112" or "R-XXX" patterns -> try "112" or "XXX"
        const richardsonMatch = upper.match(/^R[- ](\d+\w*)/);
        if (richardsonMatch) {
          const styleNum = richardsonMatch[1];
          if (priceMap.has(styleNum)) return priceMap.get(styleNum)!;
        }
        return 0;
      };

      let priceMap = await buildPriceMap();

      // First pass: match against existing catalog, collect unmatched
      const unmatchedStyles = new Set<string>();
      const jobIdsForCost = [...allJobMap.values()];

      for (let i = 0; i < jobIdsForCost.length; i += 50) {
        const batch = jobIdsForCost.slice(i, i + 50);
        const { data: garments } = await supabase
          .from("job_garments")
          .select("id, item_number, quantity, style")
          .in("job_id", batch);

        for (const g of garments || []) {
          // Try item_number first (extracted SKU), then style
          const sku = g.item_number || g.style || "";
          if (!sku) continue;
          const price = findPrice(priceMap, sku);
          if (price > 0) {
            await supabase.from("job_garments").update({ 
              unit_cost: price, 
              total_cost: price * g.quantity 
            }).eq("id", g.id);
            costsMatched++;
          } else {
            // Extract base style for supplier lookup
            const upper = sku.toUpperCase().trim();
            // Try Richardson "R-XXX" pattern first
            const richardsonMatch = upper.match(/^R[- ](\d+\w*)/);
            if (richardsonMatch) {
              unmatchedStyles.add(richardsonMatch[1]);
            } else {
              // Strip common size suffixes before lookup
              const stripped = upper.replace(/[- ](XS|S|M|L|XL|2XL|3XL|4XL|5XL|6XL)$/i, "");
              for (const sep of ["-", "_", " "]) {
                const prefix = stripped.split(sep)[0];
                if (prefix) { unmatchedStyles.add(prefix); break; }
              }
              if (!unmatchedStyles.has(stripped)) unmatchedStyles.add(stripped);
            }
          }
        }
      }

      // SanMar API fallback: sync unmatched styles
      if (unmatchedStyles.size > 0) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        // Cap SanMar lookups to 10 to avoid rate limits on edge function invocations
        const sanmarStyles = [...unmatchedStyles].slice(0, 10);
        console.log(`SanMar fallback: syncing ${sanmarStyles.length} of ${unmatchedStyles.size} unmatched styles...`);

        const stillUnmatched = new Set<string>([...unmatchedStyles]);

        let sanmarRateLimited = false;
        for (const style of sanmarStyles) {
          if (sanmarRateLimited) { break; }
          try {
            const resp = await fetch(`${supabaseUrl}/functions/v1/sanmar-api`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({ action: "syncProduct", styleNumber: style }),
            });
            if (resp.status === 429) {
              console.warn(`SanMar rate limited, stopping further lookups`);
              sanmarRateLimited = true;
              break;
            }
            const result = await resp.json();
            if (result.success && result.upserted > 0) {
              sanmarSynced++;
              stillUnmatched.delete(style);
              console.log(`Synced ${style}: ${result.upserted} variants from SanMar`);
            }
            // Throttle: 500ms between calls
            await new Promise(r => setTimeout(r, 500));
          } catch (err) {
            console.error(`SanMar sync failed for ${style}:`, err);
            // If it's a rate limit error, stop immediately
            if (err?.name === "RateLimitError" || String(err).includes("Rate limit")) {
              console.warn(`SanMar rate limited (exception), stopping further lookups`);
              sanmarRateLimited = true;
              break;
            }
          }
        }

        // S&S Activewear fallback for styles SanMar couldn't resolve
        let ssActivewearSynced = 0;
        if (stillUnmatched.size > 0) {
          const ssStyles = [...stillUnmatched].slice(0, 10); // Cap at 10 to avoid rate limits/timeout
          console.log(`S&S Activewear fallback: syncing ${ssStyles.length} of ${stillUnmatched.size} remaining unmatched styles...`);
          for (const style of ssStyles) {
            try {
              const resp = await fetch(`${supabaseUrl}/functions/v1/ss-activewear-api`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({ action: "syncProduct", styleNumber: style }),
              });
              if (resp.status === 429) {
                console.warn(`S&S rate limited, stopping further lookups`);
                break;
              }
              const result = await resp.json();
              if (result.success && result.upserted > 0) {
                ssActivewearSynced++;
                console.log(`Synced ${style}: ${result.upserted} variants from S&S Activewear`);
              }
              // Throttle: wait 1s between calls to avoid rate limits
              await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
              console.error(`S&S sync failed for ${style}:`, err);
              if (err?.name === "RateLimitError" || String(err).includes("Rate limit")) {
                console.warn(`S&S rate limited (exception), stopping`);
                break;
              }
            }
          }
        }

        // Rebuild price map and re-match unmatched garments
        if (sanmarSynced > 0 || ssActivewearSynced > 0) {
          priceMap = await buildPriceMap();
          for (let i = 0; i < jobIdsForCost.length; i += 50) {
            const batch = jobIdsForCost.slice(i, i + 50);
            const { data: garments } = await supabase
              .from("job_garments")
              .select("id, item_number, quantity, style, total_cost")
              .in("job_id", batch);

            for (const g of garments || []) {
              if (g.total_cost && g.total_cost > 0) continue;
              const sku = g.item_number || g.style || "";
              if (!sku) continue;
              const price = findPrice(priceMap, sku);
              if (price > 0) {
                await supabase.from("job_garments").update({ unit_cost: price, total_cost: price * g.quantity }).eq("id", g.id);
                costsMatched++;
              }
            }
          }
        }

        // Collect final unmatched styles (still no price after all fallbacks)
        finalUnmatched = new Set<string>();
        for (let i = 0; i < jobIdsForCost.length; i += 50) {
          const batch = jobIdsForCost.slice(i, i + 50);
          const { data: garments } = await supabase
            .from("job_garments")
            .select("id, item_number, style, total_cost")
            .in("job_id", batch);
          for (const g of garments || []) {
            if (g.total_cost && g.total_cost > 0) continue;
            const sku = g.item_number || g.style || "";
            if (!sku) continue;
            const upper = sku.toUpperCase().trim();
            const richardsonMatch = upper.match(/^R[- ](\d+\w*)/);
            const baseStyle = richardsonMatch ? richardsonMatch[1] : upper.split(/[-_ ]/)[0];
            // Skip vague words that aren't real style numbers
            const SKIP_WORDS = new Set([
              "HEATHER","BLACK","WHITE","GREY","GRAY","NAVY","RED","BLUE","GREEN",
              "YELLOW","ORANGE","PURPLE","PINK","BROWN","TAN","CREAM","CHARCOAL",
              "ROYAL","MAROON","TEAL","KHAKI","OLIVE","CORAL","SAND","SLATE",
              "DARK","LIGHT","NEON","BRIGHT","ASH","SPORT","ATHLETIC","CLASSIC",
              "VINTAGE","PREMIUM","CUSTOM","ADULT","YOUTH","MENS","WOMENS","UNISEX",
              "SMALL","MEDIUM","LARGE","XL","XXL","XXXL","2XL","3XL","4XL","5XL",
              "SHIRT","TEE","HOODIE","TANK","POLO","CAP","HAT","JACKET","FLEECE",
              "COTTON","POLYESTER","BLEND","TRI","JERSEY","PERFORMANCE",
            ]);
            if (!baseStyle || baseStyle.length < 2 || SKIP_WORDS.has(baseStyle)) continue;
            // Real style numbers usually contain at least one digit
            if (!/\d/.test(baseStyle)) continue;
            finalUnmatched.add(baseStyle);
          }
        }

        // Create action items for unmatched styles
        if (finalUnmatched.size > 0) {
          console.log(`Creating action items for ${finalUnmatched.size} unmatched styles: ${[...finalUnmatched].join(", ")}`);
          for (const style of finalUnmatched) {
            // Check if an open action item already exists for this style
            const { data: existing } = await serviceClient
              .from("action_items")
              .select("id")
              .eq("source", "shopify-sync")
              .eq("status", "open")
              .ilike("title", `%${style}%`)
              .limit(1);

            if (existing && existing.length > 0) continue;

            await serviceClient.from("action_items").insert({
              title: `Missing price: ${style}`,
              description: `Style "${style}" was imported from Shopify but has no cost in the product catalog. Fill in the price to auto-update all garments with this style.`,
              source: "shopify-sync",
              priority: "high",
              created_by: userId,
            });
          }
        }

        console.log(`Supplier sync: ${sanmarSynced} from SanMar, ${ssActivewearSynced} from S&S Activewear`);
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
          await supabase.from("jobs").update({ material_cost: totalMaterial }).eq("id", jobId);
        }
      }
      console.log(`Auto-matched ${costsMatched} garment costs, ${sanmarSynced} styles synced from SanMar, ${finalUnmatched?.size || 0} unmatched`);
    }

    console.log(`Successfully imported ${insertedCount} jobs, ${garmentsInserted} garments, ${costsMatched} costs matched, ${sanmarSynced} SanMar synced`);

    // ── Shopify → Customers sync ──
    // Aggregate all Shopify jobs by customer name, upsert those with >$50 total spend
    let customersCreated = 0;
    let customersUpdated = 0;
    try {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Only recalculate customers touched by this sync window to keep manual syncs fast.
      const touchedCustomerNames = new Set<string>();
      for (const order of allOrders) {
        const customerName = order.customer
          ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || "Unknown"
          : "Unknown";
        const key = customerName.toLowerCase().trim();
        if (key && key !== "unknown") touchedCustomerNames.add(key);
      }

      if (touchedCustomerNames.size === 0) {
        console.log("Shopify customer sync skipped: no named customers in current sync window");
      }

      const customerAgg = new Map<string, {
        name: string;
        email: string | null;
        phone: string | null;
        revenue: number;
        orders: number;
        firstOrder: string;
        lastOrder: string;
      }>();

      let offset = 0;
      const pgSize = 1000;
      while (touchedCustomerNames.size > 0) {
        const { data: allJobs, error: ajErr } = await serviceClient
          .from("jobs")
          .select("customer_name, customer_email, customer_phone, sale_price, created_at")
          .order("created_at", { ascending: true })
          .range(offset, offset + pgSize - 1);
        if (ajErr) { console.error("Customer agg query error:", ajErr); break; }
        if (!allJobs || allJobs.length === 0) break;

        for (const j of allJobs) {
          const key = j.customer_name?.toLowerCase().trim();
          if (!key || key === "unknown") continue;
          if (!touchedCustomerNames.has(key)) continue;
          
          const existing = customerAgg.get(key);
          if (existing) {
            existing.revenue += (j.sale_price || 0);
            existing.orders += 1;
            if (!existing.email && j.customer_email) existing.email = j.customer_email;
            if (!existing.phone && j.customer_phone) existing.phone = j.customer_phone;
            if (j.created_at < existing.firstOrder) existing.firstOrder = j.created_at;
            if (j.created_at > existing.lastOrder) existing.lastOrder = j.created_at;
          } else {
            customerAgg.set(key, {
              name: j.customer_name,
              email: j.customer_email || null,
              phone: j.customer_phone || null,
              revenue: j.sale_price || 0,
              orders: 1,
              firstOrder: j.created_at,
              lastOrder: j.created_at,
            });
          }
        }

        offset += allJobs.length;
        if (allJobs.length < pgSize) break;
      }

      // Filter to >$50 spend
      const qualifiedCustomers = [...customerAgg.values()].filter(c => c.revenue > 50);
      console.log(`Shopify customer sync: ${qualifiedCustomers.length} customers with >$50 spend (of ${customerAgg.size} total)`);

      // Get existing customers to match by name (paginated to avoid 1000-row limit)
      const allExistingCustomers: any[] = [];
      let custOffset = 0;
      while (true) {
        const { data: custPage } = await serviceClient
          .from("customers")
          .select("id, name, email, phone, source, total_revenue, total_orders")
          .range(custOffset, custOffset + 999);
        if (!custPage || custPage.length === 0) break;
        allExistingCustomers.push(...custPage);
        custOffset += custPage.length;
        if (custPage.length < 1000) break;
      }

      const existingByName = new Map(
        allExistingCustomers.map(c => [c.name?.toLowerCase().trim(), c])
      );

      // Batch upserts for speed — separate new inserts from updates
      const toInsert: any[] = [];
      const toUpdate: { id: string; updates: Record<string, any> }[] = [];

      for (const cust of qualifiedCustomers) {
        const key = cust.name.toLowerCase().trim();
        const existing = existingByName.get(key);

        if (existing) {
          // Use the GREATER of job-aggregated revenue vs existing stored revenue
          // This preserves spreadsheet-imported historical revenue that predates job records
          const bestRevenue = Math.max(cust.revenue, existing.total_revenue || 0);
          const bestOrders = Math.max(cust.orders, existing.total_orders || 0);
          
          const updates: Record<string, any> = {
            total_revenue: bestRevenue,
            total_orders: bestOrders,
            last_order_date: cust.lastOrder,
          };
          if (!existing.email && cust.email) updates.email = cust.email;
          if (!existing.phone && cust.phone) updates.phone = cust.phone;
          if (cust.firstOrder) updates.first_order_date = cust.firstOrder;
          toUpdate.push({ id: existing.id, updates });
        } else {
          toInsert.push({
            name: cust.name,
            email: cust.email,
            phone: cust.phone,
            source: "shopify",
            total_revenue: cust.revenue,
            total_orders: cust.orders,
            first_order_date: cust.firstOrder,
            last_order_date: cust.lastOrder,
          });
          // Mark as seen to avoid dupes
          existingByName.set(key, { id: '', name: cust.name, email: cust.email, phone: cust.phone, source: 'shopify', total_revenue: cust.revenue, total_orders: cust.orders });
        }
      }

      // Batch insert new customers (chunks of 50)
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error } = await serviceClient.from("customers").insert(batch);
        if (error) {
          console.error(`Batch insert error (batch ${i}):`, error.message);
        } else {
          customersCreated += batch.length;
        }
      }

      // Batch updates (individual but fast — no API overhead)
      for (const { id, updates } of toUpdate) {
        const { error } = await serviceClient.from("customers").update(updates).eq("id", id);
        if (!error) customersUpdated++;
      }
      console.log(`Shopify customers: ${customersCreated} created, ${customersUpdated} updated`);
    } catch (custErr) {
      console.error("Customer sync error (non-fatal):", custErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedCount,
        skipped: existingOrders.length,
        total: allOrders.length,
        pages: pageCount,
        garments: garmentsInserted,
        costsMatched,
        sanmarSynced,
        customersCreated,
        customersUpdated,
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
