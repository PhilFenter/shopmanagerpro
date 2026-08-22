import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const email = Deno.env.get("PRINTAVO_API_EMAIL")!;
  const token = Deno.env.get("PRINTAVO_API_TOKEN")!;

  const q = `query { __schema { mutationType { fields { name } } } }`;
  const res = await fetch("https://www.printavo.com/api/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", email, token },
    body: JSON.stringify({ query: q }),
  });
  const text = await res.text();
  let names: string[] = [];
  try {
    const j = JSON.parse(text);
    names = (j?.data?.__schema?.mutationType?.fields ?? []).map((f: any) => f.name);
  } catch {
    return new Response(JSON.stringify({ status: res.status, raw: text.slice(0, 500) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const interesting = names.filter((n) =>
    /file|attach|upload|note|task|image|asset|document/i.test(n)
  );
  return new Response(JSON.stringify({ count: names.length, interesting, all: names }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
