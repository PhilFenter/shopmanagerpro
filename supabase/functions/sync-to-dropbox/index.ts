import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Exchange a long-lived refresh token for a short-lived access token. */
async function getAccessToken(): Promise<string> {
  // If only a static access token is configured (legacy), use it directly
  const legacyToken = Deno.env.get("DROPBOX_ACCESS_TOKEN");
  const refreshToken = Deno.env.get("DROPBOX_REFRESH_TOKEN");
  const appKey = Deno.env.get("DROPBOX_APP_KEY");
  const appSecret = Deno.env.get("DROPBOX_APP_SECRET");

  if (refreshToken && appKey && appSecret) {
    console.log("Refreshing Dropbox access token via OAuth...");
    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: appKey,
        client_secret: appSecret,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Token refresh failed:", res.status, errorText);
      throw new HttpError(401, "Failed to refresh Dropbox token. Check app credentials.");
    }

    const data = await res.json();
    console.log("Dropbox token refreshed successfully, expires in", data.expires_in, "seconds");
    return data.access_token;
  }

  if (legacyToken) {
    console.warn("Using legacy static DROPBOX_ACCESS_TOKEN — this will expire. Set up refresh token for permanent access.");
    return legacyToken;
  }

  throw new HttpError(500, "Dropbox is not configured. Add DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, and DROPBOX_APP_SECRET.");
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get a fresh Dropbox access token
    const dropboxToken = await getAccessToken();

    const { artwork_url, customer_name, filename } = await req.json();

    if (!artwork_url || !customer_name) {
      return new Response(
        JSON.stringify({ error: "Missing artwork_url or customer_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!artwork_url.includes("/storage/v1/object/public/quote-artwork/")) {
      return new Response(
        JSON.stringify({ error: "Invalid artwork URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileResponse = await fetch(artwork_url);
    if (!fileResponse.ok) {
      throw new HttpError(fileResponse.status, `Failed to fetch artwork [${fileResponse.status}]`);
    }

    const fileBuffer = await fileResponse.arrayBuffer();

    const safeName = customer_name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Unknown";
    const safeFilename = filename || artwork_url.split("/").pop()?.split("?")[0] || "artwork";
    const dropboxPath = `/${safeName}/${safeFilename}`;

    console.log(`Uploading to Dropbox: ${dropboxPath} (${fileBuffer.byteLength} bytes)`);

    const dropboxResponse = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${dropboxToken}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: dropboxPath,
          mode: "add",
          autorename: true,
          mute: false,
        }),
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer,
    });

    if (!dropboxResponse.ok) {
      const errorBody = await dropboxResponse.text();
      console.error("Dropbox upload error:", dropboxResponse.status, errorBody);
      throw new HttpError(dropboxResponse.status, `Dropbox upload failed [${dropboxResponse.status}]: ${errorBody}`);
    }

    const result = await dropboxResponse.json();
    console.log("Dropbox upload success:", result.path_display);

    return new Response(
      JSON.stringify({
        success: true,
        path: result.path_display,
        size: result.size,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("sync-to-dropbox error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof HttpError ? error.status : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
