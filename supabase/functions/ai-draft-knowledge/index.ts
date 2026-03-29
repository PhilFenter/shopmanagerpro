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

    const { type, prompt, department, category } = await req.json();
    // type: "sop" | "checklist"

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
- Generate 4-12 practical steps
- Each step should be actionable and specific
- Include tips for efficiency or quality where relevant
- Include warnings for safety-critical steps
- Use plain language a shop floor worker would understand
- Reference specific equipment, materials, and settings when appropriate
- Department context: ${department || 'General'}
- Category context: ${category || 'General'}
- Return ONLY valid JSON, no markdown fences`
      : `You are an expert checklist builder for Hell's Canyon Designs, a custom apparel shop doing embroidery, screen printing, DTF transfers, leather patches, and laser engraving.

Generate practical checklist items based on the user's description or pasted notes.

Return a JSON object with this exact structure:
{
  "title": "Checklist title",
  "description": "Brief description of when to use this checklist",
  "items": [
    {
      "text": "Checklist item text",
      "required": true
    }
  ]
}

Rules:
- Generate 5-15 clear, actionable checklist items
- Mark critical/safety items as required: true
- Mark nice-to-have items as required: false
- Keep items concise but specific
- Order items in logical sequence
- Department context: ${department || 'General'}
- Category context: ${category || 'General'}
- Return ONLY valid JSON, no markdown fences`;

    const tools = [
      {
        type: "function",
        function: {
          name: type === "sop" ? "generate_sop" : "generate_checklist",
          description: type === "sop" ? "Generate SOP steps from a description" : "Generate checklist items from a description",
          parameters: type === "sop"
            ? {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        content: { type: "string" },
                        tip: { type: "string", nullable: true },
                        warning: { type: "string", nullable: true },
                      },
                      required: ["title", "content"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "description", "steps"],
                additionalProperties: false,
              }
            : {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        required: { type: "boolean" },
                      },
                      required: ["text", "required"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "description", "items"],
                additionalProperties: false,
              },
        },
      },
    ];

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
          { role: "user", content: prompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: type === "sop" ? "generate_sop" : "generate_checklist" } },
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
    
    // Extract from tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }
    
    const result = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-draft-knowledge error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
