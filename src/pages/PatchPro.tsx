// Patch Pro: the patch designer (cut lines, leather and UV patches, print sheets, hat mockups).
//
// The designer itself is one self-contained page in public/patch-pro/index.html, the same file
// the shop has been using on its own. This screen shows it full-screen and answers its few
// requests that need Shop Manager: SanMar hat photos (through our existing sanmar-api login)
// and going back to the app. See DECISIONS.md, "Patch Pro runs as its own page inside Shop Manager".
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hatColorsFromSanMar, PATCH_PRO_NAV_TARGETS } from "@/lib/patchPro";

type Call = { type: "pp:call"; id: number; op: string; args?: Record<string, unknown> };

async function errorText(error: unknown): Promise<string> {
  // supabase-js wraps non-2xx responses; the function's own message is in the response body
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      /* not JSON */
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export default function PatchPro() {
  const frame = useRef<HTMLIFrameElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const origin = window.location.origin;
    const reply = (msg: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(msg, origin);

    async function handle(call: Call) {
      const args = call.args ?? {};
      switch (call.op) {
        case "sanmarColors": {
          const style = String(args.style ?? "").toUpperCase().trim();
          if (!style) throw new Error("Type a style number");
          const { data, error } = await supabase.functions.invoke("sanmar-api", {
            body: { action: "getProductInfo", styleNumber: style },
          });
          if (error) throw new Error(await errorText(error));
          if (data?.error) throw new Error(String(data.error));
          return hatColorsFromSanMar(data?.items);
        }
        case "sanmarImage": {
          const { data, error } = await supabase.functions.invoke("sanmar-image", { body: { url: args.url } });
          if (error) throw new Error(await errorText(error));
          if (!(data instanceof Blob)) throw new Error("No image came back");
          return data;
        }
        case "navigate": {
          const to = String(args.to ?? "");
          navigate((PATCH_PRO_NAV_TARGETS as readonly string[]).includes(to) ? to : "/leather");
          return true;
        }
        default:
          throw new Error(`Unknown request: ${call.op}`);
      }
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data;
      if (d?.type === "pp:hello") {
        reply({ type: "smp:ready" });
      } else if (d?.type === "pp:call" && typeof d.id === "number") {
        handle(d as Call).then(
          (result) => reply({ type: "smp:reply", id: d.id, result }),
          async (err) => reply({ type: "smp:reply", id: d.id, error: await errorText(err) }),
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  return (
    <iframe
      ref={frame}
      src="/patch-pro/index.html"
      title="Patch Pro"
      // in case the designer said hello before this screen was listening
      onLoad={() => frame.current?.contentWindow?.postMessage({ type: "smp:ready" }, window.location.origin)}
      className="block h-[100dvh] w-full border-0 bg-background"
    />
  );
}
