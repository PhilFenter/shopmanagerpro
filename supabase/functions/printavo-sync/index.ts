import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

interface PrintavoSizeCount {
  size: string; // enum like "size_s", "size_m", "size_l", "size_xl"
  count: number;
}

interface PrintavoProduct {
  brand?: string | null;
  description?: string | null;
  itemNumber?: string | null;
  color?: string | null;
}

interface PrintavoLineItem {
  id: string;
  color?: string | null;
  description?: string | null;
  itemNumber?: string | null;
  items: number;
  price?: number | null;
  sizes?: PrintavoSizeCount[] | null;
  product?: PrintavoProduct | null;
}

interface PrintavoLineItemGroup {
  id: string;
  lineItems?: {
    nodes?: PrintavoLineItem[];
  } | null;
}

interface PrintavoInvoice {
  id: string;
  visualId: string;
  customerDueAt?: string | null;
  createdAt?: string | null;
  productionNote?: string | null;
  status?: { id: string; name: string } | null;
  contact?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  total?: number | null;
  salesTax?: number | null;
  salesTaxAmount?: number | null;
  lineItemGroups?: {
    nodes?: PrintavoLineItemGroup[];
  } | null;
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
      // User call — validate JWT
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        anonKey,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        console.error("Auth error:", authError);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
      console.log("Authenticated user:", userId);
    }

    const printavoEmail = Deno.env.get("PRINTAVO_API_EMAIL");
    const printavoToken = Deno.env.get("PRINTAVO_API_TOKEN");

    if (!printavoEmail || !printavoToken) {
      return new Response(
        JSON.stringify({ error: "Printavo API credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      endDate = null,
      minOrderNumber = null,
      maxPages = 10,
      fullScrape = false,
    } = body;

    // Incremental: find the most recent Printavo order's created_at
    let startDate = body.startDate || null;
    if (!startDate && !fullScrape) {
      const { data: latestJob } = await supabase
        .from("jobs")
        .select("created_at")
        .eq("source", "printavo")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (latestJob?.created_at) {
        startDate = latestJob.created_at.split("T")[0];
        console.log(`Incremental sync: fetching Printavo orders since ${startDate}`);
      } else {
        startDate = `${new Date().getFullYear()}-01-01`;
        console.log(`No existing Printavo orders, defaulting to YTD: ${startDate}`);
      }
    }

    console.log(`Sync options: startDate=${startDate}, endDate=${endDate}, minOrderNumber=${minOrderNumber}, maxPages=${maxPages}, fullScrape=${fullScrape}`);

    // Pass 1 query: orders WITHOUT line items (low complexity, 25/page)
    const ordersQuery = `
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
              salesTax
              salesTaxAmount
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Pass 2 query: line items for a single invoice (called per-order)
    const lineItemsQuery = `
      query GetInvoiceLineItems($id: ID!) {
        invoice(id: $id) {
          lineItemGroups {
            nodes {
              id
              lineItems {
                nodes {
                  id
                  color
                  description
                  itemNumber
                  items
                  price
                  product { brand description itemNumber color }
                  sizes { size count }
                  mockups(first: 1) { nodes { fullImageUrl thumbnailUrl } }
                }
              }
            }
          }
        }
      }
    `;

    const makePrintavoRequest = async (gqlQuery: string, variables: Record<string, unknown>) => {
      return await fetch(PRINTAVO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          email: printavoEmail,
          token: printavoToken,
        },
        body: JSON.stringify({ query: gqlQuery, variables }),
      });
    };

    let allInvoices: PrintavoInvoice[] = [];
    let hasNextPage = true;
    let endCursor: string | null = null;
    let pageCount = 0;
    const pageSize = 25; // Full page size since we're not fetching line items here

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
      if (endCursor) variables.after = endCursor;

      const response = await makePrintavoRequest(ordersQuery, variables);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Printavo API error on page ${pageCount}:`, response.status, errorText);
        return new Response(
          JSON.stringify({ error: `Printavo API error: ${response.status}`, details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();

      if (data.errors) {
        console.error("GraphQL errors:", data.errors);
        return new Response(
          JSON.stringify({ error: "Printavo GraphQL error", details: data.errors }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pageData = data.data?.orders;
      const nodes = pageData?.nodes || [];
      const invoices: PrintavoInvoice[] = nodes.filter(
        (node: any) => node?.id && node?.visualId
      );

      console.log(`Page ${pageCount}: found ${invoices.length} invoices`);

      let shouldStop = false;
      for (const invoice of invoices) {
        const createdAt = invoice.createdAt ? new Date(invoice.createdAt) : null;

        if (startBound && createdAt && createdAt < startBound) {
          console.log(`Invoice ${invoice.visualId} before start date, stopping`);
          shouldStop = true;
          break;
        }

        if (endBound && createdAt && createdAt > endBound) {
          continue;
        }

        if (minOrderNum) {
          const numericMatch = invoice.visualId.match(/(\d+)/);
          if (numericMatch) {
            const orderNum = parseInt(numericMatch[1], 10);
            if (orderNum < minOrderNum) {
              shouldStop = true;
              break;
            }
          }
        }

        allInvoices.push(invoice);
      }

      if (shouldStop) break;

      hasNextPage = pageData?.pageInfo?.hasNextPage || false;
      endCursor = pageData?.pageInfo?.endCursor || null;

      if (hasNextPage && pageCount < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`Fetched ${allInvoices.length} total invoices across ${pageCount} pages`);

    // Get existing jobs to avoid duplicates
    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("external_id, id")
      .eq("source", "printavo");

    const existingMap = new Map(
      existingJobs?.map((j) => [j.external_id, j.id]) || []
    );

    // Separate new vs existing invoices
    const newInvoices = allInvoices.filter((inv) => !existingMap.has(inv.id));
    const existingInvoices = allInvoices.filter((inv) => existingMap.has(inv.id));

    const newJobs = newInvoices.map((invoice) => ({
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
      tax_collected: invoice.salesTaxAmount || 0,
      printavo_status: invoice.status?.name || null,
      created_by: userId,
      created_at: invoice.createdAt || new Date().toISOString(),
      paid_at: invoice.createdAt || new Date().toISOString(),
    }));

    // Update existing jobs' created_at and tax_collected
    let updatedDates = 0;
    for (const invoice of existingInvoices) {
      if (invoice.createdAt) {
        const jobId = existingMap.get(invoice.id);
        if (jobId) {
          const { error } = await supabase
            .from("jobs")
            .update({ 
              created_at: invoice.createdAt,
              tax_collected: invoice.salesTaxAmount || 0,
            })
            .eq("id", jobId);
          if (!error) updatedDates++;
        }
      }
    }
    console.log(`Updated ${updatedDates} existing job dates`);

    console.log(`Creating ${newJobs.length} new jobs (${existingInvoices.length} already exist)`);

    // Insert new jobs in batches
    let insertedCount = 0;
    const batchSize = 50;
    const insertedJobIds: Map<string, string> = new Map(); // external_id -> job id

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

    // Now insert garments for ALL invoices (new + existing that may not have garments yet)
    let garmentsInserted = 0;

    // Build map of ONLY jobs touched in this sync run
    const allJobMap = new Map<string, string>();
    for (const invoice of allInvoices) {
      const jobId = insertedJobIds.get(invoice.id) || existingMap.get(invoice.id);
      if (jobId) allJobMap.set(invoice.id, jobId);
    }

    // Check which jobs already have garments
    const jobIdsToCheck = [...allJobMap.values()];
    const { data: existingGarments } = await supabase
      .from("job_garments")
      .select("job_id")
      .in("job_id", jobIdsToCheck.slice(0, 500)); // Supabase limit

    const jobsWithGarments = new Set(existingGarments?.map((g) => g.job_id) || []);

    // Fetch line items per-order (separate queries to avoid complexity limits)
    const garmentRows: any[] = [];
    const invoicesNeedingGarments = allInvoices.filter(inv => {
      const jobId = allJobMap.get(inv.id);
      return jobId && !jobsWithGarments.has(jobId);
    });

    console.log(`Fetching line items for ${invoicesNeedingGarments.length} orders...`);

    for (const invoice of invoicesNeedingGarments) {
      const jobId = allJobMap.get(invoice.id)!;

      try {
        const liResponse = await makePrintavoRequest(lineItemsQuery, { id: invoice.id });
        if (!liResponse.ok) {
          console.error(`Failed to fetch line items for ${invoice.visualId}`);
          await liResponse.text(); // consume body
          continue;
        }

        const liData = await liResponse.json();
        if (liData.errors) {
          console.error(`GraphQL error for line items ${invoice.visualId}:`, liData.errors);
          continue;
        }

        const groups = liData.data?.invoice?.lineItemGroups?.nodes || [];
        for (const group of groups) {
          const items = group.lineItems?.nodes || [];
          for (const item of items) {
            const sizesObj: Record<string, number> = {};
            if (item.sizes) {
              for (const s of item.sizes) {
                if (s.count > 0) {
                  const label = s.size.replace(/^size_/, '').toUpperCase();
                  sizesObj[label] = s.count;
                }
              }
            }

            const product = item.product;
            const style = product
              ? [product.brand, product.description].filter(Boolean).join(' ') || null
              : null;

            // Get image from Printavo mockups if available
            const mockupNodes = (item.mockups?.nodes || []);
            const imageUrl = mockupNodes.length > 0
              ? (mockupNodes[0].fullImageUrl || mockupNodes[0].thumbnailUrl || null)
              : null;

            garmentRows.push({
              job_id: jobId,
              style: style,
              item_number: product?.itemNumber || item.itemNumber || null,
              color: item.color || product?.color || null,
              description: item.description || null,
              sizes: sizesObj,
              quantity: item.items || 0,
              unit_sell_price: item.price || 0,
              printavo_line_item_id: item.id,
              image_url: imageUrl,
            });
          }
        }

        // Small delay between per-order requests
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        console.error(`Error fetching line items for ${invoice.visualId}:`, err);
      }
    }

    console.log(`Inserting ${garmentRows.length} garment records`);

    // Insert garments in batches
    for (let i = 0; i < garmentRows.length; i += batchSize) {
      const batch = garmentRows.slice(i, i + batchSize);
      const { data: inserted, error: garmentError } = await supabase
        .from("job_garments")
        .insert(batch)
        .select("id");

      if (garmentError) {
        console.error("Error inserting garments:", garmentError);
        // Non-fatal — jobs were already created
      } else {
        garmentsInserted += inserted?.length || 0;
      }
    }

    // Auto-match garment costs from product catalog (with SanMar API fallback)
    let costsMatched = 0;
    let sanmarSynced = 0;
    const allGarmentJobIds = [...allJobMap.values()];
    if (allGarmentJobIds.length > 0) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

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

      let priceMap = await buildPriceMap();

      // First pass: match against existing catalog
      const unmatchedStyles = new Set<string>();
      for (let i = 0; i < allGarmentJobIds.length; i += 50) {
        const batch = allGarmentJobIds.slice(i, i + 50);
        const { data: garments } = await supabase
          .from("job_garments")
          .select("id, item_number, quantity")
          .in("job_id", batch)
          .not("item_number", "is", null);

        for (const g of garments || []) {
          const key = g.item_number?.toUpperCase().trim();
          if (!key) continue;
          if (priceMap.has(key)) {
            const price = priceMap.get(key)!;
            if (price > 0) {
              await supabase.from("job_garments").update({ unit_cost: price, total_cost: price * g.quantity }).eq("id", g.id);
              costsMatched++;
            }
          } else {
            unmatchedStyles.add(key);
          }
        }
      }

      // SanMar API fallback: sync unmatched styles
      if (unmatchedStyles.size > 0) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        console.log(`SanMar fallback: syncing ${unmatchedStyles.size} unmatched styles...`);

        const stillUnmatched = new Set<string>();

        for (const style of unmatchedStyles) {
          try {
            const resp = await fetch(`${supabaseUrl}/functions/v1/sanmar-api`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({ action: "syncProduct", styleNumber: style }),
            });
            const result = await resp.json();
            if (result.success && result.upserted > 0) {
              sanmarSynced++;
              console.log(`Synced ${style}: ${result.upserted} variants from SanMar`);
            } else {
              stillUnmatched.add(style);
            }
          } catch (err) {
            console.error(`SanMar sync failed for ${style}:`, err);
            stillUnmatched.add(style);
          }
        }

        // S&S Activewear fallback for styles SanMar couldn't resolve
        let ssActivewearSynced = 0;
        if (stillUnmatched.size > 0) {
          console.log(`S&S Activewear fallback: syncing ${stillUnmatched.size} remaining unmatched styles...`);
          for (const style of stillUnmatched) {
            try {
              const resp = await fetch(`${supabaseUrl}/functions/v1/ss-activewear-api`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({ action: "syncProduct", styleNumber: style }),
              });
              const result = await resp.json();
              if (result.success && result.upserted > 0) {
                ssActivewearSynced++;
                console.log(`Synced ${style}: ${result.upserted} variants from S&S Activewear`);
              }
            } catch (err) {
              console.error(`S&S sync failed for ${style}:`, err);
            }
          }
        }

        // Rebuild price map and re-match
        if (sanmarSynced > 0 || ssActivewearSynced > 0) {
          priceMap = await buildPriceMap();
          for (let i = 0; i < allGarmentJobIds.length; i += 50) {
            const batch = allGarmentJobIds.slice(i, i + 50);
            const { data: garments } = await supabase
              .from("job_garments")
              .select("id, item_number, quantity, total_cost")
              .in("job_id", batch)
              .not("item_number", "is", null);

            for (const g of garments || []) {
              if (g.total_cost && g.total_cost > 0) continue; // Already matched
              const key = g.item_number?.toUpperCase().trim();
              if (!key) continue;
              const price = priceMap.get(key) || 0;
              if (price > 0) {
                await supabase.from("job_garments").update({ unit_cost: price, total_cost: price * g.quantity }).eq("id", g.id);
                costsMatched++;
              }
            }
          }
        }
        console.log(`Supplier sync: ${sanmarSynced} from SanMar, ${ssActivewearSynced} from S&S Activewear`);
      }

      // Aggregate into jobs.material_cost
      for (const jobId of allGarmentJobIds) {
        const { data: jg } = await supabase
          .from("job_garments")
          .select("total_cost")
          .eq("job_id", jobId)
          .gt("total_cost", 0);

        if (jg && jg.length > 0) {
          const total = jg.reduce((sum, g) => sum + (g.total_cost || 0), 0);
          await supabase.from("jobs").update({ material_cost: total }).eq("id", jobId);
        }
      }
    }
    console.log(`Auto-matched ${costsMatched} garment costs, ${sanmarSynced} styles synced from SanMar`);

    console.log(`Successfully imported ${insertedCount} jobs, ${garmentsInserted} garments, ${costsMatched} costs matched, ${sanmarSynced} SanMar synced`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedCount,
        skipped: existingInvoices.length,
        total: allInvoices.length,
        pages: pageCount,
        garments: garmentsInserted,
        costsMatched,
        sanmarSynced,
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
