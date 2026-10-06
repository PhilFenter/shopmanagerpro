// process-inbound-email
//
// Called by the Google Apps Script that watches info@ (and optionally phil@).
// For each new email it:
//   1. Skips duplicates (same Gmail message id already processed)
//   2. Uses AI to classify it (new quote request / follow-up info on an open
//      quote / existing customer order / vendor pitch / not actionable)
//   3. For real customer requests: finds or creates the customer, creates a
//      draft quote with line items, and an action item that says whether it's
//      READY TO PRICE or NEEDS INFO, with a checklist of what's missing
//   4. Sends Phil the new-action-item alert
//   5. Returns a short reply draft in Phil's voice asking only for what's
//      missing. The Apps Script saves it as a Gmail DRAFT — nothing is sent
//      automatically.
//
// Auth: shared secret in the `x-intake-secret` header (INBOUND_EMAIL_SECRET).
// Pass `"dry_run": true` to see what the AI extracted without writing anything.
//
// Secrets used:
//   INBOUND_EMAIL_SECRET   required — same value as the Apps Script property
//   AI_API_KEY             optional — falls back to LOVABLE_API_KEY
//   AI_API_URL             optional — OpenAI-compatible chat completions URL
//                          (defaults to the Lovable AI gateway)
//   AI_MODEL               optional — defaults to google/gemini-3-flash-preview

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { categoryOf, suggestTiers, suggestRequested, styleFromText, hatPrice, hatNextTier, matrixNextTier, HAT_SIDE_FLAG, HAT_STITCH_LIMIT, CUSTOM_QUOTE_QTY, screenPrintMin, screenFees, SCREEN_FEE, SCREEN_FEE_WAIVE_QTY, SMALL_MIN, SMALL_ORDER_UNDER, SMALL_ORDER_FEE, assumptionsFor, type Suggestion, type Tier } from "../_shared/hcd-pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-intake-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Added word for word to the bottom of every reply draft. Edit here to change it.
// Plain-text version (fallback) and an HTML version (centered, lines don't wrap).
const FOOTER_LINES = {
  name: "Hells Canyon Designs",
  services1: "Custom Apparel · Company Online Stores · Screen Printing",
  services2: "Embroidery · Leather Patch & Embroidered Hats",
  contact: "Mon–Thurs 8–4, Fri until noon · 208-748-6242 · hellscanyondesigns.com",
};
const REPLY_FOOTER = ["--", FOOTER_LINES.name, FOOTER_LINES.services1, FOOTER_LINES.services2, FOOTER_LINES.contact].join("\n");
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const REPLY_FOOTER_HTML =
  `<div style="margin-top:18px;padding-top:10px;border-top:1px solid #ddd;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#333;">` +
  `<div style="font-size:15px;font-weight:bold;white-space:nowrap;">${esc(FOOTER_LINES.name)}</div>` +
  `<div style="font-size:12px;white-space:nowrap;">${esc(FOOTER_LINES.services1)}</div>` +
  `<div style="font-size:12px;white-space:nowrap;">${esc(FOOTER_LINES.services2)}</div>` +
  `<div style="font-size:11px;color:#666;margin-top:3px;">${esc(FOOTER_LINES.contact)}</div>` +
  `</div>`;
