// Klaviyo connection for email-list signups.
//
// The private key lives only in the Supabase secret KLAVIYO_PRIVATE_KEY. It is
// never sent to the browser and never committed (this repo is public).
//
// Consent rule: only call subscribeToEmailList() for someone who actively said
// yes to marketing email — the unchecked website box, or a staff member
// recording a verbal yes at the counter. A quote request, an order or an email
// address on file is NOT consent. Email consent never implies SMS consent, so
// phone numbers are not sent here.

const KLAVIYO_API = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2025-10-15";

/** "HCD Email List" in Klaviyo (single opt-in, created 2026-11-10). List IDs are not secret. */
export const HCD_EMAIL_LIST_ID = "Wukrc8";

export type SignupSource = "website-quote-form" | "counter";

export interface SignupInput {
  email: string;
  name?: string | null;
  company?: string | null;
  source: SignupSource;
  /** Website form name or staff user id, for the consent record. */
  detail?: string | null;
}

export interface KlaviyoResult {
  ok: boolean;
  /** Short, staff-readable reason when ok is false. */
  error?: string;
}

function apiKey(): string | null {
  const key = Deno.env.get("KLAVIYO_PRIVATE_KEY")?.trim();
  return key ? key : null;
}

async function klaviyoFetch(path: string, init: RequestInit): Promise<Response> {
  const key = apiKey()!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(`${KLAVIYO_API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Klaviyo-API-Key ${key}`,
        revision: KLAVIYO_REVISION,
        accept: "application/vnd.api+json",
        "content-type": "application/vnd.api+json",
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function describeFailure(status: number, body: string): string {
  if (status === 401) return "Klaviyo rejected the API key (check KLAVIYO_PRIVATE_KEY).";
  if (status === 403) return "The Klaviyo key is missing a permission (Profiles, Lists or Subscriptions).";
  if (status === 429) return "Klaviyo is rate limiting requests; try again in a minute.";
  let detail = "";
  try {
    detail = JSON.parse(body)?.errors?.[0]?.detail ?? "";
  } catch { /* not JSON */ }
  return `Klaviyo error ${status}${detail ? `: ${detail}` : ""}`;
}

function splitName(name?: string | null): { first_name?: string; last_name?: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

/**
 * Subscribes one person to HCD's email list with explicit email-marketing
 * consent, then fills in their name and company. Never throws.
 */
export async function subscribeToEmailList(input: SignupInput): Promise<KlaviyoResult> {
  if (!apiKey()) return { ok: false, error: "KLAVIYO_PRIVATE_KEY is not set in Supabase." };
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "No email address." };

  try {
    // 1. The consent itself. This is the only call that subscribes anyone.
    const subRes = await klaviyoFetch("/profile-subscription-bulk-create-jobs", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "profile-subscription-bulk-create-job",
          attributes: {
            custom_source: input.source === "counter" ? "ShopManagerPro counter" : "HCD website quote form",
            profiles: {
              data: [{
                type: "profile",
                attributes: {
                  email,
                  subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
                },
              }],
            },
          },
          relationships: { list: { data: { type: "list", id: HCD_EMAIL_LIST_ID } } },
        },
      }),
    });
    if (!subRes.ok) {
      return { ok: false, error: describeFailure(subRes.status, await subRes.text()) };
    }
    await subRes.body?.cancel();

    // 2. Profile details for segmenting. Best effort: the person is already
    // subscribed, so a failure here is logged but not reported as a failure.
    const profileRes = await klaviyoFetch("/profile-import", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            email,
            ...splitName(input.name),
            ...(input.company ? { organization: input.company } : {}),
            properties: {
              hcd_signup_source: input.source,
              ...(input.detail ? { hcd_signup_detail: input.detail } : {}),
            },
          },
        },
      }),
    });
    if (!profileRes.ok) {
      console.warn("Klaviyo profile details not saved:", describeFailure(profileRes.status, await profileRes.text()));
    } else {
      await profileRes.body?.cancel();
    }

    return { ok: true };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return { ok: false, error: aborted ? "Klaviyo did not respond in time." : `Could not reach Klaviyo: ${String(err)}` };
  }
}

/** Confirms the key works and can see the HCD Email List. Never throws. */
export async function checkConnection(): Promise<KlaviyoResult & { list_name?: string }> {
  if (!apiKey()) return { ok: false, error: "KLAVIYO_PRIVATE_KEY is not set in Supabase." };
  try {
    const res = await klaviyoFetch(`/lists/${HCD_EMAIL_LIST_ID}`, { method: "GET" });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: describeFailure(res.status, body) };
    return { ok: true, list_name: JSON.parse(body)?.data?.attributes?.name };
  } catch (err) {
    return { ok: false, error: `Could not reach Klaviyo: ${String(err)}` };
  }
}
