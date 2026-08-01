import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Verifies the caller's JWT and returns their user id, or null if the request
 * carries no *user* identity.
 *
 * The `sub` check is the important part. The project anon key is itself a valid
 * signed JWT (`role: "anon"`) with no `sub` claim, and it ships in the client
 * bundle — so a check of "did getClaims succeed" treats every visitor as
 * authenticated. Only a real user session has `sub`.
 */
export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await supabase.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string" || sub.length === 0) return null;
  return sub;
}

/**
 * For endpoints called both by pg_cron and by a signed-in user.
 *
 * Accepts the service-role key (how the scheduled jobs authenticate) or a real
 * user session. Rejects the anon key, which is public — that distinction is the
 * whole point, since the previous cron jobs presented the anon key and several
 * functions were written to trust it.
 */
export async function isServiceRoleOrUser(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (token && serviceRoleKey && token === serviceRoleKey) return true;

  return (await getUserId(req)) !== null;
}

export function unauthorized(body: Record<string, unknown> = { error: "Unauthorized" }): Response {
  return new Response(JSON.stringify(body), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Escapes text destined for an HTML email body. Anything that reaches a
 * customer's inbox from our authenticated sending domain must go through this.
 */
export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
