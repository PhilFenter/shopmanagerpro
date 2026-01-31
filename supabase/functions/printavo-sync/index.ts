import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Printavo GraphQL endpoint
const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

interface PrintavoOrder {
  id: string;
  visualId: string;
  orderedAt: string;
  customerDueAt: string;
  productionNote: string;
  status: {
    id: string;
    name: string;
  };
  paymentStatus: string;
  customer: {
    id: string;
    companyName: string;
    primaryContact?: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
  };
  lineItemGroups: {
    nodes: Array<{
      id: string;
      name: string;
      totalQuantity: number;
      totalPrice: number;
    }>;
  };
  invoiceInformation: {
    total: number;
    subtotal: number;
  };
}

// Statuses that indicate the job is ready to work on (accepted/paid)
// Adjust these based on your Printavo status names
const ACCEPTED_STATUSES = [
  "approved",
  "accepted", 
  "confirmed",
  "in production",
  "production",
  "ready",
  "paid",
];

const PAID_STATUSES = ["paid", "partial", "deposited"];

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
    const { limit = 25, status = null } = body;

    console.log(`Fetching orders from Printavo (limit: ${limit}, status: ${status})`);

    // GraphQL query to fetch invoices with status and payment info
    const query = `
      query GetInvoices($first: Int!) {
        invoices(first: $first) {
          nodes {
            id
            visualId
            orderedAt
            customerDueAt
            productionNote
            status {
              id
              name
            }
            paymentStatus
            customer {
              id
              companyName
              primaryContact {
                firstName
                lastName
                email
                phone
              }
            }
            lineItemGroups {
              nodes {
                id
                name
                totalQuantity
                totalPrice
              }
            }
            invoiceInformation {
              total
              subtotal
            }
          }
        }
      }
    `;

    // Make GraphQL request to Printavo
    const authBasic = btoa(`${printavoEmail}:${printavoToken}`);
    const printavoResponse = await fetch(PRINTAVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authBasic}`,
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

    const orders: PrintavoOrder[] = printavoData.data?.invoices?.nodes || [];
    console.log(`Found ${orders.length} invoices from Printavo`);

    // Get existing jobs to avoid duplicates
    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("external_id")
      .eq("source", "printavo");

    const existingIds = new Set(existingJobs?.map((j) => j.external_id) || []);

    // Filter to only accepted/paid orders
    const acceptedOrders = orders.filter((order) => {
      const statusName = order.status?.name?.toLowerCase() || "";
      const paymentStatus = order.paymentStatus?.toLowerCase() || "";
      
      // Check if status indicates quote is accepted
      const isAccepted = ACCEPTED_STATUSES.some(s => statusName.includes(s));
      // Check if there's been some payment
      const hasPaid = PAID_STATUSES.some(s => paymentStatus.includes(s));
      
      console.log(`Order ${order.visualId}: status="${statusName}", payment="${paymentStatus}", accepted=${isAccepted}, paid=${hasPaid}`);
      
      // Import if accepted OR paid (configurable - adjust logic as needed)
      return isAccepted || hasPaid;
    });

    console.log(`${acceptedOrders.length} of ${orders.length} orders are accepted/paid`);

    // Map Printavo orders to jobs (only accepted/paid ones)
    const newJobs = acceptedOrders
      .filter((order) => !existingIds.has(order.id))
      .map((order) => {
        const contact = order.customer?.primaryContact;
        const totalQty = order.lineItemGroups?.nodes?.reduce(
          (sum, g) => sum + (g.totalQuantity || 0),
          0
        ) || 1;

        return {
          external_id: order.id,
          source: "printavo",
          order_number: order.visualId,
          invoice_number: order.visualId,
          customer_name: order.customer?.companyName || "Unknown",
          customer_email: contact?.email || null,
          customer_phone: contact?.phone || null,
          description: order.productionNote || null,
          service_type: "other" as const,
          quantity: totalQty,
          sale_price: order.invoiceInformation?.total || 0,
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
        filtered: orders.length - acceptedOrders.length,
        total: orders.length,
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
