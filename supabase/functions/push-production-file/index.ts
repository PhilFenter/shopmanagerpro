import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUserId, unauthorized } from "../_shared/auth.ts";

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getUserId(req);
    if (!userId) return unauthorized();

    const email = Deno.env.get("PRINTAVO_API_EMAIL");
    const token = Deno.env.get("PRINTAVO_API_TOKEN");
    if (!email || !token) {
      return json({ error: "Printavo API credentials are not configured" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const jobId: unknown = body?.jobId;
    const fileUrl: unknown = body?.fileUrl;

    if (typeof jobId !== "string" || jobId.length < 10) {
      return json({ error: "jobId is required" }, 400);
    }
    if (typeof fileUrl !== "string" || !/^https:\/\//i.test(fileUrl)) {
      return json({ error: "A valid https fileUrl is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, source, external_id, order_number, invoice_number, customer_name")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr) return json({ error: jobErr.message }, 400);
    if (!job) return json({ error: "Job not found" }, 404);

    const printavoId = job.source === "printavo" ? job.external_id : null;
    if (!printavoId) {
      return json(
        {
          error:
            "This job isn't linked to a Printavo order, so there's nowhere to attach the file. Link it to a Printavo job first.",
        },
        409,
      );
    }

    const gql = async (query: string, variables: Record<string, unknown>) => {
      const res = await fetch(PRINTAVO_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", email, token },
        body: JSON.stringify({ query, variables }),
      });
      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.error(`Printavo returned non-JSON [${res.status}]: ${text.slice(0, 500)}`);
      }
      return { ok: res.ok, status: res.status, parsed, text };
    };

    // The stored external_id is not always the GraphQL node id Printavo expects
    // for productionFileCreate, so resolve the real order id first.
    const searchTerm = String(job.order_number || job.invoice_number || printavoId);
    let parentId: string | null = null;

    const direct = await gql(`query O($id: ID!) { order(id: $id) { id } }`, {
      id: String(printavoId),
    });
    if (direct.parsed?.data?.order?.id) {
      parentId = String(direct.parsed.data.order.id);
    } else {
      const search = await gql(
        `query S($q: String!) {
          invoices(first: 5, searchTerm: $q) { nodes { id visualId } }
          quotes(first: 5, searchTerm: $q) { nodes { id visualId } }
        }`,
        { q: searchTerm },
      );
      const nodes = [
        ...(search.parsed?.data?.invoices?.nodes ?? []),
        ...(search.parsed?.data?.quotes?.nodes ?? []),
      ];
      const match =
        nodes.find((n: any) => String(n?.visualId) === searchTerm) ?? nodes[0] ?? null;
      if (match?.id) parentId = String(match.id);
    }

    if (!parentId) {
      return json(
        {
          error: `Couldn't find Printavo order ${searchTerm}. Re-sync the job from Printavo and try again.`,
        },
        404,
      );
    }

    const mutation = `
      mutation ProductionFileCreate($parentId: ID!, $publicFileUrl: String!) {
        productionFileCreate(parentId: $parentId, publicFileUrl: $publicFileUrl) {
          id
          fileUrl
        }
      }
    `;

    const { ok, status, parsed, text } = await gql(mutation, {
      parentId,
      publicFileUrl: fileUrl,
    });

    if (!ok) {
      console.error(`Printavo request failed [${status}]: ${text.slice(0, 800)}`);
      return json({ error: "Printavo rejected the upload", status, details: text.slice(0, 800) }, status);
    }
    if (!parsed) {
      return json({ error: "Printavo returned an unexpected response" }, 502);
    }

    if (parsed.errors?.length) {
      console.error("Printavo GraphQL errors:", JSON.stringify(parsed.errors));
      return json({ error: parsed.errors[0]?.message || "Printavo error", details: parsed.errors }, 400);
    }


    return json({
      success: true,
      productionFile: parsed.data?.productionFileCreate ?? null,
      printavoOrder: job.order_number || job.invoice_number || printavoId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("push-production-file error:", message);
    return json({ error: message }, 500);
  }
});
