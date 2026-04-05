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

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- END AUTH CHECK ---

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { sop_title, sop_description, steps, skill_name, department, evaluator_notes } = await req.json();

    if (!steps?.length) {
      throw new Error("No SOP steps provided — add steps to the SOP first.");
    }

    // Format the SOP content for the prompt
    const sopContent = steps
      .map((s: any, i: number) =>
        `Step ${i + 1}: ${s.title}\n${s.content ?? ""}${s.tip ? `\nTip: ${s.tip}` : ""}${s.warning ? `\nWarning: ${s.warning}` : ""}`
      )
      .join("\n\n");

    const systemPrompt = `You are writing practical test standards for Hell's Canyon Designs, a custom decorated apparel shop. 
Think of this like the FAA's Practical Test Standards — the SOP is the Advisory Circular that teaches the task, and you are writing the PTS standard that defines what a passing performance looks like.

Your output defines what the evaluator will observe during a live check ride. It must be:
- Specific and observable (no vague language like "properly" or "correctly")
- Measurable where possible (tolerances, time limits, attempt counts)
- Written for real shop conditions (production garments, actual equipment, no practice runs)
- Unambiguous — a second evaluator reading this would make the same pass/fail call

Return a JSON object with this exact structure:
{
  "minimum_acceptable_standard": "2-4 sentence statement of exactly what passing looks like. Include: what the candidate must do, to what tolerance/quality level, under what constraints (first attempt, no coaching, production material), and any time standard if relevant.",
  "conditions": "The specific equipment, setup, and environmental conditions that must be in place for this check ride to be valid.",
  "suggested_skill_name": "A short, specific skill name if different from what was provided.",
  "key_tolerances": ["specific measurable tolerance 1", "specific measurable tolerance 2"],
  "common_failure_points": ["thing evaluators commonly see that causes a no-pass", "another common failure point"]
}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences.`;

    const userPrompt = `SOP Title: ${sop_title}
${sop_description ? `SOP Description: ${sop_description}\n` : ""}
Skill Being Evaluated: ${skill_name || sop_title}
Department: ${department || "General"}
${evaluator_notes ? `Additional context from evaluator: ${evaluator_notes}\n` : ""}

SOP CONTENT:
${sopContent}

Draft the minimum acceptable standard and check ride conditions for this skill.`;

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
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", raw);
      throw new Error("AI returned invalid JSON — try again");
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-draft-standard error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});