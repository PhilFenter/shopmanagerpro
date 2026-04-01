import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- AUTH CHECK ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await authClient.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- END AUTH CHECK ---

    const { quoteId } = await req.json();
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "quoteId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch quote with line items
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*, quote_line_items(*)")
      .eq("id", quoteId)
      .single();

    if (qErr || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!quote.customer_email) {
      return new Response(JSON.stringify({ error: "No customer email on this quote" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate approval token if not exists
    let approvalToken = quote.approval_token;
    if (!approvalToken) {
      approvalToken = crypto.randomUUID();
      await supabase
        .from("quotes")
        .update({ approval_token: approvalToken })
        .eq("id", quoteId);
    }

    // Build the approval URL
    const appUrl = "https://shopmanagerpro.lovable.app";
    const approvalUrl = `${appUrl}/quote/approve/${approvalToken}`;

    // Calculate totals
    const subtotal = quote.total_price || 0;
    const taxRate = quote.apply_sales_tax ? (quote.tax_rate || 6) : 0;
    const taxAmount = subtotal * (taxRate / 100);
    const grandTotal = subtotal + taxAmount;

    // Build line items HTML
    const lineItemsHtml = (quote.quote_line_items || [])
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((item: any) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">
            ${item.description || item.service_type || "Item"}
            ${item.style_number ? `<br><span style="color: #6b7280; font-size: 12px;">${item.style_number}</span>` : ""}
            ${item.color ? `<br><span style="color: #6b7280; font-size: 12px;">Color: ${item.color}</span>` : ""}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">${item.quantity}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px;">$${(item.line_total || 0).toFixed(2)}</td>
        </tr>
      `).join("");

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 32px 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Hell's Canyon Designs</h1>
            <p style="margin: 8px 0 0; color: #bae6fd; font-size: 14px;">Quote ${quote.quote_number || ""}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding: 32px 40px 16px;">
            <p style="margin: 0; font-size: 16px; color: #111827;">Hi ${quote.customer_name},</p>
            <p style="margin: 12px 0 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
              Thank you for your interest! Here's your quote for the items we discussed. Please review the details below and click the button to approve${quote.requested_date ? ` — requested by <strong>${new Date(quote.requested_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>` : ""}.
            </p>
          </td>
        </tr>

        <!-- Line Items -->
        <tr>
          <td style="padding: 0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
              <tr style="background-color: #f9fafb;">
                <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">Item</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">Qty</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">Total</th>
              </tr>
              ${lineItemsHtml}
            </table>
          </td>
        </tr>

        <!-- Totals -->
        <tr>
          <td style="padding: 16px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Subtotal</td>
                <td style="padding: 6px 0; font-size: 14px; color: #111827; text-align: right; font-weight: 500;">$${subtotal.toFixed(2)}</td>
              </tr>
              ${taxAmount > 0 ? `
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Sales Tax (${taxRate}%)</td>
                <td style="padding: 6px 0; font-size: 14px; color: #111827; text-align: right; font-weight: 500;">$${taxAmount.toFixed(2)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding: 12px 0 6px; font-size: 18px; color: #111827; font-weight: 700; border-top: 2px solid #e5e7eb;">Total</td>
                <td style="padding: 12px 0 6px; font-size: 18px; color: #0284c7; text-align: right; font-weight: 700; border-top: 2px solid #e5e7eb;">$${grandTotal.toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>

        ${quote.notes ? `
        <tr>
          <td style="padding: 16px 40px 0;">
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
              <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">Notes</p>
              <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.5;">${quote.notes}</p>
            </div>
          </td>
        </tr>` : ""}

        <!-- CTA -->
        <tr>
          <td style="padding: 32px 40px; text-align: center;">
            <a href="${approvalUrl}" style="display: inline-block; background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.02em;">
              View &amp; Approve Quote
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5;">
              Hell's Canyon Designs · Custom Apparel &amp; Embroidery<br>
              Questions? Reply to this email or call us.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Hell's Canyon Designs <quotes@hellscanyondesigns.com>",
        to: [quote.customer_email],
        subject: `Quote ${quote.quote_number || ""} — $${grandTotal.toFixed(2)} | Hell's Canyon Designs`,
        html: emailHtml,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      return new Response(JSON.stringify({ error: "Failed to send email", details: resendData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update quote status
    await supabase
      .from("quotes")
      .update({
        status: "sent",
        quote_sent_at: new Date().toISOString(),
      })
      .eq("id", quoteId);

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id, approvalUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
