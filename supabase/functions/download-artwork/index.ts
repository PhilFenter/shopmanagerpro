import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not configured");
    }

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url, filename } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and compare against our own storage origin. A substring test here
    // is an SSRF: this runs server-side, so any host that merely contains the
    // expected path (e.g. http://169.254.169.254/storage/v1/object/public/
    // quote-artwork/x) would be fetched and its body returned to the caller.
    let artworkUrl: URL;
    try {
      artworkUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid artwork URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storageOrigin = new URL(supabaseUrl).origin;
    const isOwnArtwork =
      artworkUrl.origin === storageOrigin &&
      artworkUrl.pathname.startsWith("/storage/v1/object/public/quote-artwork/");

    if (!isOwnArtwork) {
      return new Response(JSON.stringify({ error: "Invalid artwork URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileResponse = await fetch(artworkUrl.toString());
    if (!fileResponse.ok) {
      const body = await fileResponse.text();
      throw new Error(`Failed to fetch artwork [${fileResponse.status}]: ${body}`);
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";
    // Strip quotes, control characters and path separators — this value is
    // interpolated into a response header.
    const requestedFilename = typeof filename === "string" ? filename.replace(/[^\w.\- ]+/g, "").trim() : "";
    const safeFilename = requestedFilename.length > 0 ? requestedFilename.slice(0, 128) : "artwork";

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("download-artwork error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
