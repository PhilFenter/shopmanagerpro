import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const INKSOFT_BASE = "https://stores.inksoft.com/hcd_kiosk/Api2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("INKSOFT_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "INKSOFT_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, orderId } = await req.json();

    if (action === "list") {
      // Fetch recent order summaries
      const resp = await fetch(`${INKSOFT_BASE}/GetOrderSummaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ApiKey: apiKey,
          Page: 1,
          ResultsPerPage: 50,
        }),
      });
      const data = await resp.json();
      if (!data.Success) throw new Error(data.Message || "InkSoft API error");

      // Filter to pending/unfulfilled orders
      const orders = (data.Data?.Orders || []).filter((o: any) =>
        o.ProductionStatus !== "Complete" && o.ProductionStatus !== "Cancelled"
      );

      return new Response(JSON.stringify({ success: true, orders }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "detail" && orderId) {
      const resp = await fetch(`${INKSOFT_BASE}/GetOrderPackage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ApiKey: apiKey, OrderId: orderId }),
      });
      const data = await resp.json();
      if (!data.Success) throw new Error(data.Message || "InkSoft API error");

      // Extract line items with garment details
      const order = data.Data;
      const items = (order?.Items || []).map((item: any) => ({
        productName: item.ProductName,
        styleName: item.StyleName,
        colorName: item.ColorName,
        sizes: item.Sizes || [],
        quantity: item.Quantity,
        unitPrice: item.UnitPrice,
        totalPrice: item.TotalPrice,
      }));

      return new Response(JSON.stringify({
        success: true,
        order: {
          orderId: order?.OrderId,
          orderName: order?.Name || order?.ProposalReferenceId,
          customerName: order?.ShipToName || order?.BillToName,
          items,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("inksoft-orders error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
