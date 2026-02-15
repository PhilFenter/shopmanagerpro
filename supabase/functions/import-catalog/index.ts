import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { rows, supplier = "sanmar", clear_existing = false } = body;

    if (!rows || !Array.isArray(rows)) {
      throw new Error("Missing rows array");
    }

    // Optionally clear existing catalog for this supplier
    if (clear_existing) {
      await supabase.from("product_catalog").delete().eq("supplier", supplier);
    }

    // Process in batches of 500
    const BATCH_SIZE = 500;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map((row: any) => ({
        style_number: String(row.style_number || '').toUpperCase().trim(),
        description: String(row.description || '').trim() || null,
        brand: String(row.brand || '').trim() || null,
        category: String(row.category || '').trim() || null,
        color_group: String(row.color_group || '').trim() || null,
        size_range: String(row.size_range || '').trim() || null,
        case_price: parseFloat(row.case_price) || 0,
        piece_price: parseFloat(row.piece_price) || 0,
        price_code: String(row.price_code || '').trim() || null,
        msrp: parseFloat(row.msrp) || 0,
        map_price: parseFloat(row.map_price) || 0,
        supplier,
      })).filter((r: any) => r.style_number);

      // Deduplicate within batch (keep last occurrence per style+size+supplier)
      const deduped = new Map();
      for (const item of batch) {
        const key = `${item.style_number}|${item.size_range}|${item.supplier}`;
        deduped.set(key, item);
      }
      const uniqueBatch = [...deduped.values()];

      const { data, error } = await supabase
        .from("product_catalog")
        .upsert(uniqueBatch, { 
          onConflict: "style_number,size_range,supplier",
          ignoreDuplicates: false 
        })
        .select("id");

      if (error) {
        console.error(`Batch ${i} error:`, error);
        skipped += batch.length;
      } else {
        inserted += data?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted, skipped, total: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
