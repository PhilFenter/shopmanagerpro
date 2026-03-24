import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { customerName, customerEmail, customerPhone, company, context, channel, totalRevenue, totalOrders, lastOrderDate } = await req.json();

    const systemPrompt = `You are a professional email/SMS writer for Hell's Canyon Designs, a custom apparel and headwear shop in Lewiston, Idaho. 
You write warm, professional, and concise messages. You never use overly formal language — keep it friendly and human.
The shop does embroidery, screen printing, DTF transfers, leather patches, and custom hats.
Contact: info@hellscanyondesigns.com / 208-748-6242.

Rules:
- Keep emails under 150 words, SMS under 160 characters
- Use the customer's first name
- Reference their history when relevant
- Include a clear call to action
- For re-engagement: mention specific services or past work
- Never use exclamation marks excessively
- Sound like a real person, not a bot`;

    const firstName = (customerName || "there").split(" ")[0];
    const historyContext = totalRevenue > 0
      ? `Customer history: ${totalOrders || 0} orders, $${totalRevenue?.toLocaleString()} lifetime value. Last order: ${lastOrderDate || 'unknown'}.`
      : "New or light customer — no significant order history.";

    const userPrompt = `Draft a ${channel === 'sms' ? 'SMS message' : 'email'} for:
Customer: ${customerName || 'Unknown'}${company ? ` (${company})` : ''}
${historyContext}
${customerEmail ? `Email: ${customerEmail}` : ''}${customerPhone ? ` Phone: ${customerPhone}` : ''}

Context/purpose: ${context}

${channel === 'email' ? 'Provide a subject line on the first line prefixed with "Subject: " then the email body.' : 'Keep it under 160 characters.'}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse subject from email drafts
    let subject = "";
    let body = content;
    if (channel === "email") {
      const lines = content.split("\n");
      const subjectLine = lines.find((l: string) => l.toLowerCase().startsWith("subject:"));
      if (subjectLine) {
        subject = subjectLine.replace(/^subject:\s*/i, "").trim();
        body = lines.filter((l: string) => l !== subjectLine).join("\n").trim();
      }
    }

    return new Response(
      JSON.stringify({ subject, body }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-draft-message error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