const draftHtml = (text: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">${esc(text).replace(/\n/g, "<br>")}</div>${REPLY_FOOTER_HTML}`;

// Converting low-res art to print-ready art. "$40 in most cases" (Phil, Oct 2026). Billed after the order is approved.
const ART_CLEANUP_FEE = 40;

const OWN_DOMAINS = ["hellscanyondesigns.com", "hellscanyonartglass.com", "mail.hellscanyondesigns.com"];

// ── Shop rules the AI uses. Keep this short and in Phil's words. ─────────────
const SHOP_RULES = `
You work intake for Hells Canyon Designs (HCD), a small custom apparel shop in Lewiston, Idaho.
Services: screen printing (10-color automatic press), DTF transfers, embroidery, and patch hats
(laser leather, leatherette, UV flat and UV textured, and embroidered patches) mostly on Richardson hats (112, 112PFP, etc.).
- When talking to customers about patches say "leather, UV flat and textured, or embroidered patches". Never mention PVC patches.
Rules of thumb:
- HCD does not do back embroidery (full backs, jacket backs). If someone wants embroidery on the back, suggest screen print or DTF for the back and embroidery on the front/left chest. Never offer back embroidery.
- Minimums: screen print 24 pieces for 1 color, plus 12 more per extra color (2 colors 36, 3 colors 48). Below that we use DTF. DTF and embroidery minimum is 6 pieces; under 12 has a $30 small order fee. Hats are 12 minimum. Never promise a price.
- Polos get embroidery, left chest only. No DTF/full-color transfers on polos, and nothing on the back of a polo.
  Never recommend a t-shirt style (like the Next Level 6210) for polos.
- CUSTOMER-SUPPLIED GARMENTS ("can I bring my own shirts/jackets in to be embroidered/printed?"): we don't love it. Explain
  briefly in Phil's words: every unique piece someone brings in is an experiment for us; items we source we've usually run
  before, and if something happens we can get another. Then the good news: we carry lots of great brands (Nike, OGIO,
  North Face, Eddie Bauer and others) at a variety of budgets, and offer to send a guide for that item (e.g. a polo guide).
  Exceptions: items we can't get, or a huge order — then they provide one for testing and understand we can't replace
  items that get damaged in the process (we did 700 jackets for Clearwater Paper that way). Don't quote a price for
  decorating their garments.
- Patches are for hats only. HCD does not put patches on apparel — for shirts/hoodies/jackets suggest embroidery, screen print or DTF.
HOUSE PICKS (what we recommend; prices for these are added to replies automatically):
- Tees: Good = Port & Co PC54 (low-cost cotton; Gildan 5000 is the other budget option), Better = Next Level 6210
  (soft blend, holds its shape, our go-to for crews), Best = Bella+Canvas 3001 (retail-soft, the one people keep wearing).
- Hoodies: Good = District DT6100 V.I.T. (Port & Co PC78H if they want the basic), Better = District DT6150 V.I.T. Heavyweight, Best = District DT7800 Cloud Fleece
  (the nicer District hoodies). Crewnecks: PC78, District DT6104, District DT7804.
- Polos: Good = Sport-Tek ST550, Better = Port Authority K500 Silk Touch, Best = Sport-Tek ST650.
- Hats: Richardson 112 trucker is the go-to.
RECOMMENDING (when they ask "what do you recommend?" or "what looks best?"): answer like Phil would. Give ONE clear pick with
  a short reason and ONE alternative. Never punt it back to them ("whatever you like").
- Garment: work crews and businesses -> Next Level 6210 or a District hoodie; giveaways/events on a budget -> PC54 or
  Gildan 5000; merch to sell or "they want people to actually wear it" -> Bella+Canvas 3001.
- Placement: polos -> left chest embroidery only; businesses and crews -> left chest + full back on tees/hoodies; events, teams and fundraisers -> full front; hats -> front patch.
- Ink color: one color keeps the cost down and usually looks the cleanest. Light ink (white, cream, light gray) on dark
  garments, dark ink on light garments; match the logo's main color when the logo is simple. Avoid low-contrast combos
  (navy on black, gray on heather gray, yellow on white). Thin lines and small text print better in a solid, high-contrast color.
- Most customers say "screen print" but don't know methods. Don't make them choose a method — we recommend it.
- "People love hot dogs. No one really wants to know how a hot dog is made." Ask customers only what we need, in plain language.
What we need to price a job:
- Apparel: what items, rough quantity, which decoration locations (e.g. left chest + back), artwork (or that it's coming), and roughly Good/Better/Best or a garment they like. Sizes and colors are needed before ordering, not before a first price.
- Hats: rough quantity, hat style or "like the Richardson 112", decoration type (patch / embroidery) and artwork.\n  Hat embroidery is the same price as a patch up to 8,000 stitches — never ask customers for stitch counts.\n  Hat prices are added to the reply automatically; do not write prices yourself.\n  HAT MINIMUM / SAMPLES: 12 hats minimum, even for "a sample" or "1 or 2 to try" (it's the time it takes to make the first\n  patch and burn it on the leather / set up the embroidery). Say why in a few words, then offer: split the 12 across colors\n  (e.g. 6 of each) and we send pictures of the patch on the actual hats before we make them all. Never offer 1-2 samples.\n  Leather patches: ask for the logo as a black and white vector file (PDF, AI or EPS) for best results.\n  Hats are one size (snapbacks/adjustables) — NEVER ask for hat sizes unless they asked for fitted or Flexfit hats.\n  Decoration type never blocks a hat price (same price for patch or embroidery). If they didn't say, ask in ONE short\n  line, e.g. "Do you want them embroidered, or a patch (leather, UV flat or textured)?"
- Deadline if they have one.
`;

const SYSTEM_PROMPT = `${SHOP_RULES}
Read the email (and any earlier thread context) and return ONLY a JSON object with this shape:
{
  "classification": "new_quote_request" | "quote_follow_up" | "existing_customer_order" | "customer_admin" | "vendor_or_solicitation" | "not_actionable",
  "confidence": 0-1,
  "customer": { "name": string|null, "company": string|null, "phone": string|null },
  "summary": "one or two sentences in plain English about what they want",
  "items": [
    { "item": "t-shirts|hoodies|crewnecks|polos|hats|jackets|hi-vis|other", "garment": string|null, "colors": string|null,
      "quantity": number|null, "sizes": { "S": number, ... } | null, "locations_assumed": boolean,
      "decoration": "screen_print|dtf|embroidery|leather_patch|uv_patch|pvc_patch|woven_patch|unknown",
      "locations": string|null, "print_colors": number|null, "customer_supplied": boolean, "notes": string|null }
  ],
  "total_quantity": number|null,
  "deadline": string|null,
  "artwork": "attached|coming|needs_design|unknown",
  "tier_hint": "good|better|best|unknown",
  "missing": [ short plain-language things that BLOCK a first price (usually only quantity, or what items) ],
  "needed_later": [ short plain-language things needed before ordering, not before a price: sizes, garment color, logo/ink colors, artwork, deadline ],
  "ready_to_price": boolean,
  "reply_draft": string|null
}
Guidance:
- vendor_or_solicitation = someone trying to SELL to HCD (digitizing, patches, blanks, marketing, SEO, shop closing sales).
- quote_follow_up = customer replying with more info (sizes, logo, quantity) on something already being quoted.
- existing_customer_order = a known customer asking for a reorder or a new job (new or changed items to make).
- customer_admin = a customer email that is NOT asking for something to be made or priced: invoices, payments, payroll
  deduction / order spreadsheets for an order already in progress, receipts, W-9s, tracking/pickup questions, "thanks, got
  them". These are handled by Phil directly — no quote, no draft.
- not_actionable = receipts, notifications, spam, thank-yous that need nothing.
- PRICE FIRST: don't make the customer answer questions we can reasonably assume. ready_to_price is true when we know
  what items and a rough quantity. If decoration locations aren't stated, ASSUME them (businesses/crews: "left chest + full
  back"; events/teams/fundraisers: "full front"; hats: "front") and set locations_assumed true. If the item is vague
  ("some shirts"), assume t-shirts. Assume a 1-color print unless told otherwise.
- print_colors: number of ink colors in the design only if the customer says so or it's obvious (e.g. "white logo" = 1). Otherwise null.
- items[].garment: ONLY a style the customer named (e.g. "Bella Canvas 3001", "like the 112"). Never fill in our own pick —
  Good/Better/Best options are priced automatically when garment is null.
- Don't invent numbers. If a quantity is a range, use the low end and say so in notes.
- missing / needed_later: if PREVIOUSLY MISSING items are listed in the input, reuse their exact wording for anything
  still open (in whichever list fits) and leave out anything the customer has now answered.
- items: describe the WHOLE order as known so far across the whole thread (not just this message), so the quote stays complete.
- reply_draft: write one whenever classification is new_quote_request, quote_follow_up or existing_customer_order.
  GOAL: give them a price in the FIRST reply and keep back-and-forth to a minimum. When we know items and a rough
    quantity, prices (Good/Better/Best, with what we assumed) are added right after your text automatically, so don't
    write prices, don't list options we already price, and don't say you'll send pricing later. Then:
    - LAYOUT: the first paragraph is only the greeting line's thank-you plus ONE sentence about the job. No questions in
      it — prices are inserted right after the first paragraph, and questions go AFTER the prices.
    - Sizes are for apparel only. Never ask for hat sizes (even on a mixed order, say "sizes for the polos").
    - Ask only what's in "missing" (usually nothing, or just quantity).
    - Ask for needed_later things in ONE short line, e.g. "When you're ready, send over the sizes and your logo file and
      we'll put a mockup together."
    - One upsell is welcome when it fits ("we can do these as hoodies too", "a full back print really stands out").
    - If they asked what we recommend, answer it directly using HOUSE PICKS / RECOMMENDING.
    - If quantity is unknown, ask for a rough quantity and mention what you'd recommend so they have something to react to.
  ARTWORK: if the input says ARTWORK CHECK: low-res, ask naturally for the original logo file ("the original from your
    designer, a PDF or AI file, or a bigger PNG"). If they don't have one, that's no problem: we can convert it to
    print-ready art, usually a $${ART_CLEANUP_FEE} art fee, done once the order is approved. We send a quick preview
    mockup before the order. Never promise a finished, production-ready mockup up front.
  FOLLOW-UPS: if there is EARLIER IN THREAD or an OPEN JOB, this is NOT the first reply. Do NOT say "Thanks for reaching out"
    again. Start "Hi <first name>," and go straight in (e.g. "Thanks, got the sizes."). NEVER ask again about anything already
    answered or decided anywhere in the thread or the open job (patch type, decoration, hat style, locations, colors, sizes).
    If the customer already chose a leather or UV patch, don't offer embroidery or other patch types again. Only ask what is
    still missing.
  VOICE: on the FIRST reply only, open with "Hi <first name>," (or "Hi," if no name) then "Thanks for reaching out." Every customer should feel
    appreciated. Then get straight to the solution. We're busy, they're busy: show them we're real people who can solve
    their problem. Don't pad it or talk just to hear yourself talk. Answer their questions first, suggest options they may
    not know about, and give it a personal touch. A short list is fine when there are several questions. Plain words,
    no exclamation-point overload, no "I hope this email finds you well", never promise a ship date.
  You have latitude: use judgment to make the reply genuinely helpful. End with "Thank you\\n\\nPhil" (nothing after it).
  Do not write prices yourself; hat prices and the shop footer are added automatically.
  EXAMPLES OF PHIL'S REAL EMAILS (match the tone, don't copy them):
    "Hi Paislie,\\n\\nWe don't love embroidering garments people bring in. There are a few reasons and first is every time someone brings in a unique piece it's an experiment for us and we are hoping for the best. On items that we source we have typically run them before and if something happens, we can get another. Some things work better than others.\\n\\nThe good news is we carry lots of great brands. Nike, Ogio, North Face, Eddie Bauer and other options. So folks can get things at a variety of budgets.\\n\\nWe do make exceptions if they are items we can't get or it's a huge order. We did 700 jackets for Clearwater Paper last year. They provided one for testing and understood if something happened during the process we would not replace the item.\\n\\nI hope that makes sense. Let me know if you would like a polo shirt guide to choose some items from.\\n\\nThank you\\n\\nPhil"
    "Hi Ian,\\n\\nOn the hats for embroidery, we have $45 digitizing fee to convert the logo for embroidery. That's a onetime fee. We can then change thread color and all that with our software. Half black and half white are no problem.\\n\\nOn the shirts what are we doing for print locations?\\n\\nThank you\\n\\nPhil"
    "Hi Kelly,\\n\\nWe will get a sample made of that on Monday. The hat we used was a Richardson 632. It comes in several colors. If you go to Richardsonsports.com and search 632 you can see the colors.\\n\\nI'll get a sample made and send a picture Monday afternoon.\\n\\nThank you\\n\\nPhil"
    "Hi Tina,\\n\\nAre you familiar with DTF or Direct to film transfers? I am thinking for your order due to time, and the fact that you have left chest, full back and both sleeves we will use that method instead of screen printing. It's a lot of screens and setups for that size order.\\n\\nWe have some Black Next Level 6210 shirts in stock that we could use for this unless you had another shirt you wanted to use.\\n\\nThank you\\n\\nPhil"
`;

// ── Helpers ─────────────────────────────────────────────────────────────────
function emailDomain(addr: string): string {
  return (addr.split("@")[1] || "").toLowerCase().trim();
}

const DECORATION_TO_SERVICE: Record<string, string> = {
  screen_print: "screen_print",
  dtf: "dtf",
  embroidery: "embroidery",
  leather_patch: "leather_patch",
  uv_patch: "uv_patch",
  pvc_patch: "pvc_patch",
  woven_patch: "woven_patch",
};

function suggestMethod(item: any, totalQty: number | null): string {
  const d = String(item?.decoration || "unknown");
  if (d !== "unknown") return d;
  const isHat = /hat|cap/i.test(String(item?.item || ""));
  if (isHat) return "leather_patch";
  const q = Number(item?.quantity) || totalQty || 0;
  if (q <= 0) return "unknown";
  // Screen print only at/above the minimum for the color count (24 + 12 per extra color); else DTF.
  return q >= screenPrintMin(Number(item?.print_colors) || 1) ? "screen_print" : "dtf";
}

function cleanSizes(sizes: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (sizes && typeof sizes === "object" && !Array.isArray(sizes)) {
    for (const [k, v] of Object.entries(sizes as Record<string, unknown>)) {
      const n = Number(v);
      if (k && Number.isFinite(n) && n > 0) out[k.toUpperCase().trim()] = Math.round(n);
    }
  }
  return out;
}

// ── Artwork check (file type + size only; no time spent before the sale) ──────
type AttachMeta = { name: string; type?: string; size?: number };
type ArtCheck = { status: "vector" | "good" | "low_res" | "check" | "none"; note: string };
export function artCheck(meta: AttachMeta[]): ArtCheck {
  const isArt = (a: AttachMeta) => /\.(ai|eps|svg|pdf|cdr|psd|tiff?|png|jpe?g|gif|webp|heic|bmp)$/i.test(a.name) || /^image\//.test(a.type || "");
  let files = meta.filter(isArt);
  // Skip tiny images (email signature logos, icons) unless that's all there is.
  // Outlook/Apple signature images are named image.png, image001.png, Outlook-xyz.png and are small.
  const sig = (a: AttachMeta) => /^(image\d*|outlook-[\w-]+)\.(png|jpe?g|gif)$/i.test(a.name) && (a.size || 0) < 60_000;
  files = files.filter((a) => !sig(a) && !(a.size && a.size < 15_000 && !/\.(ai|eps|svg|pdf)$/i.test(a.name)));
  if (!files.length) return { status: "none", note: "" };
  const kb = (a: AttachMeta) => (a.size ? `${Math.round(a.size / 1024)} KB` : "size unknown");
  const vector = files.find((a) => /\.(ai|eps|svg|pdf|cdr)$/i.test(a.name));
  if (vector) return { status: "vector", note: `✅ Art: ${vector.name} looks like vector/print-ready — OK to make a preview mockup.` };
  const big = files.find((a) => /\.(psd|tiff?)$/i.test(a.name) || ((a.size || 0) >= 400_000 && !/screen ?shot|\.heic$/i.test(a.name)));
  if (big) return { status: "good", note: `✅ Art: ${big.name} (${kb(big)}) should be big enough for a preview mockup.` };
  const f = files[0];
  if (/screen ?shot|\.heic$/i.test(f.name) || (f.size && f.size < 150_000)) {
    return { status: "low_res", note: `⚠ Art: ${f.name} (${kb(f)}) looks low-res. Ask for the original file. If they don't have it, art cleanup is usually $${ART_CLEANUP_FEE}, done only after the order is approved. Preview mockup only until then.` };
  }
  return { status: "check", note: `? Art: ${f.name} (${kb(f)}) — give it a quick look before mocking up.` };
}

async function runAI(userContent: string): Promise<any> {
  const apiKey = Deno.env.get("AI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI_API_KEY (or LOVABLE_API_KEY) is not configured");
  const url = Deno.env.get("AI_API_URL") || (Deno.env.get("AI_API_KEY") ? "https://api.openai.com/v1/chat/completions" : "https://ai.gateway.lovable.dev/v1/chat/completions");
  const model = Deno.env.get("AI_MODEL") || (Deno.env.get("AI_API_KEY") ? "gpt-4.1-mini" : "google/gemini-3-flash-preview");

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI request failed [${res.status}]: ${(await res.text()).slice(0, 500)}`);
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI returned no JSON");
  return JSON.parse(match[0]);
}


// ── Apparel prices for the reply draft ───────────────────────────────────────
const TIER_BLURB: Record<string, Record<Tier, string>> = {
  tee: { good: "basic cotton, best price", better: "softer blend, holds its shape", best: "retail-soft, the one people keep wearing" },
  hoodie: { good: "soft everyday hoodie", better: "heavier, nicer feel", best: "super soft, premium" },
  crew: { good: "everyday crewneck", better: "softer, nicer feel", best: "super soft, premium" },
  polo: { good: "performance basic", better: "classic soft polo", best: "premium performance" },
};
const ITEM_WORD: Record<string, string> = { tee: "shirts", hoodie: "hoodies", crew: "crewnecks", polo: "polos" };
const shortName = (n: string) => n.replace(/^Port & Co /, "Port & Co ").replace(/ (Core Cotton|CVC|Core Fleece Hoodie|Core Fleece Crew)$/, "");

function decoPhrase(p: { method: string; colors?: number | null; where?: string | null }): string {
  const where = (p.where || "front").replace(/\s*\+\s*/g, " and ").toLowerCase();
  if (p.method === "screen_print") return `a ${p.colors || 1}-color ${where} print`;
  if (p.method === "dtf") return `a full-color ${where} transfer`;
  if (p.method === "embroidery") return `embroidery on the ${where}`;
  return where;
}

export function apparelPriceParas(pricing: any[], isFollowUp: boolean): string[] {
  const out: string[] = [];
  for (const p of pricing) {
    if (p.hat || p.custom || !p.qty || !(p.suggestions?.length || p.requested)) continue;
    const word = ITEM_WORD[p.cat || ""] || "pieces";
    const head = `For ${p.qty} ${word} with ${decoPhrase(p)}`;
    const lines: string[] = [];
    if (p.requested) {
      lines.push(`${head} on the ${shortName(p.requested.name)}, it's $${p.requested.unit_price.toFixed(2)} each.`);
    } else if (isFollowUp) {
      const pick = p.suggestions.find((s: Suggestion) => s.tier === "better") ?? p.suggestions[0];
      lines.push(`${head} on the ${shortName(pick.name)}, it's $${pick.unit_price.toFixed(2)} each.`);
    } else {
      lines.push(`${head}:`);
      for (const s of p.suggestions as Suggestion[]) {
        const blurb = TIER_BLURB[p.cat]?.[s.tier];
        lines.push(`- ${shortName(s.name)}${blurb ? ` (${blurb})` : ""}: $${s.unit_price.toFixed(2)} each`);
      }
    }
    const extra: string[] = [];
    if (p.setup > 0) extra.push(`There's a one-time $${p.setup} screen setup.`);
    if (p.fees?.length) extra.push(`Under ${SMALL_ORDER_UNDER} pieces there's a $${SMALL_ORDER_FEE} small order fee.`);
    const up = (p.requested ? null : (p.suggestions.find((s: Suggestion) => s.tier === "better") ?? p.suggestions[0]))?.upcharge_2xl ?? 0;
    if (!isFollowUp && up > 0) extra.push(`2XL and up run about $${Math.ceil(up)} more.`);
    if (!isFollowUp && p.next?.pick) extra.push(`At ${p.next.qty} pieces it drops to about $${p.next.pick.unit_price.toFixed(2)} each on the ${shortName(p.next.pick.name)}.`);
    if (!isFollowUp && (p.assumedWhere || (p.method === "screen_print" && !p.colors))) {
      extra.push(p.method === "screen_print"
        ? `I priced it as ${decoPhrase(p)}; if your logo has more colors or you want a different setup, I'll adjust it.`
        : `I priced it as ${decoPhrase(p)}; if you want a different setup, I'll adjust it.`);
    }
    out.push([lines.join("\n"), extra.join(" ")].filter(Boolean).join("\n"));
  }
  return out;
}

// ── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const secret = Deno.env.get("INBOUND_EMAIL_SECRET");
  if (!secret || req.headers.get("x-intake-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const p = await req.json();
    const messageId = String(p.message_id || "").slice(0, 200);
    const threadId = String(p.thread_id || "").slice(0, 200);
    const mailbox = String(p.mailbox || "info").slice(0, 40);
    const fromEmail = String(p.from_email || "").trim().toLowerCase().slice(0, 200);
    const fromName = String(p.from_name || "").trim().slice(0, 200);
    const subject = String(p.subject || "").slice(0, 300);
    const body = String(p.body || "").slice(0, 8000);
    const threadContext = String(p.thread_context || "").slice(0, 6000);
    const attachmentNames: string[] = Array.isArray(p.attachment_names) ? p.attachment_names.map(String).slice(0, 20) : [];
    const attachMeta: AttachMeta[] = Array.isArray(p.attachment_meta)
      ? p.attachment_meta.slice(0, 20).map((a: any) => ({ name: String(a?.name || ""), type: a?.type ? String(a.type) : undefined, size: Number(a?.size) || undefined }))
      : attachmentNames.map((n) => ({ name: n }));
    const art = artCheck(attachMeta);
    const dryRun = p.dry_run === true;

    if (!messageId || !fromEmail) return json({ error: "message_id and from_email are required" }, 400);
    if (OWN_DOMAINS.includes(emailDomain(fromEmail))) return json({ status: "ignored", reason: "from our own domain" });

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const marker = `gmail:${messageId}`;

    // 1. Duplicate check
    if (!dryRun) {
      const { data: dup } = await db.from("action_items").select("id").ilike("notes", `%${marker}%`).limit(1).maybeSingle();
      if (dup) return json({ status: "duplicate", action_item_id: dup.id });
    }

    // 2. Known customer + open quote?
    const { data: customer } = await db
      .from("customers")
      .select("id, name, company, phone, total_orders, last_order_date")
      .ilike("email", fromEmail)
      .limit(1)
      .maybeSingle();

    let openQuote: { id: string; quote_number: string | null; status: string } | null = null;
    if (customer) {
      const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
      const { data } = await db
        .from("quotes")
        .select("id, quote_number, status")
        .eq("customer_id", customer.id)
        .in("status", ["draft", "sent", "pending"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      openQuote = data ?? null;
    }

    // 2b. Is there already an open job for this thread (or this customer's open quote)?
    //     Replies update that job instead of creating another action item.
    type OpenJob = { id: string; quote_id: string | null; checklist: any; notes: string | null };
    let openJob: OpenJob | null = null;
    if (threadId) {
      const { data } = await db.from("action_items").select("id, quote_id, checklist, notes")
        .eq("status", "open").ilike("notes", `%thread:${threadId}%`)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      openJob = (data as OpenJob) ?? null;
    }
    if (!openJob && openQuote) {
      const { data } = await db.from("action_items").select("id, quote_id, checklist, notes")
        .eq("status", "open").eq("quote_id", openQuote.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      openJob = (data as OpenJob) ?? null;
    }
    const prevChecklist: { id: string; text: string; done: boolean }[] = Array.isArray(openJob?.checklist) ? openJob!.checklist : [];
    const prevMissing = prevChecklist.filter((c) => !c.done && /^Get: /.test(c.text)).map((c) => c.text.replace(/^Get: /, ""));
    let prevLines = "";
    if (openJob?.quote_id) {
      const { data: li } = await db.from("quote_line_items").select("description, quantity, sizes, color, placement")
        .eq("quote_id", openJob.quote_id).order("sort_order");
      prevLines = (li ?? []).map((l: any) => `- ${l.quantity} × ${l.description}${l.color ? `, ${l.color}` : ""}${l.placement ? `, ${l.placement}` : ""}${l.sizes && Object.keys(l.sizes).length ? `, sizes ${JSON.stringify(l.sizes)}` : ""}`).join("\n");
    }

    // 3. AI extraction
    const ai = await runAI([
      `Mailbox: ${mailbox}@`,
      `From: ${fromName} <${fromEmail}>`,
      customer
        ? `Known customer: ${customer.name}${customer.company ? ` (${customer.company})` : ""}, ${customer.total_orders ?? 0} past orders${openQuote ? `, open quote ${openQuote.quote_number} (${openQuote.status})` : ""}`
        : "Not in our customer list.",
      `Subject: ${subject}`,
      attachmentNames.length ? `Attachments: ${attachmentNames.join(", ")}` : "No attachments.",
      art.status === "low_res" ? "ARTWORK CHECK: low-res — ask for the original logo file." : art.status === "vector" || art.status === "good" ? "ARTWORK CHECK: looks usable." : "",
      "",
      "EMAIL:",
      body,
      threadContext ? `\nEARLIER IN THREAD:\n${threadContext}` : "",
      openJob ? `\nOPEN JOB FOR THIS CUSTOMER (update it with anything new):\n${prevLines || "(no line items yet)"}` : "",
      prevMissing.length ? `PREVIOUSLY MISSING: ${prevMissing.map((m) => `"${m}"`).join(", ")}` : "",
    ].join("\n"));

    const classification = String(ai.classification || "not_actionable");
    if (dryRun) return json({ status: "dry_run", customer_match: customer?.name ?? null, open_quote: openQuote?.quote_number ?? null, open_job: openJob?.id ?? null, ai });

    // Billing / paperwork from customers (invoices, payments, payroll spreadsheets) isn't a quote — Phil handles those.
    const adminWords = /invoice|payment|payroll|receipt|tracking|w-?9|statement|spreadsheet|paid|pick ?up/i;
    const noItems = !Array.isArray(ai.items) || ai.items.length === 0;
    if (classification === "customer_admin" ||
        (classification === "existing_customer_order" && noItems && adminWords.test(`${ai.summary || ""} ${subject}`))) {
      return json({ status: "ignored", classification: "customer_admin", summary: ai.summary ?? null });
    }
    if (classification === "vendor_or_solicitation" || classification === "not_actionable") {
      return json({ status: "ignored", classification, summary: ai.summary ?? null });
    }

    // 4. Customer
    const name = customer?.name || ai.customer?.name || fromName || fromEmail;
    const company = customer?.company || ai.customer?.company || null;
    const phone = customer?.phone || ai.customer?.phone || null;
    let customerId = customer?.id ?? null;
    if (!customerId) {
      const { data: created, error } = await db
        .from("customers")
        .insert({ name, email: fromEmail, phone, company, source: "email" })
        .select("id")
        .single();
      if (error) throw new Error(`customer insert failed: ${error.message}`);
      customerId = created.id;
    }

    const items: any[] = Array.isArray(ai.items) ? ai.items.slice(0, 10) : [];
    const totalQty: number | null = Number(ai.total_quantity) > 0 ? Math.round(Number(ai.total_quantity)) : null;
    const missing: string[] = Array.isArray(ai.missing) ? ai.missing.map(String).slice(0, 8) : [];
    const neededLater: string[] = (Array.isArray(ai.needed_later) ? ai.needed_later.map(String) : [])
      .filter((m: string) => !missing.includes(m)).slice(0, 8);
    if (art.status === "low_res" && items.length > 0 && ![...missing, ...neededLater].some((m) => /logo|art|file/i.test(m))) {
      neededLater.push("original logo file (PDF, AI, EPS or a large PNG)");
    }
    // Our own rules (minimums) are never a question for the customer.
    for (const list of [missing, neededLater]) {
      const keep = list.filter((m) => !/\bminimum\b|\bmin(imum)? order\b|\bmoq\b/i.test(m));
      list.length = 0; list.push(...keep);
    }
    // Hats: one size (unless fitted), and decoration type never blocks a hat price.
    const hatOnly = items.length > 0 && items.every((it) => categoryOf(it.item || it.garment) === "hat");
    const fitted = items.some((it) => /fitted|flex ?fit|\b(110|185|6277|r-?flex)\b/i.test(`${it.garment || ""} ${it.notes || ""}`));
    if (hatOnly) {
      const noSizes = (m: string) => fitted || !/\bsizes?\b/i.test(m);
      const deco = (m: string) => /patch|embroider|decoration/i.test(m);
      const moved = missing.filter(deco);
      const keep = missing.filter((m) => !deco(m) && noSizes(m));
      missing.length = 0; missing.push(...keep);
      const later = [...neededLater, ...moved].filter(noSizes);
      neededLater.length = 0; neededLater.push(...later.filter((m, i) => later.indexOf(m) === i));
    }
    const ready = (ai.ready_to_price === true || (hatOnly && items.some((it) => Number(it.quantity) > 0 || totalQty))) && missing.length === 0;
    const allOpen = [...missing, ...neededLater];

    // 4b. Suggested Good / Better / Best pricing (Printavo formula, suggestions only)
    const tierHint = (["good", "better", "best"].includes(String(ai.tier_hint)) ? ai.tier_hint : "better") as Tier;
    type Priced = { suggestions: Suggestion[]; requested: Suggestion | null; qty: number; method: string; assumptions: string;
      next?: { qty: number; pick: Suggestion | null } | null; hat?: boolean; locations?: number; custom?: boolean;
      cat?: string | null; decoUnknown?: boolean; colors?: number | null; where?: string | null; assumedWhere?: boolean; setup?: number; fees?: string[] };
    const pricing: Priced[] = [];
    const flags: string[] = [];
    for (const it of items) {
      if (it.customer_supplied === true) {
        // Their own garments: no auto price — the draft steers them to garments we carry.
        flags.push(`Item ${items.indexOf(it) + 1}: customer wants to bring their own ${it.item || "garments"} — no auto price. Draft points them to our brands (exceptions: items we can't get or huge orders, one test piece, no replacement).`);
        continue;
      }
      let method = suggestMethod(it, totalQty);
      const cat = categoryOf(it.item || it.garment);
      const qty = Number(it.quantity) > 0 ? Math.round(Number(it.quantity)) : (items.length === 1 && totalQty ? totalQty : 0);
      // Polos: embroidery, left chest only. No transfers, nothing on the back.
      if (cat === "polo") {
        const n0 = items.indexOf(it) + 1;
        const asked = String(it.decoration || "unknown");
        if (asked !== "unknown" && asked !== "embroidery" && /transfer|\bdtf\b|screen ?print|printed/i.test(String(body || ""))) flags.push(`Item ${n0}: polo asked as ${asked.replace(/_/g, " ")} — polos get embroidery; priced embroidery.`);
        method = "embroidery"; it.decoration = "embroidery";
        const loc = String(it.locations || "");
        if (!loc || it.locations_assumed === true) { it.locations = "left chest"; }
        else if (/\bback\b/i.test(loc)) {
          flags.push(`Item ${n0}: polo with a back location — we don't decorate polo backs. Priced left chest only; tell the customer.`);
          it.locations = loc.split(/\+|,|&|\band\b/i).map((x) => x.trim()).filter((x) => x && !/\bback\b/i.test(x)).join(" + ") || "left chest";
        }
      }
      const colors = Number(it.print_colors) > 0 ? Math.round(Number(it.print_colors)) : null;
      const n = items.indexOf(it) + 1;
      const fees: string[] = [];
      if (cat !== "hat" && qty > 0 && qty < CUSTOM_QUOTE_QTY) {
        if (method === "screen_print" && qty < screenPrintMin(colors)) {
          flags.push(`Item ${n}: ${qty} pcs is under the screen print minimum (${screenPrintMin(colors)} for ${colors || 1} color) — quoted as DTF.`);
          method = "dtf";
        }
        if ((method === "dtf" || method === "embroidery") && qty < SMALL_MIN) {
          flags.push(`Item ${n}: ${qty} pcs is under our ${SMALL_MIN}-piece minimum.`);
        } else if ((method === "dtf" || method === "embroidery") && qty < SMALL_ORDER_UNDER) {
          fees.push(`+$${SMALL_ORDER_FEE} small order fee (under ${SMALL_ORDER_UNDER})`);
        }
      }
      const backEmb = method === "embroidery" && cat !== "hat" && /\bback\b/i.test(String(it.locations || "")) && !/back of (the )?(cap|hat)/i.test(String(it.locations || ""));
      if (backEmb) flags.push(`Item ${items.indexOf(it) + 1}: asked for BACK embroidery — we don't offer it. Suggest screen print/DTF for the back. Priced front only.`);
      // Hoodies/sweatshirts embroider at the shirt price ($15), even "hooded jackets" / zip hoodies.
      const garmentText = `${it.item || ""} ${it.garment || ""}`;
      const jacket = /jacket|coat|vest|shell|parka|carhartt\s*j/i.test(garmentText) && !/hood|sweat/i.test(garmentText);
      const locations = Math.max((it.locations ? String(it.locations).split(/\+|,|&|\band\b/i).filter((x) => x.trim()).length : 1) - (backEmb ? 1 : 0), 1);
      let suggestions: Suggestion[] = [];
      if (qty >= CUSTOM_QUOTE_QTY) {
        // 700+ pieces: Phil prices these by hand
        pricing.push({ suggestions: [], requested: null, qty, method, custom: true, assumptions: "" });
        continue;
      }
      if (cat === "hat") {
        // Quantity unknown or "1 or 2 samples": price at the 12 minimum so the customer still gets a number.
        const hq = Math.max(qty, 12);
        // Hats use Phil's flat price list (same as the website), not the markup formula.
        // Embroidery = patch price up to 8,000 stitches; 2nd/3rd locations +$8 each.
        const hs = styleFromText(it.garment);
        const hp = hatPrice(hs, hq, { locations });
        const nq = hatNextTier(hq);
        pricing.push({
          suggestions: [], requested: hp, qty: hq, method, hat: true, locations, decoUnknown: String(it.decoration || "unknown") === "unknown",
          next: nq ? { qty: nq, pick: hatPrice(hs, nq, { locations }) } : null,
          assumptions: [
            "hat price list, shipping included",
            method === "embroidery" ? `up to ${HAT_STITCH_LIMIT.toLocaleString()} stitches (over that: +$3 to 10k, +$6 max to 21k — confirm after digitizing)` : "",
            method === "embroidery" && qty < 50 ? "+$45 digitizing" : "",
            String(it.decoration || "unknown") === "unknown" ? "decoration not chosen yet (same price for patch or embroidery)" : "",
            locations > 1 ? `${Math.min(locations, 3)} locations (+$8 each extra)` : "",
            locations > 3 ? "MORE THAN 3 LOCATIONS — price by hand" : "",
            qty < 12 ? (qty > 0 ? `asked for ${qty} — priced at the 12 minimum` : "quantity not given — priced at the 12 minimum") : "",
          ].filter(Boolean).join(", "),
        });
        continue;
      }
      if (cat && qty > 0 && method !== "unknown") {
        try {
          suggestions = await suggestTiers(db, cat, method, qty, { colors, locations, jacket });
        } catch (e) {
          console.error("pricing failed:", e);
        }
      }
      // Customer named a specific garment (e.g. "112PT") → price that exact style too
      let requested: Suggestion | null = null;
      const style = styleFromText(it.garment);
      if (style && qty > 0 && method !== "unknown") {
        try {
          requested = await suggestRequested(db, style, method, qty, { colors, locations, jacket });
        } catch (e) {
          console.error("requested-style pricing failed:", e);
        }
      }
      // Always show the next price break too (e.g. asked for 12 → also show 24)
      let next: Priced["next"] = null;
      const nq = method !== "unknown" ? matrixNextTier(method, qty) : null;
      if (nq && cat) {
        try {
          const ns = style ? await suggestRequested(db, style, method, nq, { colors, locations, jacket }) : null;
          const nt = ns ? null : (await suggestTiers(db, cat, method, nq, { colors, locations, jacket })).find((x) => x.tier === tierHint) ?? null;
          next = { qty: nq, pick: ns ?? nt };
        } catch (e) {
          console.error("next-tier pricing failed:", e);
        }
      }
      if (method === "screen_print") {
        const sf = screenFees(colors, locations, qty);
        fees.push(sf ? `+$${sf} screen fees ($${SCREEN_FEE} per color per location, waived at ${SCREEN_FEE_WAIVE_QTY}+)` : "screen fees waived");
      }
      const setup = method === "screen_print" ? screenFees(colors, locations, qty) : 0;
      pricing.push({ suggestions, requested, qty, method, assumptions: [assumptionsFor(method, colors), ...fees].join(", "), next,
        cat, colors, where: it.locations ? String(it.locations) : null, assumedWhere: it.locations_assumed === true, setup,
        fees: fees.filter((f) => /small order/.test(f)) });
    }

    // 5. Quote — follow-ups attach to the open quote instead of making a new one
    let quoteId: string | null = null;
    let quoteNumber: string | null = null;
    const existingQuote = openJob?.quote_id
      ? { id: openJob.quote_id, quote_number: (await db.from("quotes").select("quote_number").eq("id", openJob.quote_id).maybeSingle()).data?.quote_number ?? null }
      : (classification === "quote_follow_up" && openQuote ? openQuote : null);
    const attachToExisting = Boolean(existingQuote);
    if (existingQuote) {
      quoteId = existingQuote.id;
      quoteNumber = existingQuote.quote_number;
    } else {
      const { data: quote, error } = await db
        .from("quotes")
        .insert({
          customer_name: name,
          customer_email: fromEmail,
          customer_phone: phone,
          customer_id: customerId,
          company,
          status: "draft",
          notes: `From email (${mailbox}@): ${subject}\n\n${ai.summary || ""}`.trim(),
          raw_email: body,
          delivery_method: "pickup",
          state: "ID",
        })
        .select("id, quote_number")
        .single();
      if (error) throw new Error(`quote insert failed: ${error.message}`);
      quoteId = quote.id;
      quoteNumber = quote.quote_number;
    }

    if (items.length) {
      const rows = items.map((it, idx) => {
        const method = suggestMethod(it, totalQty);
        const pick = pricing[idx]?.requested ?? pricing[idx]?.suggestions.find((x) => x.tier === tierHint);
        const qty = Number(it.quantity) > 0 ? Math.round(Number(it.quantity)) : (items.length === 1 && totalQty ? totalQty : 1);
        const desc = [pick && !it.garment ? pick.name : (it.garment || it.item || "Item"), method !== "unknown" ? `— ${method.replace(/_/g, " ")}` : ""]
          .filter(Boolean).join(" ");
        return {
          quote_id: quoteId,
          service_type: DECORATION_TO_SERVICE[method] || "other",
          description: desc.slice(0, 200),
          quantity: qty,
          sizes: cleanSizes(it.sizes),
          color: it.colors ? String(it.colors).slice(0, 100) : null,
          placement: it.locations ? String(it.locations).slice(0, 200) : null,
          style_number: pick ? pick.style : null,
          garment_cost: pick?.garment_cost ?? 0,
          garment_markup_pct: pick?.markup_pct ?? 200,
          decoration_cost: pick?.decoration_cost ?? 0,
          decoration_params: {
            source: "email", ...it, suggested_method: method,
            suggested_tiers: pricing[idx]?.suggestions ?? [], pricing_assumptions: pricing[idx]?.assumptions ?? "",
          },
          line_total: pick ? Number((pick.unit_price * qty).toFixed(2)) : 0,
          notes: it.notes ? String(it.notes).slice(0, 500) : null,
          sort_order: idx,
        };
      });
      // On a reply, the AI returns the whole order so far, so replace the old lines.
      if (attachToExisting) await db.from("quote_line_items").delete().eq("quote_id", quoteId);
      const { error: liErr } = await db.from("quote_line_items").insert(rows);
      if (liErr) console.error("line items insert failed:", liErr.message);
    }

    // 6. Action item
    const itemSummary = items.length
      ? items.map((it) => `${Number(it.quantity) > 0 ? `${it.quantity} ` : ""}${it.garment || it.item}`).join(", ")
      : "items TBD";
    const kind = classification === "quote_follow_up" ? "Customer reply"
      : classification === "existing_customer_order" ? "Existing customer"
      : "Email quote";
    const title = `${ready ? "✅" : "❓"} ${kind}: ${name}${company ? ` (${company})` : ""} — ${itemSummary}`.slice(0, 200);

    const willDraft = Boolean(ai.reply_draft) || (pricing.some((p) => (p.hat && p.requested) || (!p.hat && !p.custom && (p.suggestions.length || p.requested))) &&
      ["new_quote_request", "quote_follow_up", "existing_customer_order"].includes(classification));
    const descLines = [
      ready ? "READY TO PRICE" : `NEEDS INFO: ${missing.join("; ") || "see email"}`,
      ...pricing.flatMap((p, i) => p.assumedWhere ? [`(Item ${i + 1} locations assumed: ${p.where} — the draft tells the customer)`] : []),
      "",
      ai.summary ? `What they want: ${ai.summary}` : "",
      quoteNumber ? `Quote: ${quoteNumber}${attachToExisting ? " (existing — customer replied with more info)" : " (new draft)"}` : "",
      `From: ${fromName} <${fromEmail}> via ${mailbox}@`,
      `Subject: ${subject}`,
      totalQty ? `Total qty: ${totalQty}` : "",
      ai.deadline ? `Deadline: ${ai.deadline}` : "",
      ai.artwork && ai.artwork !== "unknown" ? `Artwork: ${String(ai.artwork).replace(/_/g, " ")}` : "",
      ai.tier_hint && ai.tier_hint !== "unknown" ? `Garment tier: ${ai.tier_hint}` : "",
      attachmentNames.length ? `Attachments: ${attachmentNames.join(", ")}` : "",
      items.length ? art.note : "",
      neededLater.length ? `Before ordering: ${neededLater.join("; ")}` : "",
      "",
      ...items.map((it, i) => {
        const method = suggestMethod(it, totalQty);
        return `Item ${i + 1}: ${[
          it.quantity ? `${it.quantity} pcs` : "qty ?",
          it.garment || it.item,
          it.colors,
          it.locations,
          method !== "unknown" ? `method: ${method.replace(/_/g, " ")}` : "",
        ].filter(Boolean).join(" · ")}`;
      }),
      ...pricing.flatMap((p, i) => p.custom ? ["", `Item ${i + 1}: ${p.qty} pcs — CUSTOM QUOTE (${CUSTOM_QUOTE_QTY}+ pieces). No auto price; price this one by hand.`] : []),
      ...pricing.flatMap((p, i) => p.suggestions.length || p.requested ? [
        "",
        `Suggested price, item ${i + 1} (${p.qty} pcs, ${p.method.replace(/_/g, " ")}${p.assumptions ? `, ${p.assumptions}` : ""}):`,
        ...(p.requested ? [`  ★ ASKED FOR: ${p.requested.name} — $${p.requested.unit_price.toFixed(2)} ea / $${p.requested.total.toFixed(2)}`] : []),
        ...p.suggestions.map((s) =>
          `  ${!p.requested && s.tier === tierHint ? "→ " : "  "}${s.tier.toUpperCase()}: ${s.name} — $${s.unit_price.toFixed(2)} ea / $${s.total.toFixed(2)}${s.upcharge_2xl > 0 ? ` (2XL+ add $${s.upcharge_2xl.toFixed(2)})` : ""}`),
        ...(p.next?.pick ? [`  NEXT BREAK: ${p.next.qty} pcs of ${p.next.pick.name} — $${p.next.pick.unit_price.toFixed(2)} ea`] : []),
        ...(p.hat ? [`  UPSELL: side flag +$${HAT_SIDE_FLAG.toFixed(2)} per hat`] : []),
      ] : []),
      pricing.some((p) => !p.hat && (p.suggestions.length || p.requested)) ? "  (SanMar list cost × Printavo markup + decoration. Check before sending.)" : "",
      pricing.some((p) => p.hat && p.requested) ? "  (Hat price list. Check before sending.)" : "",
      ...(flags.length ? ["", ...flags.map((f) => `⚠ ${f}`)] : []),
      willDraft ? (pricing.some((p) => p.requested || p.suggestions.length)
        ? "\nA reply draft is saved in Gmail with prices included — check them, then send."
        : "\nA reply draft is saved in Gmail (no prices in it) — check it, then send.") : "",
    ].filter((l) => l !== "");

    let checklist: { id: string; text: string; done: boolean }[] = [
      ...allOpen.map((m) => ({ id: crypto.randomUUID(), text: `Get: ${m}`, done: false })),
      ...(art.status === "vector" || art.status === "good" ? [{ id: crypto.randomUUID(), text: "Make preview mockup (art looks usable)", done: false }] : []),
      ...(willDraft ? [{ id: crypto.randomUUID(), text: "Review + send the Gmail reply draft", done: false }] : []),
      { id: crypto.randomUUID(), text: "Price it (Good / Better / Best)", done: false },
      { id: crypto.randomUUID(), text: "Push to Printavo", done: false },
    ];
    if (openJob) {
      // Answered "Get:" items get checked off; still-missing ones stay open; new ones are added.
      const norm = (t: string) => t.toLowerCase().replace(/^get:\s*/, "").replace(/[^a-z0-9 ]/g, "").trim();
      const stillMissing = new Set(allOpen.map(norm));
      const merged = prevChecklist.map((c) => {
        if (/^Get: /.test(c.text) && !c.done && !stillMissing.has(norm(c.text))) return { ...c, done: true };
        if (c.text === "Review + send the Gmail reply draft" && willDraft) return { ...c, done: false };
        return c;
      });
      const have = new Set(merged.map((c) => norm(c.text)));
      const added = allOpen.filter((m) => !have.has(norm(m))).map((m) => ({ id: crypto.randomUUID(), text: `Get: ${m}`, done: false }));
      const firstNonGet = merged.findIndex((c) => !/^Get: /.test(c.text));
      checklist = firstNonGet === -1 ? [...merged, ...added] : [...merged.slice(0, firstNonGet), ...added, ...merged.slice(firstNonGet)];
      if ((art.status === "vector" || art.status === "good") && !checklist.some((c) => /^Make preview mockup/.test(c.text))) {
        const at = checklist.findIndex((c) => !/^Get: /.test(c.text));
        checklist.splice(at === -1 ? checklist.length : at, 0, { id: crypto.randomUUID(), text: "Make preview mockup (art looks usable)", done: false });
      }
      if (willDraft && !checklist.some((c) => c.text === "Review + send the Gmail reply draft")) {
        const at = checklist.findIndex((c) => !/^Get: /.test(c.text));
        checklist.splice(at === -1 ? checklist.length : at, 0, { id: crypto.randomUUID(), text: "Review + send the Gmail reply draft", done: false });
      }
    }

    const actionFields = {
      title,
      description: descLines.join("\n"),
      customer_name: name,
      customer_email: fromEmail,
      customer_phone: phone,
      customer_id: customerId,
      quote_id: quoteId,
      source: "email",
      priority: ready ? "high" : "normal",
      status: "open",
      checklist,
      notes: `${marker} thread:${threadId} mailbox:${mailbox}`,
    };
    if (openJob) {
      (actionFields as any).notes = `${openJob.notes || ""} ${marker}`.trim();
      (actionFields as any).description = `UPDATED from customer reply ${new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })}\n${descLines.join("\n")}`;
    }
    const { data: actionItem, error: aiErr } = openJob
      ? await db.from("action_items").update(actionFields).eq("id", openJob.id).select("id").single()
      : await db.from("action_items").insert(actionFields).select("id").single();
    if (aiErr) {
      // Don't leave an orphan draft quote behind when the action item can't be saved.
      if (!attachToExisting && quoteId) await db.from("quotes").delete().eq("id", quoteId);
      throw new Error(`action item insert failed: ${aiErr.message}`);
    }

    // 7. Alert Phil (never blocks)
    try {
      await db.functions.invoke("notify-new-action-item", {
        body: { action_item: { title, description: descLines.join("\n"), customer_name: name, source: "email", priority: ready ? "high" : "normal" } },
      });
    } catch (e) {
      console.error("notify failed:", e);
    }

    // 8. Prices go into the reply draft so the customer gets a number in the first reply.
    //    Hats: Phil's firm price list. Apparel: Good/Better/Best from the matrices, with what we assumed.
    //    Phil still reviews every draft before it's sent.
    let replyDraft: string | null = typeof ai.reply_draft === "string" && ai.reply_draft.trim() ? ai.reply_draft.trim() : null;
    const isFollowUp = Boolean(openJob || threadContext);
    const hatLines = pricing.filter((p) => p.hat && p.requested).map((p) => {
      const r = p.requested!;
      const nm = r.name.includes("not on hat list") ? "hats" : `${r.name} hats`;
      let t = `For ${Math.max(p.qty, 12)} ${nm} with your logo, it's $${r.unit_price.toFixed(2)} each.`;
      if (p.next?.pick) t += ` If you go to ${p.next.qty}, it drops to $${p.next.pick.unit_price.toFixed(2)} each.`;
      return t;
    });
    const paras: string[] = [];
    if (hatLines.length) {
      const emb = pricing.some((p) => p.hat && p.method === "embroidery" && p.qty < 50);
      const embMaybe = emb && pricing.every((p) => !p.hat || p.decoUnknown);
      // Follow-ups only restate the price; the sample/flag/turnaround details were in the first reply.
      paras.push(isFollowUp ? hatLines.join(" ") : [
        ...hatLines,
        "That includes a sample for approval and shipping in the lower 48.",
        emb ? (embMaybe ? "Same price for a patch or embroidery; embroidery has a one-time $45 digitizing fee." : "Embroidery has a one-time $45 digitizing fee.") : "",
        `We can also add a flag on the side for $${HAT_SIDE_FLAG} more per hat.`,
        "Turnaround is about 2-3 weeks after payment.",
      ].filter(Boolean).join(" "));
    }
    paras.push(...apparelPriceParas(pricing, isFollowUp));
    const priceable = ["new_quote_request", "quote_follow_up", "existing_customer_order"].includes(classification);
    if (paras.length && priceable) {
      const para = paras.join("\n\n");
      if (replyDraft) {
        // Put prices BEFORE the sign-off, whatever sign-off the AI used.
        const signOff = replyDraft.match(/\n\s*(?:thank you|thanks|best|regards|cheers)[ ,.!]*(?:so much)?[ ,.!]*\n+\s*phil\s*$/i)
          || replyDraft.match(/\n\s*phil\s*$/i);
        const bodyPart = signOff ? replyDraft.slice(0, signOff.index).trimEnd() : replyDraft.trimEnd();
        // PRICE FIRST: prices go right after the greeting + opening paragraph, questions after.
        const parts = bodyPart.split(/\n\s*\n/);
        const greet = /^(hi|hello|hey)\b[^\n]{0,40},?$/i.test(parts[0]?.trim() || "");
        const at = greet ? Math.min(2, parts.length) : Math.min(1, parts.length);
        parts.splice(at, 0, para);
        replyDraft = `${parts.join("\n\n")}\n\nThank you\n\nPhil`;
      } else {
        const first = String(name || "").split(/\s|@/)[0] || "there";
        replyDraft = `Hi ${first},\n\n${isFollowUp ? "" : "Thanks for reaching out. "}${para}\n\nThank you\n\nPhil`;
      }
    }

    const replyDraftHtml = replyDraft ? draftHtml(replyDraft.trimEnd()) : null;
    if (replyDraft) replyDraft = `${replyDraft.trimEnd()}\n\n${REPLY_FOOTER}`;

    return json({
      status: "created",
      updated_existing: Boolean(openJob),
      classification,
      ready_to_price: ready,
      action_item_id: actionItem.id,
      quote_number: quoteNumber,
      reply_draft: replyDraft,
      reply_draft_html: replyDraftHtml,
    });
  } catch (err) {
    console.error("process-inbound-email error:", err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
