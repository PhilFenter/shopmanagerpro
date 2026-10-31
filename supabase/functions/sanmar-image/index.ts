// Fetches one SanMar product photo for Patch Pro's hat mockups and hands the bytes back.
//
// Why this exists: the browser can show a SanMar image from SanMar's own servers, but it
// won't let a page save a mockup built from it (the canvas is marked "tainted"). Passing
// the image through our own function avoids that. Only SanMar addresses are fetched, so
// this can't be used to pull anything else from the internet.
import { corsHeaders, getUserId } from "../_shared/auth.ts";

const MAX_BYTES = 15 * 1024 * 1024;

function isSanMarHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "sanmar.com" || h.endsWith(".sanmar.com");
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!(await getUserId(req))) return json({ error: "Unauthorized" }, 401);

    const { url } = await req.json().catch(() => ({ url: "" }));
    if (typeof url !== "string" || !url) return json({ error: "url required" }, 400);

    let target: URL;
    try {
      // SanMar sometimes returns protocol-relative or plain-http links
      target = new URL(url.startsWith("//") ? "https:" + url : url);
    } catch {
      return json({ error: "Not a valid image address" }, 400);
    }
    if (target.protocol === "http:") target.protocol = "https:";
    if (target.protocol !== "https:" || !isSanMarHost(target.hostname)) {
      return json({ error: "Only SanMar images can be loaded" }, 400);
    }

    const resp = await fetch(target.toString(), { redirect: "follow" });
    if (!resp.ok) return json({ error: `SanMar returned ${resp.status}` }, 502);

    // A redirect must not take us off SanMar
    if (!isSanMarHost(new URL(resp.url).hostname)) return json({ error: "Image moved off SanMar" }, 502);

    const type = resp.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return json({ error: "That address is not an image" }, 502);

    const bytes = new Uint8Array(await resp.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return json({ error: "Image is too large" }, 502);

    // octet-stream so supabase.functions.invoke hands the app a Blob
    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "X-Image-Type": type,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
