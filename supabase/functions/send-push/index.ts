// Sends a Web Push notification to all of a user's subscribed devices
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";
import { getUserId, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const requestBody = await req.json();
    const { notification_id } = requestBody;

    // Authorization. This function holds a service-role client and can reach any
    // user's devices, so the request body is never trusted to say who gets the
    // push or what it says. There are exactly two accepted callers:
    //
    //   1. The notifications trigger, which passes a notification_id. Recipient
    //      and content are read back from that row, so a caller can at most
    //      replay a real, recent notification to the person it already belongs
    //      to. Forging one means inserting into notifications first, which RLS
    //      now restricts to your own rows.
    //   2. A signed-in user pushing to themselves (useful for testing).
    //
    // This deliberately avoids a shared secret: setting one requires an edge
    // function env var, which is not reachable on a Lovable-managed backend.
    let userId: string;
    let title: string;
    let body: string;
    let link: string;
    let data: unknown;

    if (notification_id) {
      const { data: notification, error: lookupError } = await supabase
        .from("notifications")
        .select("user_id, title, body, link, data, created_at")
        .eq("id", notification_id)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!notification) return unauthorized();

      // Only push for a notification that was just created. The trigger fires
      // on INSERT, so anything older is a replay.
      const ageMs = Date.now() - new Date(notification.created_at).getTime();
      if (!Number.isFinite(ageMs) || ageMs > 120_000) return unauthorized();

      userId = notification.user_id;
      title = notification.title;
      body = notification.body ?? "";
      link = notification.link ?? "/";
      data = notification.data ?? {};
    } else {
      const callerId = await getUserId(req);
      if (!callerId || callerId !== requestBody.user_id) return unauthorized();

      if (!requestBody.title) {
        return new Response(JSON.stringify({ error: "title required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = callerId;
      title = requestBody.title;
      body = requestBody.body ?? "";
      link = requestBody.link ?? "/";
      data = requestBody.data ?? {};
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body: body ?? "", link: link ?? "/", data: data ?? {} });

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        ),
      ),
    );

    // Clean up dead subscriptions
    const dead: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const err: any = r.reason;
        if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(subs[i].id);
        else console.error("push error", err?.statusCode, err?.body);
      }
    });
    if (dead.length) await supabase.from("push_subscriptions").delete().in("id", dead);

    return new Response(JSON.stringify({ sent: results.filter((r) => r.status === "fulfilled").length, removed: dead.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
