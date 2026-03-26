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

/** Extract the base style number from a garment style string.
 *  e.g. "Port & Co Port & Co Core Cotton Tee. PC54" → "PC54"
 *  e.g. "Richardson Snapback Trucker Cap - 112" → "112"
 */
function extractStyleNumber(raw: string): string {
  // Try after last dot+space: "Brand Name Product. STYLE123"
  const dotMatch = raw.match(/\.\s*([A-Z0-9][\w-]*)\s*$/i);
  if (dotMatch) return dotMatch[1].toUpperCase().trim();
  // Try after last dash: "Product Name - STYLE123"
  const dashMatch = raw.match(/-\s*([A-Z0-9][\w-]*)\s*$/i);
  if (dashMatch) return dashMatch[1].toUpperCase().trim();
  // Try after last space if it looks like a style number
  const spaceMatch = raw.match(/\s([A-Z]{1,4}\d{2,}[\w]*)\s*$/i);
  if (spaceMatch) return spaceMatch[1].toUpperCase().trim();
  // Fallback: whole string
  return raw.toUpperCase().trim();
}

/** Strip common brand prefixes that don't match API (e.g. R-112 → 112) */
function normalizeStyleForApi(style: string): string {
  return style.replace(/^R-/i, "").replace(/^R\s+/i, "").trim();
}

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

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const dryRun = body.dryRun === true;

    // 1. Get all distinct style values from job_garments that have costs
    const { data: garments, error: gErr } = await serviceClient
      .from("job_garments")
      .select("id, job_id, style, item_number, quantity, unit_cost, total_cost")
      .gt("quantity", 0);

    if (gErr) throw new Error(`Failed to fetch garments: ${gErr.message}`);

    // Build map of distinct style numbers to look up
    const styleMap = new Map<string, string[]>(); // apiStyle → garment IDs
    const garmentLookup = new Map<string, typeof garments[0]>();

    for (const g of garments || []) {
      const rawStyle = g.style || g.item_number || "";
      if (!rawStyle) continue;

      garmentLookup.set(g.id, g);
      const extracted = extractStyleNumber(rawStyle);
      const normalized = normalizeStyleForApi(extracted);
      if (!normalized || normalized.length < 2) continue;

      if (!styleMap.has(normalized)) {
        styleMap.set(normalized, []);
      }
      styleMap.get(normalized)!.push(g.id);
    }

    console.log(`Found ${styleMap.size} distinct styles to price-check across ${(garments || []).length} garments`);

    const results: Array<{
      style: string;
      oldPrice: number;
      newPrice: number;
      garmentCount: number;
      status: string;
    }> = [];

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const jobsToReaggregate = new Set<string>();

    // 2. For each style, call SanMar getPricing for wholesale myPrice
    const styles = [...styleMap.entries()];

    for (const [apiStyle, garmentIds] of styles) {
      try {
        // Rate limit: small delay between API calls
        await new Promise(r => setTimeout(r, 300));

        const xml = await fetch("https://ws.sanmar.com:8080/SanMarWebService/SanMarPricingServicePort", {
          method: "POST",
          headers: { "Content-Type": "text/xml; charset=utf-8" },
          body: buildPricingRequest(sanmarUser, sanmarPass, sanmarCustNum, apiStyle),
        }).then(r => r.text());

        const errorOccurred = extractTag(xml, "errorOccured") || extractTag(xml, "errorOccurred");
        if (errorOccurred === "true") {
          const msg = extractTag(xml, "message");
          console.log(`Style ${apiStyle}: API error - ${msg}`);
          results.push({ style: apiStyle, oldPrice: 0, newPrice: 0, garmentCount: garmentIds.length, status: `api_error: ${msg}` });
          totalSkipped += garmentIds.length;
          continue;
        }

        // Find lowest myPrice across all color/size variants (base S-XL tier)
        const blocks = extractBlocks(xml, "listResponse");
        let lowestMyPrice = Infinity;
        for (const block of blocks) {
          const myPrice = parseFloat(extractTag(block, "myPrice")) || 0;
          if (myPrice > 0 && myPrice < lowestMyPrice) {
            lowestMyPrice = myPrice;
          }
        }

        if (lowestMyPrice === Infinity || lowestMyPrice <= 0) {
          console.log(`Style ${apiStyle}: no valid myPrice found`);
          results.push({ style: apiStyle, oldPrice: 0, newPrice: 0, garmentCount: garmentIds.length, status: "no_price" });
          totalSkipped += garmentIds.length;
          continue;
        }

        // 3. Update garments with this style
        let updated = 0;
        const sampleOldPrice = garmentLookup.get(garmentIds[0])?.unit_cost || 0;

        for (const gId of garmentIds) {
          const g = garmentLookup.get(gId)!;
          const currentCost = g.unit_cost || 0;

          // Skip if already at the correct price
          if (Math.abs(currentCost - lowestMyPrice) < 0.005) {
            continue;
          }

          const newTotal = lowestMyPrice * g.quantity;

          if (!dryRun) {
            const { error: updateErr } = await serviceClient
              .from("job_garments")
              .update({ unit_cost: lowestMyPrice, total_cost: newTotal })
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
          newPrice: lowestMyPrice,
          garmentCount: garmentIds.length,
          status: updated > 0 ? `updated ${updated}` : "already_correct",
        });

        console.log(`Style ${apiStyle}: $${sampleOldPrice} → $${lowestMyPrice} (${updated}/${garmentIds.length} updated)`);

      } catch (err) {
        console.error(`Style ${apiStyle} error:`, err);
        results.push({ style: apiStyle, oldPrice: 0, newPrice: 0, garmentCount: garmentIds.length, status: `error: ${err.message}` });
        totalErrors++;
      }
    }

    // 4. Re-aggregate material_cost for all affected jobs
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

      // 5. Also update product_catalog with wholesale prices
      for (const r of results) {
        if (r.newPrice > 0 && r.status.startsWith("updated")) {
          await serviceClient
            .from("product_catalog")
            .upsert({
              style_number: r.style,
              piece_price: r.newPrice,
              supplier: "sanmar_wholesale",
            }, { onConflict: "style_number,color_group,size_range,supplier" })
            .then(() => {});
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      summary: {
        totalStyles: styleMap.size,
        totalGarments: (garments || []).length,
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
