import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SanMar SOAP endpoints
const ENDPOINTS = {
  productData: "https://ws.sanmar.com:8080/promostandards/ProductDataServiceBindingV2",
  inventory: "https://ws.sanmar.com:8080/SanMarWebService/SanMarWebServicePort",
  pricing: "https://ws.sanmar.com:8080/SanMarWebService/SanMarPricingServicePort",
  productInfo: "https://ws.sanmar.com:8080/SanMarWebService/SanMarProductInfoServicePort",
};

// ─── XML helpers ───────────────────────────────────────────
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*?>[\\s\\S]*?<\\/(?:[\\w-]+:)?${tag}>`, "gi");
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(xml)) !== null) {
    matches.push(m[0]);
  }
  return matches;
}

async function soapPost(url: string, body: string): Promise<string> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body,
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`SOAP [${resp.status}]: ${text.substring(0, 500)}`);
  }
  return text;
}

// ─── SOAP builders ────────────────────────────────────────

/** SanMar proprietary pricing: namespace = http://impl.webservice.integration.sanmar.com/ */
function buildPricingRequest(user: string, pass: string, custNum: string, style: string, color?: string, size?: string): string {
  const itemXml = `<arg0>
      <style>${style}</style>
      ${color ? `<color>${color}</color>` : ""}
      ${size ? `<size>${size}</size>` : ""}
    </arg0>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:impl="http://impl.webservice.integration.sanmar.com/">
  <soapenv:Body>
    <impl:getPricing>
      ${itemXml}
      <arg1>
        <sanMarCustomerNumber>${custNum}</sanMarCustomerNumber>
        <sanMarUserName>${user}</sanMarUserName>
        <sanMarUserPassword>${pass}</sanMarUserPassword>
      </arg1>
    </impl:getPricing>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** PromoStandards Product Data V2 */
