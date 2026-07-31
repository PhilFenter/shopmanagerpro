const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action_item } = await req.json();
    if (!action_item) {
      return new Response(JSON.stringify({ error: "action_item required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const to = Deno.env.get("NEW_QUOTE_ALERT_EMAIL");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!to || !resendKey) {
      return new Response(JSON.stringify({ error: "Missing config" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const a = action_item;
    const sourceLabel = a.source === "website" ? "Website Quote Request"
      : a.source === "shopify-sync" ? "Shopify Order"
      : "New Action Item";

    const appUrl = "https://shopmanagerpro.lovable.app";
    const link = `${appUrl}/action-items`;

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f3f4f6;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.05);">
  <tr><td style="background:linear-gradient(135deg,#0284c7,#0369a1);padding:24px 32px;">
    <h1 style="margin:0;color:#fff;font-size:20px;">${esc(sourceLabel)}</h1>
    <p style="margin:6px 0 0;color:#bae6fd;font-size:13px;">A new action item just arrived</p>
  </td></tr>
  <tr><td style="padding:24px 32px;">
    ${a.customer_name ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Customer</p><p style="margin:0 0 16px;font-size:16px;color:#111827;font-weight:600;">${esc(a.customer_name)}</p>` : ""}
    ${a.title ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Subject</p><p style="margin:0 0 16px;font-size:15px;color:#111827;">${esc(a.title)}</p>` : ""}
    ${a.description ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Details</p><p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.5;white-space:pre-wrap;">${esc(a.description)}</p>` : ""}
    ${a.priority ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Priority: <strong style="color:#111827;">${esc(a.priority)}</strong></p>` : ""}
    <div style="text-align:center;margin-top:24px;">
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">Open Action Items</a>
    </div>
  </td></tr>
  <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Hell's Canyon Designs · Alert</p>
  </td></tr>
</table></td></tr></table></body></html>`;

    const subject = `${sourceLabel}${a.customer_name ? `: ${a.customer_name}` : ""}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Hell's Canyon Designs <alerts@hellscanyondesigns.com>",
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Resend error", data);
      return new Response(JSON.stringify({ error: "send failed", details: data }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
