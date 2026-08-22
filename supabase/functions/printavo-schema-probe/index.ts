import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const email = Deno.env.get("PRINTAVO_API_EMAIL")!;
  const token = Deno.env.get("PRINTAVO_API_TOKEN")!;

  const q = `query { __type(name: "Mutation") { fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } } } }`;
  const res = await fetch("https://www.printavo.com/api/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", email, token },
    body: JSON.stringify({ query: q }),
  });
  const text = await res.text();
  let names: any[] = [];
  try {
    const j = JSON.parse(text);
    names = (j?.data?.__type?.fields ?? []).filter((f: any) => /productionFile/i.test(f.name));
  } catch {
    return new Response(JSON.stringify({ status: res.status, raw: text.slice(0, 500) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ fields: names }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
