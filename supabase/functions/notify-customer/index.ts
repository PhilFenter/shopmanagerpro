import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STAGE_LABELS: Record<string, string> = {
  received: "Received",
  art_approved: "Art Approved",
  product_ordered: "Product Ordered",
  product_arrived: "Product Arrived",
  product_staged: "Product Staged",
  in_production: "In Production",
  production_complete: "Production Complete",
  qc_complete: "QC Complete",
  packaged: "Packaged",
  customer_notified: "Customer Notified",
  picked_up: "Picked Up",
  shipped: "Shipped",
  delivered: "Delivered",
};

Deno.serve(async (req) => {
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const body = await req.json();
    const { jobId, customerName, customerEmail, orderNumber, stage, source, customSubject, customBody } = body;

    console.log(`Notification request: job=${jobId}, stage=${stage}, source=${source}, email=${customerEmail}`);

    // Manual sends bypass source/settings checks
    const isManualSend = source === 'manual' && customBody;

    if (!isManualSend) {
      // Only Shopify and Printavo orders for automated notifications
      if (source !== "shopify" && source !== "printavo") {
        return new Response(JSON.stringify({ skipped: true, reason: "Not a Shopify or Printavo order" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!customerEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "No customer email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailBody: string;
    let subject: string;

    if (isManualSend) {
      // Direct manual send — use provided content
      emailBody = customBody;
      subject = customSubject || `Message from Hell's Canyon Designs`;
    } else {
      // Check notification settings for this stage
      const { data: settings, error: settingsError } = await supabase
        .from("notification_settings")
        .select("notify_customer, email_template, email_subject, custom_label")
        .eq("stage", stage)
        .maybeSingle();

      if (settingsError) {
        console.error("Error fetching notification settings:", settingsError);
        return new Response(JSON.stringify({ error: "Failed to check notification settings" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!settings?.notify_customer || !settings.email_template) {
        console.log(`Notifications disabled for stage: ${stage}`);
        return new Response(JSON.stringify({ skipped: true, reason: "Notifications disabled for this stage" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Replace template variables
      const stageLabel = settings.custom_label || STAGE_LABELS[stage] || stage;
      emailBody = settings.email_template
        .replace(/\{\{customer_name\}\}/g, customerName || "Customer")
        .replace(/\{\{order_number\}\}/g, orderNumber || "N/A")
        .replace(/\{\{stage\}\}/g, stageLabel);

      subject = settings.email_subject
        ? settings.email_subject
            .replace(/\{\{customer_name\}\}/g, customerName || "Customer")
            .replace(/\{\{order_number\}\}/g, orderNumber || "N/A")
            .replace(/\{\{stage\}\}/g, stageLabel)
        : `Order #${orderNumber || "N/A"} Update: ${stageLabel}`;
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Hell's Canyon Designs <info@mail.hellscanyondesigns.com>",
        reply_to: "info@hellscanyondesigns.com",
        to: [customerEmail],
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Order Status Update</h2>
            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="font-size: 16px; line-height: 1.6; color: #444; margin: 0;">
                ${emailBody.replace(/\n/g, "<br>")}
              </p>
            </div>
            <p style="color: #888; font-size: 12px; margin-top: 30px;">
              Hell's Canyon Designs — Custom Apparel & Embroidery
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", emailResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to send email", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResult = await emailResponse.json();
    console.log(`Email sent successfully to ${customerEmail} for stage ${stage}:`, emailResult);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id, stage, recipient: customerEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
