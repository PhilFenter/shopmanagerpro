import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendSmsRequest {
  to: string;
  message: string;
  jobId?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid) {
      throw new Error("TWILIO_ACCOUNT_SID is not configured");
    }
    if (!authToken) {
      throw new Error("TWILIO_AUTH_TOKEN is not configured");
    }
    if (!fromNumber) {
      throw new Error("TWILIO_PHONE_NUMBER is not configured");
    }

    const { to, message, jobId }: SendSmsRequest = await req.json();

    // Validate required fields
    if (!to || !message) {
      throw new Error("Missing required fields: to, message");
    }

    // Clean and validate phone number (basic validation)
    const cleanedNumber = to.replace(/\D/g, "");
    if (cleanedNumber.length < 10) {
      throw new Error("Invalid phone number format");
    }

    // Format to E.164 if not already
    const formattedNumber = cleanedNumber.startsWith("1") 
      ? `+${cleanedNumber}` 
      : `+1${cleanedNumber}`;

    console.log(`Sending SMS to ${formattedNumber} for job ${jobId || 'unknown'} by user ${claims.claims.sub}`);

    // Send SMS via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", formattedNumber);
    formData.append("From", fromNumber);
    const fullMessage = `${message}\n\nReply STOP to unsubscribe. Msg & data rates may apply.`;
    formData.append("Body", fullMessage);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Twilio API error:", result);
      throw new Error(`Twilio error: ${result.message || 'Failed to send SMS'}`);
    }

    console.log("SMS sent successfully:", result.sid);

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: result.sid,
        to: formattedNumber,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-sms:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
