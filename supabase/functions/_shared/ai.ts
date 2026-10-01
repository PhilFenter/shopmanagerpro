// Shared AI config. ShopManagerPro moved off Lovable Cloud, so the Lovable AI
// gateway key (LOVABLE_API_KEY) no longer exists. Set these Supabase secrets:
//   AI_API_KEY   OpenAI API key (platform.openai.com)
//   AI_API_URL   https://api.openai.com/v1/chat/completions   (default)
//   AI_MODEL     gpt-4.1-mini                                 (default)
// Falls back to the Lovable gateway only if AI_API_KEY isn't set.
export function aiConfig(lovableModel = "google/gemini-2.5-flash") {
  const key = Deno.env.get("AI_API_KEY");
  if (key) {
    const url = Deno.env.get("AI_API_URL") || "https://api.openai.com/v1/chat/completions";
    return {
      key,
      url,
      model: Deno.env.get("AI_MODEL") || "gpt-4.1-mini",
      transcribeUrl: url.replace(/chat\/completions$/, "audio/transcriptions"),
      transcribeModel: Deno.env.get("AI_TRANSCRIBE_MODEL") || "gpt-4o-mini-transcribe",
    };
  }
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  if (!lovable) throw new Error("AI_API_KEY is not configured (set it in Supabase secrets)");
  return {
    key: lovable,
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    model: lovableModel,
    transcribeUrl: "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
    transcribeModel: "openai/gpt-4o-mini-transcribe",
  };
}
