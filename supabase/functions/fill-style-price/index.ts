import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { styleNumber, piecePrice, brand, actionItemId } = await req.json();

    if (!styleNumber || !piecePrice || piecePrice <= 0) {
      return new Response(JSON.stringify({ error: "styleNumber and piecePrice (> 0) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Upsert into product_catalog
    const { error: catalogError } = await serviceClient
      .from("product_catalog")
      .upsert({
        style_number: styleNumber.toUpperCase().trim(),
        piece_price: piecePrice,
        brand: brand || null,
        supplier: "manual",
      }, { onConflict: "style_number,size_range,supplier" });

    if (catalogError) {
      console.error("Catalog upsert error:", catalogError);
      // Try insert if upsert fails (different supplier)
      await serviceClient.from("product_catalog").insert({
        style_number: styleNumber.toUpperCase().trim(),
        piece_price: piecePrice,
        brand: brand || null,
        supplier: "manual",
      });
    }

    // 2. Backfill all garments with matching style that have 0 cost
    const styleUpper = styleNumber.toUpperCase().trim();
    const patterns = [styleUpper, `R-${styleUpper}`, `R ${styleUpper}`];

    let totalUpdated = 0;
    const jobsAffected = new Set<string>();

    for (const pattern of patterns) {
      // Match by style column (ILIKE for flexibility)
      const { data: garments } = await serviceClient
        .from("job_garments")
        .select("id, job_id, quantity")
        .or(`style.ilike.${pattern}%,item_number.ilike.${pattern}%`)
        .or("total_cost.is.null,total_cost.eq.0");

      for (const g of garments || []) {
        const { error } = await serviceClient
          .from("job_garments")
          .update({ unit_cost: piecePrice, total_cost: piecePrice * g.quantity })
          .eq("id", g.id)
          .or("total_cost.is.null,total_cost.eq.0");

        if (!error) {
          totalUpdated++;
          jobsAffected.add(g.job_id);
        }
      }
    }

    // 3. Re-aggregate material_cost for affected jobs
    for (const jobId of jobsAffected) {
      const { data: jg } = await serviceClient
        .from("job_garments")
        .select("total_cost")
        .eq("job_id", jobId)
        .gt("total_cost", 0);

      if (jg && jg.length > 0) {
        const totalMaterial = jg.reduce((sum, g) => sum + (g.total_cost || 0), 0);
        await serviceClient.from("jobs").update({ material_cost: totalMaterial }).eq("id", jobId);
      }
    }

    // 4. Complete the action item if provided
    if (actionItemId) {
      await serviceClient
        .from("action_items")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", actionItemId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        styleNumber: styleUpper,
        piecePrice,
        garmentsUpdated: totalUpdated,
        jobsUpdated: jobsAffected.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fill-style-price error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
