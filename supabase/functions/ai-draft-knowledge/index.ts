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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { type, prompt, department, category, sopContext } = await req.json();

    const systemPrompt = type === "sop"
      ? `You are an expert SOP writer for Hell's Canyon Designs, a custom apparel shop doing embroidery, screen printing, DTF transfers, leather patches, and laser engraving.

Generate detailed, practical SOP steps based on the user's description or pasted notes.

Return a JSON object with this exact structure:
{
  "title": "SOP title",
  "description": "Brief description of what this SOP covers",
  "steps": [
    {
      "title": "Step title",
      "content": "Detailed step instructions",
      "tip": "Optional pro tip or null",
      "warning": "Optional safety warning or null"
    }
  ]
}

Rules:
- Generate 4-10 steps depending on complexity
- Be specific to custom apparel/decoration industry
- Include safety warnings where relevant
- Include pro tips for efficiency
- Use plain language a shop worker can follow
- Reference specific equipment names when relevant (Barudan, ROQ, Hotronix, etc.)
${department ? `\nDepartment context: ${department}` : ""}
${category ? `\nCategory context: ${category}` : ""}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences.`
      : `You are an expert quality/process checklist writer for Hell's Canyon Designs, a custom apparel shop.

Generate a practical checklist based on the user's description or pasted notes.

Return a JSON object with this exact structure:
{
  "title": "Checklist title",
  "description": "Brief description",
  "items": [
    {
      "label": "Checklist item text",
      "required": true
    }
  ]
}

Rules:
- Generate 5-15 items depending on complexity
- Mark critical quality/safety items as required: true
- Mark nice-to-have items as required: false
- Use clear, actionable language
- Be specific to the decoration/apparel industry
${department ? `\nDepartment context: ${department}` : ""}
${category ? `\nCategory context: ${category}` : ""}
${sopContext ? `\nIMPORTANT — The user has linked the following SOP. Base the checklist items directly on these SOP steps:\n\n${sopContext}` : ""}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
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
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // Strip markdown fences if present
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", raw);
      throw new Error("AI returned invalid JSON — try rephrasing your prompt");
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-draft-knowledge error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
