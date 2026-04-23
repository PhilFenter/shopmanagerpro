import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STORES: Record<string, { slug: string; label: string }> = {
  hcd_kiosk: { slug: "hcd_kiosk", label: "HCD Kiosk" },
  grangeville_helitack: { slug: "grangeville_helitack_", label: "Grangeville Helitack" },
};

const baseUrl = (slug: string) => `https://stores.inksoft.com/${slug}/Api2`;

// InkSoft Api2 uses GET with query params and returns { OK, Data, Messages, StatusCode }
async function inksoftGet(slug: string, method: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, Format: "JSON" }).toString();
  const url = `${baseUrl(slug)}/${method}?${qs}`;
  const resp = await fetch(url, { method: "GET" });
  const text = await resp.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`InkSoft ${method} returned non-JSON (HTTP ${resp.status})`);
  }
  if (!data.OK) {
    const msg = data.Messages?.[0]?.Content || `InkSoft ${method} failed`;
    throw new Error(msg);
  }
  return data.Data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const body = await req.json();
    const { action, orderId, orderIds } = body;
    const storeKey = body.store || "hcd_kiosk";
    const store = STORES[storeKey];
    if (!store) {
      return new Response(JSON.stringify({ error: `Unknown store: ${storeKey}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stores") {
      return new Response(JSON.stringify({
        success: true,
        stores: Object.entries(STORES).map(([key, s]) => ({ key, label: s.label })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch one or more orders by ID. InkSoft Api2 has no public "list all orders"
    // endpoint, so the user must provide order ID(s) from the InkSoft admin.
    if (action === "detail" || action === "list") {
      const ids: number[] = orderIds && Array.isArray(orderIds) && orderIds.length
        ? orderIds.map(Number).filter((n) => !isNaN(n))
        : (orderId != null ? [Number(orderId)] : []);
      if (ids.length === 0) {
        return new Response(JSON.stringify({ error: "Provide an InkSoft Order ID" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await inksoftGet(store.slug, "GetOrderPackage", {
        ApiKey: apiKey,
        OrderIds: JSON.stringify(ids),
      });

      // GetOrderPackage returns either a single order object or an array depending on input.
      const rawOrders: any[] = Array.isArray(data) ? data : (data ? [data] : []);

      const mapOrder = (order: any) => {
        const items = (order?.Items || order?.OrderItems || []).map((item: any) => {
          const designs: any[] = item.Designs || item.Decorations || item.Imprints || [];
          const decorations = designs.map((d: any) => ({
            name: d.Name || d.DesignName || d.Title || "Design",
            placement: d.Location || d.Placement || d.LocationName || null,
            method: d.DecorationMethod || d.Method || d.Type || null,
            colors: d.Colors || d.InkColors || null,
            imageUrl: d.ImageUrl || d.PreviewUrl || d.ThumbnailUrl || null,
          }));

          return {
            productName: item.ProductName || item.Name,
            styleName: item.StyleName || item.StyleNumber || item.SKU,
            colorName: item.ColorName || item.Color,
            sizes: item.Sizes || item.SizeBreakdown || [],
            quantity: item.Quantity || item.TotalQuantity,
            unitPrice: item.UnitPrice,
            totalPrice: item.TotalPrice || item.LineTotal,
            decorations,
          };
        });

        return {
          orderId: order?.OrderId || order?.Id,
          orderName: order?.Name || order?.ProposalReferenceId || `Order ${order?.OrderId}`,
          customerName: order?.ShipToName || order?.BillToName || order?.CustomerName,
          productionStatus: order?.ProductionStatus,
          totalAmount: order?.TotalAmount,
          items,
        };
      };

      const mapped = rawOrders.map(mapOrder);

      // Backwards compat: callers using action=list expect { orders }, action=detail expects { order }
      if (action === "list") {
        // For the "list" action we return a list-shaped payload of the requested orders.
        const orders = mapped.map((m) => ({
          OrderId: m.orderId,
          ProposalReferenceId: m.orderName,
          Name: m.customerName,
          ProductionStatus: m.productionStatus,
          TotalAmount: m.totalAmount,
        }));
        return new Response(JSON.stringify({ success: true, orders, store: storeKey }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, order: mapped[0] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("inksoft-orders error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
