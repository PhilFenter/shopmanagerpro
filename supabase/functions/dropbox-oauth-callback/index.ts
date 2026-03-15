import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated
    const anonClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code } = await req.json();
    if (!code) {
      return new Response(JSON.stringify({ error: "Missing authorization code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appKey = Deno.env.get("DROPBOX_APP_KEY");
    const appSecret = Deno.env.get("DROPBOX_APP_SECRET");
    if (!appKey || !appSecret) {
      return new Response(JSON.stringify({ error: "Dropbox app credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange authorization code for refresh token
    const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: appKey,
        client_secret: appSecret,
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Dropbox token exchange failed:", tokenRes.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to exchange code. It may have expired — try connecting again." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenRes.json();
    const refreshToken = tokenData.refresh_token;

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: "No refresh token received from Dropbox" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store refresh token in business_settings using service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: upsertError } = await adminClient
      .from("business_settings")
      .upsert(
        { key: "dropbox_refresh_token", value: JSON.stringify(refreshToken) },
        { onConflict: "key" }
      );

    if (upsertError) {
      console.error("Failed to save refresh token:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also store connection status
    await adminClient
      .from("business_settings")
      .upsert(
        { key: "dropbox_connected", value: JSON.stringify(true) },
        { onConflict: "key" }
      );

    console.log("Dropbox refresh token saved successfully for user:", user.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("dropbox-oauth-callback error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
