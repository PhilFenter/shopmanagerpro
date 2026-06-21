import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STORES: Record<string, { slug: string; label: string }> = {
  hcd_kiosk: { slug: "hcd_kiosk", label: "HCD Kiosk" },
  grangeville_helitack: { slug: "grangeville_helitack_", label: "Grangeville Helitack" },
  tri_state_employee_store: { slug: "tri-state_employee_store", label: "Tri-State Employee Store" },
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

      // Recursively walk an object and collect every key whose name contains "tax"
      // (case-insensitive) along with its value and JSON path. Used to auto-detect
      // which InkSoft field carries sales tax — field names vary between stores.
      const findTaxFields = (obj: any, path = "", out: Array<{ path: string; key: string; value: any }> = []) => {
        if (!obj || typeof obj !== "object") return out;
        if (Array.isArray(obj)) {
          obj.forEach((v, i) => findTaxFields(v, `${path}[${i}]`, out));
          return out;
        }
        for (const [k, v] of Object.entries(obj)) {
          const p = path ? `${path}.${k}` : k;
          if (/tax/i.test(k) && (typeof v === "number" || typeof v === "string")) {
            out.push({ path: p, key: k, value: v });
          }
          if (v && typeof v === "object") findTaxFields(v, p, out);
        }
        return out;
      };

      // Score candidates and pick the most likely "sales tax amount" field on the order root.
      const pickBestTax = (candidates: Array<{ path: string; key: string; value: any }>) => {
        const scored = candidates
          .map((c) => {
            const num = typeof c.value === "string" ? parseFloat(c.value) : c.value;
            if (typeof num !== "number" || isNaN(num)) return null;
            let score = 0;
            const k = c.key.toLowerCase();
            if (/^(sales?tax|taxamount|taxtotal|totaltax)$/i.test(c.key)) score += 100;
            if (k.includes("amount") || k.includes("total")) score += 20;
            if (k.includes("rate") || k.includes("exempt") || k.includes("percent")) score -= 50;
            // Prefer root-level (shallower path = fewer dots)
            score -= (c.path.match(/\./g)?.length || 0) * 5;
            // Prefer non-zero
            if (num > 0) score += 10;
            return { ...c, num, score };
          })
          .filter((x): x is NonNullable<typeof x> => !!x)
          .sort((a, b) => b.score - a.score);
        return scored[0] || null;
      };

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

        // Auto-detect sales tax field on this order.
        const taxCandidates = findTaxFields(order);
        const best = pickBestTax(taxCandidates);

        // Log raw payload + tax detection so we can iterate on the mapping.
        console.log("[inksoft-orders] raw order payload:", JSON.stringify(order));
        console.log("[inksoft-orders] tax field candidates:", JSON.stringify(taxCandidates));
        console.log("[inksoft-orders] selected tax field:", best ? `${best.path} = ${best.value} (score ${best.score})` : "none");

        return {
          orderId: order?.OrderId || order?.Id,
          orderName: order?.Name || order?.ProposalReferenceId || `Order ${order?.OrderId}`,
          customerName: order?.ShipToName || order?.BillToName || order?.CustomerName,
          productionStatus: order?.ProductionStatus,
          totalAmount: order?.TotalAmount,
          taxAmount: best ? Number(best.num) : 0,
          taxFieldPath: best?.path || null,
          taxCandidates,
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
