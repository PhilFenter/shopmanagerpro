import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SERVICE_LABELS: Record<string, string> = {
  leather_patch: "custom hats",
  custom_hats: "custom hats",
  embroidery: "embroidery",
  screen_print: "screen printing",
  dtf: "DTF transfers",
  other: "custom apparel",
};

// Escalating sequence config: [days_since_created, follow_up_count_required]
const ESCALATION_STEPS = [
  { minDays: 3, count: 0, tone: "gentle" },
  { minDays: 7, count: 1, tone: "firmer" },
  { minDays: 14, count: 2, tone: "final" },
] as const;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFollowUpEmail(params: {
  firstName: string;
  serviceLabel: string;
  quoteNumber: string;
  totalPrice?: number | null;
  printavoVisualId?: string | null;
  tone: "gentle" | "firmer" | "final";
}): { subject: string; html: string } {
  const { firstName, serviceLabel, quoteNumber, totalPrice, printavoVisualId, tone } = params;

  const toneConfig = {
    gentle: {
      subject: `Still thinking it over? — Hell's Canyon Designs (Quote #${quoteNumber})`,
      heading: `Hey ${escapeHtml(firstName)}! 👋`,
      body: `You requested a quote for <strong>${escapeHtml(serviceLabel)}</strong> a few days ago (Quote #${escapeHtml(quoteNumber)}). Still thinking it over?`,
      followUp: `No pressure at all — we just wanted to make sure your request didn't slip through the cracks. If you have any questions about pricing, timelines, or artwork, we're happy to help.`,
    },
    firmer: {
      subject: `Your quote is waiting — Hell's Canyon Designs (#${quoteNumber})`,
      heading: `Hey ${escapeHtml(firstName)}, quick check-in`,
      body: `We wanted to follow up on your <strong>${escapeHtml(serviceLabel)}</strong> quote (#${escapeHtml(quoteNumber)}) from about a week ago.`,
      followUp: `We'd love to get this on the production schedule for you. If pricing or timing needs adjusting, just let us know — we're flexible and happy to work with you.`,
    },
    final: {
      subject: `Last call on your quote — Hell's Canyon Designs (#${quoteNumber})`,
      heading: `Hey ${escapeHtml(firstName)} — one last nudge`,
      body: `Your <strong>${escapeHtml(serviceLabel)}</strong> quote (#${escapeHtml(quoteNumber)}) has been sitting for a couple weeks now.`,
      followUp: `We totally understand if the timing isn't right. This will be our last reminder — but know that we're here whenever you're ready. Just reply to this email or text us anytime.`,
    },
  };

  const config = toneConfig[tone];

  const estimateBlock = totalPrice
    ? `<tr><td style="padding:16px 0;">
        <div style="background:#1a1a2e;border-radius:8px;padding:20px;text-align:center;">
          <div style="color:#a0a0b0;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Your Estimate</div>
          <div style="color:#ffffff;font-size:28px;font-weight:700;">$${totalPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </td></tr>`
    : "";

  const approveBlock = printavoVisualId
    ? `<div style="margin-top:24px;text-align:center;">
        <a href="https://www.printavo.com/invoices/${escapeHtml(printavoVisualId)}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">View &amp; Approve Your Quote</a>
      </div>
      <p style="text-align:center;color:#888;font-size:12px;margin-top:8px;">Click above to review details, approve, and pay — all in one step.</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#0f0f1a;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">HELL'S CANYON DESIGNS</div>
          <div style="color:#a0a0b0;font-size:13px;margin-top:4px;">Custom Apparel &amp; Headwear — Lewiston, ID</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:40px;">
          <h1 style="margin:0 0 8px 0;font-size:22px;color:#1a1a2e;">${config.heading}</h1>
          <p style="margin:0 0 24px 0;color:#555;font-size:15px;line-height:1.6;">${config.body}</p>
          <p style="margin:0 0 24px 0;color:#555;font-size:15px;line-height:1.6;">${config.followUp}</p>
          ${estimateBlock}
          ${approveBlock}
          <div style="margin-top:32px;text-align:center;">
            <a href="mailto:info@hellscanyondesigns.com" style="display:inline-block;background:#0f0f1a;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">Reply to This Email</a>
          </div>
          <div style="margin-top:24px;text-align:center;padding:20px;background:#f8f8fb;border-radius:8px;">
            <div style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Prefer to text?</div>
            <a href="sms:2087486242" style="font-size:20px;font-weight:700;color:#0f0f1a;text-decoration:none;">208-748-6242</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8f8fb;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#aaa;font-size:12px;">
            Hell's Canyon Designs · Lewiston, Idaho<br>
            <a href="https://hellscanyondesigns.com" style="color:#888;">hellscanyondesigns.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: config.subject, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    // delay_days overrides the default step 1 timing (for manual triggers)
    const customDelayDays = typeof body.delay_days === "number" ? body.delay_days : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Query quotes eligible for follow-up:
    // - status is draft or sent (not approved/paid/converted)
    // - has customer email
    // - no converted job
    // - follow_up_count < 3 (max 3 in the escalation sequence)
    const { data: quotes, error: qErr } = await supabase
      .from("quotes")
      .select("id, quote_number, customer_name, customer_email, total_price, created_at, printavo_visual_id, follow_up_sent_at, follow_up_count, status")
      .in("status", ["draft", "sent"])
      .is("converted_job_id", null)
      .not("customer_email", "is", null)
      .lt("follow_up_count", 3)
      .order("created_at", { ascending: true });

    if (qErr) throw new Error(`Query error: ${qErr.message}`);

    const now = new Date();
    const eligible: Array<{
      quote: typeof quotes extends (infer T)[] ? T : never;
      step: typeof ESCALATION_STEPS[number];
    }> = [];

    for (const q of quotes || []) {
      const createdAt = new Date(q.created_at);
      const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const currentCount = q.follow_up_count || 0;

      // Find the next step in the escalation sequence
      const nextStep = ESCALATION_STEPS.find(
        (s) => s.count === currentCount && daysSinceCreated >= (customDelayDays ?? s.minDays)
      );

      if (nextStep) {
        // Also ensure we don't send too frequently (at least 2 days since last follow-up)
        if (q.follow_up_sent_at) {
          const daysSinceLastFollowUp = Math.floor(
            (now.getTime() - new Date(q.follow_up_sent_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceLastFollowUp < 2) continue;
        }
        eligible.push({ quote: q, step: nextStep });
      }
    }

    const results: Array<{
      quote_id: string;
      quote_number: string | null;
      email: string;
      status: string;
      tone?: string;
    }> = [];

    if (dryRun) {
      for (const { quote: q, step } of eligible) {
        results.push({
          quote_id: q.id,
          quote_number: q.quote_number,
          email: q.customer_email!,
          status: "eligible",
          tone: step.tone,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          eligible: eligible.length,
          sent: 0,
          skipped: 0,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Live send
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    let sent = 0;
    let skipped = 0;

    for (const { quote: q, step } of eligible) {
      try {
        // Fetch first line item for service type
        const { data: lineItems } = await supabase
          .from("quote_line_items")
          .select("service_type")
          .eq("quote_id", q.id)
          .order("sort_order", { ascending: true })
          .limit(1);

        const serviceType = lineItems?.[0]?.service_type || "other";
        const serviceLabel = SERVICE_LABELS[serviceType] || serviceType;
        const firstName = (q.customer_name || "there").split(" ")[0];
        const quoteNumber = q.quote_number || q.id.slice(0, 8);

        const { subject, html } = buildFollowUpEmail({
          firstName,
          serviceLabel,
          quoteNumber,
          totalPrice: q.total_price,
          printavoVisualId: q.printavo_visual_id,
          tone: step.tone,
        });

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Hell's Canyon Designs <info@mail.hellscanyondesigns.com>",
            to: [q.customer_email],
            subject,
            html,
            reply_to: "info@hellscanyondesigns.com",
          }),
        });

        if (emailRes.ok) {
          const newCount = (q.follow_up_count || 0) + 1;
          await supabase
            .from("quotes")
            .update({
              follow_up_sent_at: new Date().toISOString(),
              follow_up_count: newCount,
            })
            .eq("id", q.id);

          sent++;
          results.push({
            quote_id: q.id,
            quote_number: q.quote_number,
            email: q.customer_email!,
            status: "sent",
            tone: step.tone,
          });
        } else {
          const errText = await emailRes.text();
          console.error(`Failed to send to ${q.customer_email}:`, errText);
          skipped++;
          results.push({
            quote_id: q.id,
            quote_number: q.quote_number,
            email: q.customer_email!,
            status: "failed",
            tone: step.tone,
          });
        }
      } catch (err) {
        console.error(`Error processing quote ${q.id}:`, err);
        skipped++;
        results.push({
          quote_id: q.id,
          quote_number: q.quote_number,
          email: q.customer_email!,
          status: "error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: false,
        eligible: eligible.length,
        sent,
        skipped,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("quote-follow-up error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
