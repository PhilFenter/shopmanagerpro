// Staff-only: records a customer's "yes" to marketing email and adds them to
// the HCD Email List in Klaviyo. Also answers { action: "check" } so staff can
// confirm the Klaviyo key works without subscribing anyone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUserId, unauthorized } from "../_shared/auth.ts";
import { checkConnection, subscribeToEmailList } from "../_shared/klaviyo.ts";

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Signed-in staff only. The public anon key is rejected by getUserId.
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  let body: { action?: string; customer_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  if (body.action === "check") {
    const result = await checkConnection();
    return json(result, result.ok ? 200 : 502);
  }

  if (typeof body.customer_id !== "string" || !body.customer_id) {
    return json({ error: "customer_id is required" }, 400);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: customer, error } = await db
    .from("customers")
    .select("id, name, email, company")
    .eq("id", body.customer_id)
    .maybeSingle();
  if (error || !customer) return json({ error: "Customer not found" }, 404);
  if (!customer.email) return json({ error: "Add an email address to this customer first." }, 400);

  const result = await subscribeToEmailList({
    email: customer.email,
    name: customer.name,
    company: customer.company,
    source: "counter",
    detail: userId,
  });
  if (!result.ok) {
    console.error("Counter signup failed:", result.error);
    return json({ error: result.error }, 502);
  }

  await db.from("customers").update({
    email_marketing_consent: true,
    email_marketing_consent_at: new Date().toISOString(),
    email_marketing_consent_source: "counter",
    email_marketing_consent_by: userId,
    klaviyo_synced_at: new Date().toISOString(),
  }).eq("id", customer.id);

  return json({ ok: true });
});