function buildProductDataRequest(user: string, pass: string, productId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/"
  xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <soapenv:Body>
    <ns:GetProductRequest>
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${user}</shar:id>
      <shar:password>${pass}</shar:password>
      <shar:productId>${productId}</shar:productId>
    </ns:GetProductRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** SanMar proprietary inventory - getInventoryQtyForStyleColorSize */
function buildInventoryRequest(user: string, pass: string, custNum: string, style: string, color?: string, size?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:web="http://webservice.integration.sanmar.com/">
  <soapenv:Body>
    <web:getInventoryQtyForStyleColorSize>
      <arg0>${style}</arg0>
      <arg1>${color || ""}</arg1>
      <arg2>${size || ""}</arg2>
      <arg3>${custNum}</arg3>
      <arg4>${user}</arg4>
      <arg5>${pass}</arg5>
    </web:getInventoryQtyForStyleColorSize>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** SanMar proprietary product info */
function buildProductInfoRequest(user: string, pass: string, custNum: string, style: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:impl="http://impl.webservice.integration.sanmar.com/">
  <soapenv:Body>
    <impl:getProductInfo>
      <arg0>
        <style>${style}</style>
      </arg0>
      <arg1>
        <sanMarCustomerNumber>${custNum}</sanMarCustomerNumber>
        <sanMarUserName>${user}</sanMarUserName>
        <sanMarUserPassword>${pass}</sanMarUserPassword>
      </arg1>
    </impl:getProductInfo>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ─── Main handler ─────────────────────────────────────────

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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanmarUser = Deno.env.get("SANMAR_API_USERNAME");
    const sanmarPass = Deno.env.get("SANMAR_API_PASSWORD");
    const sanmarCustNum = Deno.env.get("SANMAR_CUSTOMER_NUMBER");
    if (!sanmarUser || !sanmarPass) {
      throw new Error("SanMar API credentials not configured");
    }

    const { action, ...params } = await req.json();
    let result: any;

    switch (action) {
      // ─── Live pricing lookup ───
      case "getPricing": {
        if (!params.styleNumber) throw new Error("styleNumber required");

        const xml = await soapPost(
          ENDPOINTS.pricing,
          buildPricingRequest(sanmarUser, sanmarPass, sanmarCustNum || sanmarUser, params.styleNumber, params.color, params.size)
        );

        // Check for error
        const errorOccurred = extractTag(xml, "errorOccurred");
        if (errorOccurred === "true") {
          const msg = extractTag(xml, "message");
          throw new Error(`SanMar pricing error: ${msg}`);
        }

        // Parse listResponse items
        const itemBlocks = extractBlocks(xml, "listResponse");
        const pricing = itemBlocks.map((block) => ({
          style: extractTag(block, "style"),
          color: extractTag(block, "color"),
          size: extractTag(block, "size"),
          sizeIndex: parseInt(extractTag(block, "sizeIndex")) || 0,
          casePrice: parseFloat(extractTag(block, "casePrice")) || 0,
          piecePrice: parseFloat(extractTag(block, "piecePrice")) || 0,
          salePrice: parseFloat(extractTag(block, "salePrice")) || 0,
          myPrice: parseFloat(extractTag(block, "myPrice")) || 0,
          inventoryKey: extractTag(block, "inventoryKey"),
        }));

        result = { styleNumber: params.styleNumber, pricing, count: pricing.length };
        break;
      }

      // ─── Product info (SanMar proprietary) ───
      case "getProductInfo": {
        if (!params.styleNumber) throw new Error("styleNumber required");

        const xml = await soapPost(
          ENDPOINTS.productInfo,
          buildProductInfoRequest(sanmarUser, sanmarPass, sanmarCustNum || sanmarUser, params.styleNumber)
        );

        const errorOccurred = extractTag(xml, "errorOccurred");
        if (errorOccurred === "true") {
          throw new Error(`SanMar error: ${extractTag(xml, "message")}`);
        }

        const itemBlocks = extractBlocks(xml, "listResponse");
        const items = itemBlocks.map((block) => ({
          style: extractTag(block, "style"),
          title: extractTag(block, "title"),
          brandName: extractTag(block, "brandName"),
          description: extractTag(block, "description"),
          category: extractTag(block, "categoryName") || extractTag(block, "category"),
          color: extractTag(block, "color"),
          size: extractTag(block, "size"),
          caseQty: parseInt(extractTag(block, "caseQty")) || 0,
        }));

        result = { styleNumber: params.styleNumber, items, count: items.length };
        break;
      }

      // ─── PromoStandards product data ───
      case "getProduct": {
        if (!params.productId) throw new Error("productId required");

        const xml = await soapPost(
          ENDPOINTS.productData,
          buildProductDataRequest(sanmarUser, sanmarPass, params.productId)
        );

        const partBlocks = extractBlocks(xml, "ProductPart");
        const parts = partBlocks.map((block) => ({
          partId: extractTag(block, "partId"),
          color: extractTag(block, "colorName"),
          size: extractTag(block, "labelSize") || extractTag(block, "apparelSize"),
        }));

        result = {
          productId: params.productId,
          productName: extractTag(xml, "productName"),
          description: extractTag(xml, "description"),
          parts,
        };
        break;
      }

      // ─── Real-time inventory ───
      case "getInventory": {
        if (!params.styleNumber) throw new Error("styleNumber required");

        const xml = await soapPost(
          ENDPOINTS.inventory,
          buildInventoryRequest(sanmarUser, sanmarPass, sanmarCustNum || sanmarUser, params.styleNumber, params.color, params.size)
        );

        const errorOccurred = extractTag(xml, "errorOccurred");
        if (errorOccurred === "true") {
          throw new Error(`SanMar inventory error: ${extractTag(xml, "message")}`);
        }

        const invBlocks = extractBlocks(xml, "listResponse");
        const inventory = invBlocks.map((block) => ({
          style: extractTag(block, "style"),
          color: extractTag(block, "color"),
          size: extractTag(block, "size"),
          qty: parseInt(extractTag(block, "qty")) || 0,
          warehouseId: extractTag(block, "warehouseId"),
        }));

        result = {
          styleNumber: params.styleNumber,
          inventory,
          totalAvailable: inventory.reduce((sum, i) => sum + i.qty, 0),
        };
        break;
      }

      // ─── Sync pricing to product_catalog ───
      case "syncProduct": {
        if (!params.styleNumber) throw new Error("styleNumber required");

        // Fetch pricing
        const pricingXml = await soapPost(
          ENDPOINTS.pricing,
          buildPricingRequest(sanmarUser, sanmarPass, sanmarCustNum || sanmarUser, params.styleNumber)
        );

        const errorOccurred = extractTag(pricingXml, "errorOccurred");
        if (errorOccurred === "true") {
          throw new Error(`SanMar pricing error: ${extractTag(pricingXml, "message")}`);
        }

        const syncBlocks = extractBlocks(pricingXml, "listResponse");

        // Fetch product info for descriptions/brand
        let brandName = "";
        let title = "";
        let category = "";
        try {
          const infoXml = await soapPost(
            ENDPOINTS.productInfo,
            buildProductInfoRequest(sanmarUser, sanmarPass, sanmarCustNum || sanmarUser, params.styleNumber)
          );
          brandName = extractTag(infoXml, "brandName");
          title = extractTag(infoXml, "title");
          category = extractTag(infoXml, "categoryName") || extractTag(infoXml, "category");
        } catch { /* non-critical */ }

        // Group by style+color, aggregate sizes
        const catalogMap = new Map<string, any>();
        for (const block of syncBlocks) {
          const style = (extractTag(block, "style") || params.styleNumber).toUpperCase().trim();
          const color = extractTag(block, "color");
          const size = extractTag(block, "size");
          const key = `${style}|${color}`;

          if (!catalogMap.has(key)) {
            catalogMap.set(key, {
              style_number: style,
              description: title || null,
              brand: brandName || null,
              category: category || null,
              color_group: color || null,
              case_price: parseFloat(extractTag(block, "casePrice")) || 0,
              piece_price: parseFloat(extractTag(block, "piecePrice")) || 0,
              price_code: null,
              supplier: "sanmar",
              sizes: [] as string[],
            });
          }
          if (size && !catalogMap.get(key)!.sizes.includes(size)) {
            catalogMap.get(key)!.sizes.push(size);
          }
        }

        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const rows = [...catalogMap.values()].map((r) => ({
          ...r,
          size_range: r.sizes.join(", ") || null,
          sizes: undefined,
        }));

        let upserted = 0;
        for (const row of rows) {
          delete row.sizes;
          const { error } = await serviceClient
            .from("product_catalog")
            .upsert(row, { onConflict: "style_number,size_range,supplier", ignoreDuplicates: false });
          if (!error) upserted++;
        }

        result = { styleNumber: params.styleNumber, upserted, total: rows.length, brand: brandName, title };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}. Valid: getPricing, getProductInfo, getProduct, getInventory, syncProduct`);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("SanMar API error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
