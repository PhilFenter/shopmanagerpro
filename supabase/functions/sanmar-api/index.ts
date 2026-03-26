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
  console.log("SOAP request to:", url);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body,
  });
  const text = await resp.text();
  console.log("SOAP response status:", resp.status, "body preview:", text.substring(0, 800));
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

/** SanMar proprietary product info - CORRECT method: getProductInfoByStyleColorSize
 *  arg0 is type "product" (style, color, size) — can be repeated for batch
 *  arg1 is type "webServiceUser" */
function buildProductInfoRequest(user: string, pass: string, custNum: string, style: string, color?: string, size?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:impl="http://impl.webservice.integration.sanmar.com/">
  <soapenv:Body>
    <impl:getProductInfoByStyleColorSize>
      <arg0>
        <style>${style}</style>
        ${color ? `<color>${color}</color>` : ""}
        ${size ? `<size>${size}</size>` : ""}
      </arg0>
      <arg1>
        <sanMarCustomerNumber>${custNum}</sanMarCustomerNumber>
        <sanMarUserName>${user}</sanMarUserName>
        <sanMarUserPassword>${pass}</sanMarUserPassword>
      </arg1>
    </impl:getProductInfoByStyleColorSize>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ─── Response parsers ─────────────────────────────────────

/** Parse productInfo blocks from getProductInfoByStyleColorSize response.
 *  Each listResponse contains productBasicInfo, productImageInfo, productPriceInfo */
function parseProductInfoResponse(xml: string) {
  const items: any[] = [];
  const listBlocks = extractBlocks(xml, "listResponse");

  for (const block of listBlocks) {
    const basic = extractTag(block, "productBasicInfo") ? block : block;
    const item: any = {
      style: extractTag(basic, "style"),
      productTitle: extractTag(basic, "productTitle"),
      brandName: extractTag(basic, "brandName"),
      productDescription: extractTag(basic, "productDescription"),
      category: extractTag(basic, "category"),
      color: extractTag(basic, "color"),
      catalogColor: extractTag(basic, "catalogColor"),
      size: extractTag(basic, "size"),
      sizeIndex: parseInt(extractTag(basic, "sizeIndex")) || 0,
      availableSizes: extractTag(basic, "availableSizes"),
      caseSize: parseInt(extractTag(basic, "caseSize")) || 0,
      productStatus: extractTag(basic, "productStatus"),
      // Images
      thumbnailImage: extractTag(block, "thumbnailImage"),
      productImage: extractTag(block, "productImage"),
      colorProductImage: extractTag(block, "colorProductImage"),
      colorSquareImage: extractTag(block, "colorSquareImage"),
      frontModel: extractTag(block, "frontModel"),
      frontFlat: extractTag(block, "frontFlat"),
      // Pricing
      piecePrice: parseFloat(extractTag(block, "piecePrice")) || 0,
      casePrice: parseFloat(extractTag(block, "casePrice")) || 0,
      pieceSalePrice: parseFloat(extractTag(block, "pieceSalePrice")) || 0,
      priceCode: extractTag(block, "priceCode"),
    };
    items.push(item);
  }
  return items;
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
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanmarUser = Deno.env.get("SANMAR_API_USERNAME");
    const sanmarPass = Deno.env.get("SANMAR_API_PASSWORD");
    const sanmarCustNum = Deno.env.get("SANMAR_CUSTOMER_NUMBER");
    console.log("SanMar creds check:", { user: sanmarUser?.substring(0, 3) + "...", passLen: sanmarPass?.length, custNum: sanmarCustNum?.substring(0, 3) + "..." });
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
        const errorOccurred = extractTag(xml, "errorOccured") || extractTag(xml, "errorOccurred");
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

      // ─── Product info (SanMar proprietary - FIXED) ───
      case "getProductInfo": {
        if (!params.styleNumber) throw new Error("styleNumber required");

        const xml = await soapPost(
          ENDPOINTS.productInfo,
          buildProductInfoRequest(sanmarUser, sanmarPass, sanmarCustNum || sanmarUser, params.styleNumber, params.color, params.size)
        );

        const errorOccurred = extractTag(xml, "errorOccured") || extractTag(xml, "errorOccurred");
        if (errorOccurred === "true") {
          throw new Error(`SanMar error: ${extractTag(xml, "message")}`);
        }

        const items = parseProductInfoResponse(xml);
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

        const errorOccurred = extractTag(xml, "errorOccured") || extractTag(xml, "errorOccurred");
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

      // ─── Sync pricing + product info to product_catalog ───
      case "syncProduct": {
        if (!params.styleNumber) throw new Error("styleNumber required");
        const styleUpper = params.styleNumber.toUpperCase().trim();

        // 1. Get product info (includes description, colors, images)
        let items: any[] = [];
        try {
          const infoXml = await soapPost(
            ENDPOINTS.productInfo,
            buildProductInfoRequest(sanmarUser, sanmarPass, sanmarCustNum || sanmarUser, styleUpper)
          );
          const errorOccurred = extractTag(infoXml, "errorOccured") || extractTag(infoXml, "errorOccurred");
          if (errorOccurred !== "true") {
            items = parseProductInfoResponse(infoXml);
          }
        } catch (e) {
          console.log("ProductInfo failed, falling back to pricing:", e);
        }

        // 2. ALWAYS get account-specific pricing (myPrice = your wholesale cost)
        const wholesalePrices = new Map<string, { myPrice: number; casePrice: number }>();
        try {
          const pricingXml = await soapPost(
            ENDPOINTS.pricing,
            buildPricingRequest(sanmarUser, sanmarPass, sanmarCustNum || sanmarUser, styleUpper)
          );
          const pricingError = extractTag(pricingXml, "errorOccured") || extractTag(pricingXml, "errorOccurred");
          if (pricingError !== "true") {
            const pricingBlocks = extractBlocks(pricingXml, "listResponse");
            for (const block of pricingBlocks) {
              const color = extractTag(block, "color");
              const size = extractTag(block, "size");
              const myPrice = parseFloat(extractTag(block, "myPrice")) || 0;
              const caseP = parseFloat(extractTag(block, "casePrice")) || 0;
              const key = `${color}|${size}`;
              if (myPrice > 0 || caseP > 0) {
                wholesalePrices.set(key, { myPrice, casePrice: caseP });
              }
            }
            console.log(`Got ${wholesalePrices.size} wholesale price entries for ${styleUpper}`);
          }
        } catch (e) {
          console.log("Pricing endpoint failed:", e);
        }

        // 3. If no product info items, build from pricing data
        if (items.length === 0) {
          for (const [key, prices] of wholesalePrices) {
            const [color, size] = key.split("|");
            items.push({
              style: styleUpper,
              color,
              size,
              brandName: "",
              productTitle: "",
              category: "",
              piecePrice: prices.myPrice || 0,
              casePrice: prices.casePrice || 0,
              priceCode: "",
            });
          }
        } else {
          // Overlay wholesale prices onto product info items
          for (const item of items) {
            const key = `${item.color || item.catalogColor || ""}|${item.size || ""}`;
            const wholesale = wholesalePrices.get(key);
            if (wholesale) {
              // Use myPrice (account wholesale) instead of retail piecePrice
              if (wholesale.myPrice > 0) item.piecePrice = wholesale.myPrice;
              if (wholesale.casePrice > 0) item.casePrice = wholesale.casePrice;
            }
          }
        }

        // 4. Group by style+color, aggregate sizes
        const catalogMap = new Map<string, any>();
        let brandName = "";
        let title = "";

        for (const item of items) {
          const style = (item.style || styleUpper).toUpperCase().trim();
          const color = item.color || item.catalogColor || "";
          const size = item.size || "";
          const key = `${style}|${color}`;

          if (!brandName && item.brandName) brandName = item.brandName;
          if (!title && item.productTitle) title = item.productTitle;

          if (!catalogMap.has(key)) {
            catalogMap.set(key, {
              style_number: style,
              description: item.productTitle || title || null,
              brand: item.brandName || brandName || null,
              category: item.category || null,
              color_group: color || null,
              case_price: item.casePrice || 0,
              piece_price: item.piecePrice || 0,
              price_code: item.priceCode || null,
              supplier: "sanmar",
              sizes: [] as string[],
            });
          } else {
            // Keep LOWEST price (base S-XL tier) for accurate COGS
            // The upcharge for 2XL+ is stored via msrp if needed
            const existing = catalogMap.get(key)!;
            if (item.piecePrice > 0 && (existing.piece_price === 0 || item.piecePrice < existing.piece_price)) {
              existing.piece_price = item.piecePrice;
            }
            if (item.casePrice > 0 && (existing.case_price === 0 || item.casePrice < existing.case_price)) {
              existing.case_price = item.casePrice;
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
            .upsert(row, { onConflict: "style_number,color_group,size_range,supplier", ignoreDuplicates: false });
          if (!error) upserted++;
        }

        result = { styleNumber: styleUpper, upserted, total: rows.length, brand: brandName, title };
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
