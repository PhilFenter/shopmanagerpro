import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendMockupRequest {
  jobId: string;
  photoIds: string[];
  customerEmail: string;
  customerName: string;
  message?: string;
  orderNumber?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { jobId, photoIds, customerEmail, customerName, message, orderNumber }: SendMockupRequest = await req.json();

    // Validate required fields
    if (!jobId || !photoIds?.length || !customerEmail || !customerName) {
      throw new Error("Missing required fields: jobId, photoIds, customerEmail, customerName");
    }

    console.log(`Sending mockup email for job ${jobId} to ${customerEmail}`);

    // Fetch photo URLs from database
    const { data: photos, error: photosError } = await supabase
      .from("job_photos")
      .select("storage_path, filename")
      .in("id", photoIds);

    if (photosError) {
      console.error("Error fetching photos:", photosError);
      throw new Error("Failed to fetch photo details");
    }

    if (!photos?.length) {
      throw new Error("No photos found for the provided IDs");
    }

    // Get public URLs for photos
    const photoUrls = photos.map((photo) => {
      const { data } = supabase.storage
        .from("job-photos")
        .getPublicUrl(photo.storage_path);
      return {
        url: data.publicUrl,
        filename: photo.filename,
      };
    });

    console.log(`Found ${photoUrls.length} photos to include in email`);

    // Build email HTML
    const orderRef = orderNumber ? ` (Order #${orderNumber})` : "";
    const customMessage = message || "Please review the attached mockup(s) for your upcoming order.";
    
    const photoHtml = photoUrls
      .map(
        (photo) => `
        <div style="margin-bottom: 20px;">
          <img src="${photo.url}" alt="${photo.filename}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          <p style="color: #666; font-size: 12px; margin-top: 8px;">${photo.filename}</p>
        </div>
      `
      )
      .join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <h1 style="color: #333; margin-bottom: 20px; font-size: 24px;">Mockup Approval Request${orderRef}</h1>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">Hi ${customerName},</p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">${customMessage}</p>
            
            <div style="margin: 30px 0;">
              ${photoHtml}
            </div>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">Please reply to this email with your approval or any changes you'd like to make.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            
            <p style="color: #999; font-size: 12px;">This is an automated message. Please reply directly to this email with any questions.</p>
          </div>
        </body>
      </html>
    `;

    // Send email
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "Mockup Approval <onboarding@resend.dev>", // Use verified domain in production
      to: [customerEmail],
      subject: `Mockup Approval Request${orderRef}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResult?.id,
        recipientEmail: customerEmail 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-mockup-email:", error);
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
