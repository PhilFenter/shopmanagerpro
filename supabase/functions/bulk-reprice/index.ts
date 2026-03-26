import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// XML helpers
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*?>[\\s\\S]*?<\\/(?:[\\w-]+:)?${tag}>`, "gi");
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(xml)) !== null) matches.push(m[0]);
  return matches;
}

function buildPricingRequest(user: string, pass: string, custNum: string, style: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:impl="http://impl.webservice.integration.sanmar.com/">
  <soapenv:Body>
    <impl:getPricing>
      <arg0><style>${style}</style></arg0>
      <arg1>
        <sanMarCustomerNumber>${custNum}</sanMarCustomerNumber>
        <sanMarUserName>${user}</sanMarUserName>
        <sanMarUserPassword>${pass}</sanMarUserPassword>
      </arg1>
    </impl:getPricing>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function extractStyleNumber(raw: string): string {
  const dotMatch = raw.match(/\.\s*([A-Z0-9][\w-]*)\s*$/i);
  if (dotMatch) return dotMatch[1].toUpperCase().trim();
  const dashMatch = raw.match(/-\s*([A-Z0-9][\w-]*)\s*$/i);
  if (dashMatch) return dashMatch[1].toUpperCase().trim();
  const spaceMatch = raw.match(/\s([A-Z]{1,4}\d{2,}[\w]*)\s*$/i);
  if (spaceMatch) return spaceMatch[1].toUpperCase().trim();
  return raw.toUpperCase().trim();
}

function normalizeStyleForApi(style: string): string {
  return style.replace(/^R-/i, "").replace(/^R\s+/i, "").trim();
}

const SS_API_BASE = "https://api.ssactivewear.com/v2";

async function ssGetPrice(styleNumber: string, accountNum: string, apiKey: string): Promise<number | null> {
  try {
    // Try to find the style
    let styleID: number | null = null;
    
    for (const path of [
      `/styles/${encodeURIComponent(styleNumber)}`,
      `/styles/?partnumber=${encodeURIComponent(styleNumber)}`,
    ]) {
      try {
        const resp = await fetch(`${SS_API_BASE}${path}`, {
          headers: {
            "Authorization": "Basic " + btoa(`${accountNum}:${apiKey}`),
            "Content-Type": "application/json",
          },
        });
        if (!resp.ok) { await resp.text(); continue; }
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          styleID = data[0].styleID;
          break;
        }
      } catch { continue; }
    }
    
    if (!styleID) return null;
    
    // Fetch products for pricing
    const resp = await fetch(`${SS_API_BASE}/products/?style=${styleID}`, {
      headers: {
        "Authorization": "Basic " + btoa(`${accountNum}:${apiKey}`),
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) { await resp.text(); return null; }
    const products = await resp.json();
    
    if (!Array.isArray(products) || products.length === 0) return null;
    
    // Find lowest customerPrice (your contract rate)
    let lowest = Infinity;
    for (const p of products) {
      const price = parseFloat(p.customerPrice) || parseFloat(p.piecePrice) || 0;
      if (price > 0 && price < lowest) lowest = price;
    }
    
    return lowest === Infinity ? null : lowest;
  } catch {
    return null;
  }
}

// Batch size per invocation to avoid timeouts
const BATCH_SIZE = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanmarUser = Deno.env.get("SANMAR_API_USERNAME")!;
    const sanmarPass = Deno.env.get("SANMAR_API_PASSWORD")!;
    const sanmarCustNum = Deno.env.get("SANMAR_CUSTOMER_NUMBER") || sanmarUser;
    const ssAccountNum = Deno.env.get("SS_ACTIVEWEAR_ACCOUNT_NUMBER") || "";
    const ssApiKey = Deno.env.get("SS_ACTIVEWEAR_API_KEY") || "";
    const hasSSCredentials = !!(ssAccountNum && ssApiKey);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const dryRun = body.dryRun === true;
    const offset = body.offset || 0; // Which batch to process

    // 1. Get all garments
    const { data: garments, error: gErr } = await serviceClient
      .from("job_garments")
      .select("id, job_id, style, item_number, quantity, unit_cost, total_cost")
      .gt("quantity", 0);

    if (gErr) throw new Error(`Failed to fetch garments: ${gErr.message}`);

    // Build map of distinct style numbers
    const styleMap = new Map<string, string[]>();
    const garmentLookup = new Map<string, typeof garments[0]>();

    for (const g of garments || []) {
      const rawStyle = g.style || g.item_number || "";
      if (!rawStyle) continue;
      garmentLookup.set(g.id, g);
      const extracted = extractStyleNumber(rawStyle);
      const normalized = normalizeStyleForApi(extracted);
      if (!normalized || normalized.length < 2) continue;
      if (!styleMap.has(normalized)) styleMap.set(normalized, []);
      styleMap.get(normalized)!.push(g.id);
    }

    const allStyles = [...styleMap.entries()];
    const totalStyles = allStyles.length;
    const batchStyles = allStyles.slice(offset, offset + BATCH_SIZE);
    const hasMore = offset + BATCH_SIZE < totalStyles;

    console.log(`Processing batch: offset=${offset}, batchSize=${batchStyles.length}, totalStyles=${totalStyles}, hasMore=${hasMore}`);

    const results: Array<{
      style: string;
      oldPrice: number;
      newPrice: number;
      garmentCount: number;
      status: string;
      source: string;
    }> = [];

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const jobsToReaggregate = new Set<string>();

    for (const [apiStyle, garmentIds] of batchStyles) {
      try {
        await new Promise(r => setTimeout(r, 200));

        let lowestPrice: number | null = null;
        let priceSource = "sanmar";

        // Try SanMar first
        const xml = await fetch("https://ws.sanmar.com:8080/SanMarWebService/SanMarPricingServicePort", {
          method: "POST",
          headers: { "Content-Type": "text/xml; charset=utf-8" },
          body: buildPricingRequest(sanmarUser, sanmarPass, sanmarCustNum, apiStyle),
        }).then(r => r.text());

        const errorOccurred = extractTag(xml, "errorOccured") || extractTag(xml, "errorOccurred");
        if (errorOccurred !== "true") {
          const blocks = extractBlocks(xml, "listResponse");
          let lowest = Infinity;
          for (const block of blocks) {
            const myPrice = parseFloat(extractTag(block, "myPrice")) || 0;
            if (myPrice > 0 && myPrice < lowest) lowest = myPrice;
          }
          if (lowest !== Infinity && lowest > 0) {
            lowestPrice = lowest;
          }
        }

        // Fallback to S&S Activewear if SanMar didn't return pricing
        if (lowestPrice === null && hasSSCredentials) {
          console.log(`Style ${apiStyle}: SanMar miss, trying S&S Activewear...`);
          const ssPrice = await ssGetPrice(apiStyle, ssAccountNum, ssApiKey);
          if (ssPrice !== null) {
            lowestPrice = ssPrice;
            priceSource = "ss_activewear";
          }
        }

        if (lowestPrice === null || lowestPrice <= 0) {
          const msg = errorOccurred === "true" ? extractTag(xml, "message") : "no_price";
          console.log(`Style ${apiStyle}: no price found from any supplier`);
          results.push({ style: apiStyle, oldPrice: 0, newPrice: 0, garmentCount: garmentIds.length, status: `no_price: ${msg}`, source: "none" });
          totalSkipped += garmentIds.length;
          continue;
        }

        // Update garments
        let updated = 0;
        const sampleOldPrice = garmentLookup.get(garmentIds[0])?.unit_cost || 0;

        for (const gId of garmentIds) {
          const g = garmentLookup.get(gId)!;
          const currentCost = g.unit_cost || 0;
          if (Math.abs(currentCost - lowestPrice) < 0.005) continue;

          const newTotal = lowestPrice * g.quantity;

          if (!dryRun) {
            const { error: updateErr } = await serviceClient
              .from("job_garments")
              .update({ unit_cost: lowestPrice, total_cost: newTotal })
              .eq("id", gId);
            if (!updateErr) {
              updated++;
              jobsToReaggregate.add(g.job_id);
            }
          } else {
            updated++;
            jobsToReaggregate.add(g.job_id);
          }
        }

        totalUpdated += updated;
        results.push({
          style: apiStyle,
          oldPrice: sampleOldPrice,
          newPrice: lowestPrice,
          garmentCount: garmentIds.length,
          status: updated > 0 ? `updated ${updated}` : "already_correct",
          source: priceSource,
        });

        console.log(`Style ${apiStyle}: $${sampleOldPrice} → $${lowestPrice} [${priceSource}] (${updated}/${garmentIds.length} updated)`);
      } catch (err) {
        console.error(`Style ${apiStyle} error:`, err);
        results.push({ style: apiStyle, oldPrice: 0, newPrice: 0, garmentCount: garmentIds.length, status: `error: ${err.message}`, source: "none" });
        totalErrors++;
      }
    }

    // Re-aggregate material_cost for affected jobs
    let jobsUpdated = 0;
    if (!dryRun) {
      for (const jobId of jobsToReaggregate) {
        const { data: jg } = await serviceClient
          .from("job_garments")
          .select("total_cost")
          .eq("job_id", jobId)
          .gt("total_cost", 0);

        if (jg && jg.length > 0) {
          const totalMaterial = jg.reduce((sum, g) => sum + (g.total_cost || 0), 0);
          await serviceClient.from("jobs").update({ material_cost: totalMaterial }).eq("id", jobId);
          jobsUpdated++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      hasMore,
      nextOffset: hasMore ? offset + BATCH_SIZE : null,
      summary: {
        totalStyles,
        batchProcessed: batchStyles.length,
        batchOffset: offset,
        garmentsUpdated: totalUpdated,
        garmentsSkipped: totalSkipped,
        errors: totalErrors,
        jobsReaggregated: jobsUpdated,
      },
      details: results.filter(r => r.status !== "already_correct"),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("bulk-reprice error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
