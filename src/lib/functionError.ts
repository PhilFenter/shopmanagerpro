// Turns a failed supabase.functions.invoke() into a message someone at the
// counter can act on.
//
// When an edge function returns a non-2xx status, supabase-js only gives us
// "Edge Function returned a non-2xx status code". The function's own reason
// (e.g. "Token expired") is in the response body, on error.context.

const HINTS: { match: RegExp; hint: string }[] = [
  {
    match: /token expired|invalid token|unauthorized|not authorized|credentials/i,
    hint: "Printavo API token needs replacing — tell Phil (Printavo API token → Supabase secret PRINTAVO_API_TOKEN).",
  },
  {
    match: /already pushed/i,
    hint: "This quote is already in Printavo — look it up there instead of pushing again.",
  },
  {
    match: /quote not found/i,
    hint: "The quote couldn't be loaded — refresh the page and try again.",
  },
  {
    match: /rate limit|too many requests/i,
    hint: "Printavo is busy — wait a minute and try again.",
  },
];

export async function describeFunctionError(err: unknown): Promise<string> {
  let message = err instanceof Error ? err.message : String(err ?? "Unknown error");

  // FunctionsHttpError carries the Response in .context
  const ctx = (err as any)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.clone().json();
      if (body?.error) message = String(body.error);
    } catch {
      try {
        const text = await ctx.clone().text();
        if (text) message = text.slice(0, 300);
      } catch {
        /* keep the generic message */
      }
    }
  }

  const hint = HINTS.find((h) => h.match.test(message))?.hint;
  return hint ? `${message} — ${hint}` : message;
}
