import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SS_API_BASE = "https://api.ssactivewear.com/v2";

async function ssGet(path: string, accountNum: string, apiKey: string): Promise<any> {
  const url = `${SS_API_BASE}${path}`;
  console.log("S&S API request:", url);
  const resp = await fetch(url, {
    headers: {
      "Authorization": "Basic " + btoa(`${accountNum}:${apiKey}`),
      "Content-Type": "application/json",
    },
  });
  const text = await resp.text();
  console.log("S&S API response status:", resp.status, "preview:", text.substring(0, 500));
  if (!resp.ok) {
    throw new Error(`S&S API [${resp.status}]: ${text.substring(0, 300)}`);
  }
  return JSON.parse(text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
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
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountNum = Deno.env.get("SS_ACTIVEWEAR_ACCOUNT_NUMBER");
    const apiKey = Deno.env.get("SS_ACTIVEWEAR_API_KEY");
    if (!accountNum || !apiKey) {
      throw new Error("S&S Activewear API credentials not configured");
    }

    const { action, ...params } = await req.json();
    let result: any;

    // Helper to find style by part number - tries multiple approaches
    async function findStyle(styleNumber: string): Promise<any> {
      // Try direct path lookup first (handles styleID, partNumber, or brand+name)
      try {
        const data = await ssGet(`/styles/${encodeURIComponent(styleNumber)}`, accountNum, apiKey);
        if (Array.isArray(data) && data.length > 0) return data[0];
      } catch { /* 404, try next */ }

      // Try partnumber filter
      try {
        const data = await ssGet(`/styles/?partnumber=${encodeURIComponent(styleNumber)}`, accountNum, apiKey);
        if (Array.isArray(data) && data.length > 0) return data[0];
      } catch { /* 404, try next */ }

      // Try search
      try {
        const data = await ssGet(`/styles/?search=${encodeURIComponent(styleNumber)}`, accountNum, apiKey);
        if (Array.isArray(data) && data.length > 0) {
          // Find best match
          const exact = data.find((s: any) => 
            s.partNumber?.toUpperCase() === styleNumber.toUpperCase() ||
            s.styleID?.toString() === styleNumber
          );
          return exact || data[0];
        }
      } catch { /* 404 */ }

      return null;
    }

    switch (action) {
      // ─── Get products by style number ───
      case "getProducts": {
        if (!params.styleNumber) throw new Error("styleNumber required");
        const styleInfo = await findStyle(params.styleNumber);
        if (!styleInfo) {
          throw new Error(`Style ${params.styleNumber} not found in S&S catalog`);
        }
        const data = await ssGet(`/products/?style=${styleInfo.styleID}`, accountNum, apiKey);
        result = { styleNumber: params.styleNumber, products: data, count: Array.isArray(data) ? data.length : 0, styleInfo };
        break;
      }

      // ─── Get style info ───
      case "getStyle": {
        if (!params.styleNumber) throw new Error("styleNumber required");
        const styleInfo = await findStyle(params.styleNumber);
        result = { styleNumber: params.styleNumber, styles: styleInfo ? [styleInfo] : [], count: styleInfo ? 1 : 0 };
        break;
      }

      // ─── Get inventory ───
      case "getInventory": {
        if (!params.styleNumber) throw new Error("styleNumber required");
        const styleInfo = await findStyle(params.styleNumber);
        if (!styleInfo) {
          throw new Error(`Style ${params.styleNumber} not found`);
        }
        const styleID = styleInfo.styleID;
        const data = await ssGet(`/inventory/?style=${styleID}`, accountNum, apiKey);
        result = { styleNumber: params.styleNumber, inventory: data, count: Array.isArray(data) ? data.length : 0 };
        break;
      }

      // ─── Sync product pricing to catalog ───
      case "syncProduct": {
        if (!params.styleNumber) throw new Error("styleNumber required");

        const styleInfo = await findStyle(params.styleNumber);
        if (!styleInfo) {
          throw new Error(`Style ${params.styleNumber} not found in S&S catalog`);
        }
        const styleID = styleInfo.styleID;
        const brandName = styleInfo.brandName || "";
        const styleName = styleInfo.title || styleInfo.styleName || "";
        const category = styleInfo.categoryName || "";
        const partNumber = styleInfo.partNumber || params.styleNumber;

        // Fetch products (contains pricing per SKU)
        const products = await ssGet(`/products/?style=${styleID}`, accountNum, apiKey);

        if (!Array.isArray(products) || products.length === 0) {
          throw new Error(`No products found for style ${params.styleNumber}`);
        }

        // Group by style + color, track per-size pricing
        const catalogMap = new Map<string, any>();
        for (const product of products) {
          const style = (styleInfo.uniqueStyleName || styleInfo.styleName || partNumber).toString().toUpperCase().trim();
          const color = product.colorName || product.color1 || "";
          const size = product.sizeName || product.size || "";
          const key = `${style}|${color}`;

          const piecePrice = parseFloat(product.customerPrice) || parseFloat(product.piecePrice) || 0;
          const casePrice = parseFloat(product.casePrice) || parseFloat(product.customerPrice) || 0;

          if (!catalogMap.has(key)) {
            catalogMap.set(key, {
              style_number: style,
              description: styleName || product.title || null,
              brand: brandName || product.brandName || null,
              category: category || null,
              color_group: color || null,
              case_price: casePrice,
              piece_price: piecePrice,
              price_code: null,
              msrp: parseFloat(product.msrp) || parseFloat(product.retailPrice) || 0,
              map_price: parseFloat(product.mapPrice) || 0,
              supplier: "ss_activewear",
              sizes: [] as string[],
            });
          } else {
            // Keep highest price (for larger sizes like 2XL+)
            const existing = catalogMap.get(key)!;
            if (piecePrice > existing.piece_price) {
              existing.piece_price = piecePrice;
            }
            if (casePrice > existing.case_price) {
              existing.case_price = casePrice;
            }
          }
          if (size && !catalogMap.get(key)!.sizes.includes(size)) {
            catalogMap.get(key)!.sizes.push(size);
          }
        }

        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const rows = [...catalogMap.values()].map((r) => {
          const { sizes, ...rest } = r;
          return { ...rest, size_range: sizes.join(", ") || null };
        });

        let upserted = 0;
        for (const row of rows) {
          const { error } = await serviceClient
            .from("product_catalog")
            .upsert(row, { onConflict: "style_number,color_group,size_range,supplier", ignoreDuplicates: false });
          if (!error) upserted++;
        }

        result = { styleNumber: params.styleNumber, upserted, total: rows.length, brand: brandName, title: styleName };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}. Valid: getProducts, getStyle, getInventory, syncProduct`);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("S&S Activewear API error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
