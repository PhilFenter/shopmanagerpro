import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

interface CustomerRevenue {
  name: string;
  email: string | null;
  phone: string | null;
  revenue: number;
  orders: number;
  firstOrder: string | null;
  lastOrder: string | null;
  source: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      anonKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const sources = body.sources || ["shopify", "printavo"];
    const maxPages = body.maxPages || 200;

    const customerMap = new Map<string, CustomerRevenue>();

    const addRevenue = (name: string, email: string | null, phone: string | null, amount: number, date: string | null, source: string) => {
      const key = name.toLowerCase().trim();
      if (!key) return;
      const existing = customerMap.get(key);
      if (existing) {
        existing.revenue += amount;
        existing.orders += 1;
        if (email && !existing.email) existing.email = email;
        if (phone && !existing.phone) existing.phone = phone;
        if (date) {
          if (!existing.firstOrder || date < existing.firstOrder) existing.firstOrder = date;
          if (!existing.lastOrder || date > existing.lastOrder) existing.lastOrder = date;
        }
      } else {
        customerMap.set(key, {
          name: name.trim(),
          email, phone,
          revenue: amount,
          orders: 1,
          firstOrder: date,
          lastOrder: date,
          source,
        });
      }
    };

    // ========== SHOPIFY SCRAPE ==========
    let shopifyTotal = 0;
    let shopifyOrders = 0;
    if (sources.includes("shopify")) {
      const shopifyDomain = (Deno.env.get("SHOPIFY_STORE_DOMAIN") || "")
        .replace(/^https?:\/\//i, "").replace(/\/+$/, "");
      const shopifyToken = Deno.env.get("SHOPIFY_ADMIN_API_TOKEN");

      if (shopifyDomain && shopifyToken) {
        let domain = shopifyDomain;
        if (domain.includes("admin.shopify.com")) {
          const match = domain.match(/store\/([^\/]+)/);
          if (match) domain = `${match[1]}.myshopify.com`;
        }

        console.log("Starting Shopify historical scrape...");
        let pageInfo: string | null = null;
        let page = 0;

        while (page < maxPages) {
          page++;
          let url = `https://${domain}/admin/api/2024-01/orders.json?limit=250&status=any&fields=id,name,order_number,created_at,customer,total_price,financial_status`;
          if (pageInfo) {
            url = `https://${domain}/admin/api/2024-01/orders.json?limit=250&page_info=${pageInfo}`;
          }

          const resp = await fetch(url, {
            headers: { "X-Shopify-Access-Token": shopifyToken },
          });

          if (resp.status === 429) {
            const retryAfter = parseInt(resp.headers.get("Retry-After") || "4");
            console.log(`Shopify rate limited, waiting ${retryAfter}s...`);
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            page--; // retry this page
            continue;
          }

          if (!resp.ok) {
            console.error(`Shopify error page ${page}: ${resp.status}`);
            break;
          }

          const data = await resp.json();
          const orders = data.orders || [];
          if (orders.length === 0) break;

          for (const order of orders) {
            if (order.financial_status === "voided" || order.financial_status === "refunded") continue;
            const total = parseFloat(order.total_price || "0");
            if (total <= 0) continue;

            const customerName = order.customer
              ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
              : null;
            if (!customerName) continue;

            addRevenue(
              customerName,
              order.customer?.email || null,
              order.customer?.phone || null,
              total,
              order.created_at?.split("T")[0] || null,
              "shopify"
            );
            shopifyOrders++;
            shopifyTotal += total;
          }

          // Parse Link header for pagination
          const linkHeader = resp.headers.get("Link") || "";
          const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]+)[^>]*>;\s*rel="next"/);
          if (nextMatch) {
            pageInfo = nextMatch[1];
          } else {
            break;
          }

          if (page % 10 === 0) console.log(`Shopify page ${page}: ${shopifyOrders} orders so far ($${shopifyTotal.toFixed(0)})`);
        }
        console.log(`Shopify done: ${shopifyOrders} orders, $${shopifyTotal.toFixed(2)} across ${page} pages`);
      } else {
        console.log("Shopify credentials not configured, skipping");
      }
    }

    // ========== PRINTAVO SCRAPE ==========
    let printavoTotal = 0;
    let printavoOrders = 0;
    if (sources.includes("printavo")) {
      const printavoEmail = Deno.env.get("PRINTAVO_API_EMAIL");
      const printavoToken = Deno.env.get("PRINTAVO_API_TOKEN");

      if (printavoEmail && printavoToken) {
        console.log("Starting Printavo historical scrape...");

        // Only fetch invoices that have been paid — excludes quotes and unpaid drafts
        const invoicesQuery = `
          query GetInvoices($first: Int!, $after: String) {
            invoices(first: $first, after: $after, paymentStatus: PAID) {
              nodes {
                id
                visualId
                total
                createdAt
                orderedAt
                customer {
                  fullName
                  email
                  phone
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `;

        const fetchWithRetry = async (query: string, variables: Record<string, unknown>, retries = 3): Promise<any> => {
          for (let attempt = 0; attempt < retries; attempt++) {
            const response = await fetch(PRINTAVO_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                email: printavoEmail,
                token: printavoToken,
              },
              body: JSON.stringify({ query, variables }),
            });

            if (response.status === 429) {
              const wait = Math.pow(2, attempt + 1) * 1000;
              console.log(`Printavo rate limited, waiting ${wait}ms...`);
              await response.text();
              await new Promise(r => setTimeout(r, wait));
              continue;
            }

            if (!response.ok) {
              const text = await response.text();
              throw new Error(`Printavo API ${response.status}: ${text}`);
            }

            return await response.json();
          }
          throw new Error("Printavo rate limit exceeded after retries");
        };

        let hasNextPage = true;
        let endCursor: string | null = null;
        let page = 0;

        while (hasNextPage && page < maxPages) {
          page++;
          const variables: Record<string, unknown> = { first: 25 };
          if (endCursor) variables.after = endCursor;

          try {
            const data = await fetchWithRetry(invoicesQuery, variables);
            if (data.errors) {
              console.error("Printavo GraphQL errors:", data.errors);
              break;
            }

            const pageData = data.data?.invoices;
            const nodes = pageData?.nodes || [];

            for (const invoice of nodes) {
              const customerName = invoice.customer?.fullName?.trim();
              if (!customerName) continue;
              const total = parseFloat(invoice.total || "0");
              if (total <= 0) continue;

              addRevenue(
                customerName,
                invoice.customer?.email || null,
                invoice.customer?.phone || null,
                total,
                (invoice.orderedAt || invoice.createdAt)?.split("T")[0] || null,
                "printavo"
              );
                invoice.customer?.email || null,
                invoice.customer?.phone || null,
                total,
                invoice.createdAt?.split("T")[0] || null,
                "printavo"
              );
              printavoOrders++;
              printavoTotal += total;
            }

            hasNextPage = pageData?.pageInfo?.hasNextPage || false;
            endCursor = pageData?.pageInfo?.endCursor || null;

            if (hasNextPage) await new Promise(r => setTimeout(r, 300));
            if (page % 20 === 0) console.log(`Printavo page ${page}: ${printavoOrders} invoices ($${printavoTotal.toFixed(0)})`);
          } catch (err) {
            console.error(`Printavo error on page ${page}:`, err);
            if (printavoOrders > 0) {
              console.log("Proceeding with partial Printavo data");
              break;
            }
            throw err;
          }
        }
        console.log(`Printavo done: ${printavoOrders} invoices, $${printavoTotal.toFixed(2)} across ${page} pages`);
      } else {
        console.log("Printavo credentials not configured, skipping");
      }
    }

    // ========== UPDATE CUSTOMERS ==========
    console.log(`Updating ${customerMap.size} unique customers...`);

    // Use service role for updates to bypass RLS
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all existing customers
    const { data: existingCustomers } = await serviceSupabase
      .from("customers")
      .select("id, name, email, phone, total_revenue, total_orders, first_order_date, last_order_date, company, source");

    const existingByName = new Map(
      (existingCustomers || []).map(c => [c.name.toLowerCase().trim(), c])
    );

    let updated = 0;
    let created = 0;
    let skipped = 0;

    // Process in batches of 50 with parallel updates
    const entries = Array.from(customerMap.entries());
    const BATCH_SIZE = 50;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async ([key, cust]) => {
        const existing = existingByName.get(key);

        if (existing) {
          const newRevenue = Math.max(cust.revenue, existing.total_revenue || 0);
          const newOrders = Math.max(cust.orders, existing.total_orders || 0);

          const updates: Record<string, any> = {};
          if (newRevenue > (existing.total_revenue || 0)) updates.total_revenue = newRevenue;
          if (newOrders > (existing.total_orders || 0)) updates.total_orders = newOrders;
          if (cust.email && !existing.email) updates.email = cust.email;
          if (cust.phone && !existing.phone) updates.phone = cust.phone;
          if (cust.firstOrder && (!existing.first_order_date || cust.firstOrder < existing.first_order_date)) {
            updates.first_order_date = cust.firstOrder;
          }
          if (cust.lastOrder && (!existing.last_order_date || cust.lastOrder > existing.last_order_date)) {
            updates.last_order_date = cust.lastOrder;
          }

          if (Object.keys(updates).length > 0) {
            await serviceSupabase.from("customers").update(updates).eq("id", existing.id);
            return "updated";
          }
          return "skipped";
        } else if (cust.revenue >= 50) {
          const { error } = await serviceSupabase.from("customers").insert({
            name: cust.name,
            email: cust.email,
            phone: cust.phone,
            total_revenue: cust.revenue,
            total_orders: cust.orders,
            first_order_date: cust.firstOrder,
            last_order_date: cust.lastOrder,
            source: cust.source,
          });
          return error ? "skipped" : "created";
        }
        return "skipped";
      });

      const results = await Promise.all(promises);
      for (const r of results) {
        if (r === "updated") updated++;
        else if (r === "created") created++;
        else skipped++;
      }

      if (i % 200 === 0 && i > 0) console.log(`Customer update progress: ${i}/${entries.length}`);
    }

    console.log(`Done: ${updated} updated, ${created} created, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        uniqueCustomers: customerMap.size,
        shopify: { orders: shopifyOrders, revenue: Math.round(shopifyTotal * 100) / 100 },
        printavo: { orders: printavoOrders, revenue: Math.round(printavoTotal * 100) / 100 },
        updated,
        created,
        skipped,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
