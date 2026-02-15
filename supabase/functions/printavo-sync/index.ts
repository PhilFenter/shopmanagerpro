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

    const printavoEmail = Deno.env.get("PRINTAVO_API_EMAIL");
    const printavoToken = Deno.env.get("PRINTAVO_API_TOKEN");

    if (!printavoEmail || !printavoToken) {
      return new Response(
        JSON.stringify({ error: "Printavo API credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      startDate = null,
      endDate = null,
      minOrderNumber = null,
      maxPages = 10,
    } = body;

    console.log(`Sync options: startDate=${startDate}, endDate=${endDate}, minOrderNumber=${minOrderNumber}, maxPages=${maxPages}`);

    // GraphQL query - now includes lineItemGroups with garment details
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
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

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

    let allInvoices: PrintavoInvoice[] = [];
    let hasNextPage = true;
    let endCursor: string | null = null;
    let pageCount = 0;
    const pageSize = 25;

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

      const response = await makePrintavoRequest(variables);

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
      printavo_status: invoice.status?.name || null,
      created_by: userId,
    }));

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

    // Build combined map of external_id -> job_id
    const allJobMap = new Map(existingMap);
    for (const [extId, jobId] of insertedJobIds) {
      allJobMap.set(extId, jobId);
    }

    // Check which jobs already have garments
    const jobIdsToCheck = [...allJobMap.values()];
    const { data: existingGarments } = await supabase
      .from("job_garments")
      .select("job_id")
      .in("job_id", jobIdsToCheck.slice(0, 500)); // Supabase limit

    const jobsWithGarments = new Set(existingGarments?.map((g) => g.job_id) || []);

    // Extract garments from invoices
    const garmentRows: any[] = [];

    for (const invoice of allInvoices) {
      const jobId = allJobMap.get(invoice.id);
      if (!jobId || jobsWithGarments.has(jobId)) continue;

      const groups = invoice.lineItemGroups?.nodes || [];
      for (const group of groups) {
        const items = group.lineItems?.nodes || [];
        for (const item of items) {
          // Build sizes object - convert enum names like "size_xl" to "XL"
          const sizesObj: Record<string, number> = {};
          if (item.sizes) {
            for (const s of item.sizes) {
              if (s.count > 0) {
                const label = s.size.replace(/^size_/, '').toUpperCase();
                sizesObj[label] = s.count;
              }
            }
          }

          // Style comes from product.description or product.brand + itemNumber
          const product = item.product;
          const style = product
            ? [product.brand, product.description].filter(Boolean).join(' ') || null
            : null;

          garmentRows.push({
            job_id: jobId,
            style: style,
            item_number: product?.itemNumber || item.itemNumber || null,
            color: item.color || product?.color || null,
            description: item.description || null,
            sizes: sizesObj,
            quantity: item.items || 0,
            unit_cost: item.price || 0,
            printavo_line_item_id: item.id,
          });
        }
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

    console.log(`Successfully imported ${insertedCount} jobs, ${garmentsInserted} garment records`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedCount,
        skipped: existingInvoices.length,
        total: allInvoices.length,
        pages: pageCount,
        garments: garmentsInserted,
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
