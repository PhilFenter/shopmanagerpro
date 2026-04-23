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
    const { action, orderId } = body;
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

    if (action === "list") {
      const url = `${baseUrl(store.slug)}/GetOrderSummaries`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ApiKey: apiKey, Page: 1, ResultsPerPage: 50 }),
      });
      const text = await resp.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error(`InkSoft non-JSON response from ${url} [${resp.status}]:`, text.slice(0, 300));
        throw new Error(`InkSoft API returned ${resp.status} (non-JSON). The /Api2/ endpoint may no longer exist for store "${storeKey}". URL tried: ${url}`);
      }
      if (!data.Success) throw new Error(data.Message || "InkSoft API error");

      const orders = (data.Data?.Orders || []).filter((o: any) =>
        o.ProductionStatus !== "Complete" && o.ProductionStatus !== "Cancelled"
      );

      return new Response(JSON.stringify({ success: true, orders, store: storeKey }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "detail" && orderId) {
      const resp = await fetch(`${baseUrl(store.slug)}/GetOrderPackage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ApiKey: apiKey, OrderId: orderId }),
      });
      const data = await resp.json();
      if (!data.Success) throw new Error(data.Message || "InkSoft API error");

      const order = data.Data;

      // Extract decoration designs (per item -> placements -> design name)
      const items = (order?.Items || []).map((item: any) => {
        // Decorations may live on Designs, Decorations, or Imprints depending on store config
        const designs: any[] = item.Designs || item.Decorations || item.Imprints || [];
        const decorations = designs.map((d: any) => ({
          name: d.Name || d.DesignName || d.Title || "Design",
          placement: d.Location || d.Placement || d.LocationName || null,
          method: d.DecorationMethod || d.Method || d.Type || null,
          colors: d.Colors || d.InkColors || null,
          imageUrl: d.ImageUrl || d.PreviewUrl || d.ThumbnailUrl || null,
        }));

        return {
          productName: item.ProductName,
          styleName: item.StyleName,
          colorName: item.ColorName,
          sizes: item.Sizes || [],
          quantity: item.Quantity,
          unitPrice: item.UnitPrice,
          totalPrice: item.TotalPrice,
          decorations,
        };
      });

      return new Response(JSON.stringify({
        success: true,
        order: {
          orderId: order?.OrderId,
          orderName: order?.Name || order?.ProposalReferenceId,
          customerName: order?.ShipToName || order?.BillToName,
          items,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
