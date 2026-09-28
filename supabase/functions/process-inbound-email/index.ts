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
import { categoryOf, suggestTiers, suggestRequested, styleFromText, hatPrice, hatNextTier, matrixNextTier, HAT_SIDE_FLAG, HAT_STITCH_LIMIT, assumptionsFor, type Suggestion, type Tier } from "../_shared/hcd-pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-intake-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const OWN_DOMAINS = ["hellscanyondesigns.com", "hellscanyonartglass.com", "mail.hellscanyondesigns.com"];

// ── Shop rules the AI uses. Keep this short and in Phil's words. ─────────────
const SHOP_RULES = `
You work intake for Hells Canyon Designs (HCD), a small custom apparel shop in Lewiston, Idaho.
Services: screen printing (10-color automatic press), DTF transfers, embroidery, and patch hats
(laser leather, leatherette, UV printed, PVC, embroidered patches) mostly on Richardson hats (112, 112PFP, etc.).
Rules of thumb:
- Orders under about 36-48 pieces are DTF. Larger runs are screen print candidates.
- Shirt minimum is 12 pieces. Small jobs still need to be worth doing.
- Phil offers Good / Better / Best garment options (e.g. Good = Gildan/Jerzees basics, Better = Next Level 6210 / Bella Canvas 3001, Best = Comfort Colors / premium).
- Most customers say "screen print" but don't know methods. Don't make them choose a method — we recommend it.
- "People love hot dogs. No one really wants to know how a hot dog is made." Ask customers only what we need, in plain language.
What we need to price a job:
- Apparel: what items, rough quantity, which decoration locations (e.g. left chest + back), artwork (or that it's coming), and roughly Good/Better/Best or a garment they like. Sizes and colors are needed before ordering, not before a first price.
- Hats: rough quantity, hat style or "like the Richardson 112", decoration type (patch / embroidery) and artwork.\n  Hat embroidery is the same price as a patch up to 8,000 stitches — never ask customers for stitch counts.\n  Hat prices are added to the reply automatically; do not write prices yourself.
- Deadline if they have one.
`;

const SYSTEM_PROMPT = `${SHOP_RULES}
Read the email (and any earlier thread context) and return ONLY a JSON object with this shape:
{
  "classification": "new_quote_request" | "quote_follow_up" | "existing_customer_order" | "vendor_or_solicitation" | "not_actionable",
  "confidence": 0-1,
  "customer": { "name": string|null, "company": string|null, "phone": string|null },
  "summary": "one or two sentences in plain English about what they want",
  "items": [
    { "item": "t-shirts|hoodies|polos|hats|jackets|hi-vis|other", "garment": string|null, "colors": string|null,
      "quantity": number|null, "sizes": { "S": number, ... } | null,
      "decoration": "screen_print|dtf|embroidery|leather_patch|uv_patch|pvc_patch|woven_patch|unknown",
      "locations": string|null, "print_colors": number|null, "notes": string|null }
  ],
  "total_quantity": number|null,
  "deadline": string|null,
  "artwork": "attached|coming|needs_design|unknown",
  "tier_hint": "good|better|best|unknown",
  "missing": [ short plain-language things still needed to give a first price ],
  "ready_to_price": boolean,
  "reply_draft": string|null
}
Guidance:
- vendor_or_solicitation = someone trying to SELL to HCD (digitizing, patches, blanks, marketing, SEO, shop closing sales).
- quote_follow_up = customer replying with more info (sizes, logo, quantity) on something already being quoted.
- existing_customer_order = a known customer asking for a reorder or a new job.
- not_actionable = receipts, notifications, spam, thank-yous that need nothing.
- ready_to_price is true only if we know items, rough quantity and decoration locations (artwork may still be coming).
- print_colors: number of ink colors in the design only if the customer says so or it's obvious (e.g. "white logo" = 1). Otherwise null.
- Don't invent numbers. If a quantity is a range, use the low end and say so in notes.
- reply_draft: only when classification is new_quote_request, quote_follow_up or existing_customer_order AND something is missing.
  Write it like Phil: short, friendly, plain, 2-5 sentences, ask at most 3 things, no prices, no bullet-point walls,
  no "I hope this email finds you well". Start with "Hi <first name>," and end with "Thank you\\n\\nPhil".
  If nothing is missing, reply_draft is null.
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
  if (q > 0 && q < 36) return "dtf";
  if (q >= 48) return "screen_print";
  return "unknown";
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

async function runAI(userContent: string): Promise<any> {
  const apiKey = Deno.env.get("AI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI_API_KEY (or LOVABLE_API_KEY) is not configured");
  const url = Deno.env.get("AI_API_URL") || "https://ai.gateway.lovable.dev/v1/chat/completions";
  const model = Deno.env.get("AI_MODEL") || "google/gemini-3-flash-preview";

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

    // 3. AI extraction
    const ai = await runAI([
      `Mailbox: ${mailbox}@`,
      `From: ${fromName} <${fromEmail}>`,
      customer
        ? `Known customer: ${customer.name}${customer.company ? ` (${customer.company})` : ""}, ${customer.total_orders ?? 0} past orders${openQuote ? `, open quote ${openQuote.quote_number} (${openQuote.status})` : ""}`
        : "Not in our customer list.",
      `Subject: ${subject}`,
      attachmentNames.length ? `Attachments: ${attachmentNames.join(", ")}` : "No attachments.",
      "",
      "EMAIL:",
      body,
      threadContext ? `\nEARLIER IN THREAD:\n${threadContext}` : "",
    ].join("\n"));

    const classification = String(ai.classification || "not_actionable");
    if (dryRun) return json({ status: "dry_run", customer_match: customer?.name ?? null, open_quote: openQuote?.quote_number ?? null, ai });

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
    const ready = ai.ready_to_price === true && missing.length === 0;

    // 4b. Suggested Good / Better / Best pricing (Printavo formula, suggestions only)
    const tierHint = (["good", "better", "best"].includes(String(ai.tier_hint)) ? ai.tier_hint : "better") as Tier;
    type Priced = { suggestions: Suggestion[]; requested: Suggestion | null; qty: number; method: string; assumptions: string;
      next?: { qty: number; pick: Suggestion | null } | null; hat?: boolean; locations?: number };
    const pricing: Priced[] = [];
    for (const it of items) {
      const method = suggestMethod(it, totalQty);
      const cat = categoryOf(it.item || it.garment);
      const qty = Number(it.quantity) > 0 ? Math.round(Number(it.quantity)) : (items.length === 1 && totalQty ? totalQty : 0);
      const colors = Number(it.print_colors) > 0 ? Math.round(Number(it.print_colors)) : null;
      const locations = it.locations ? String(it.locations).split(/\+|,|&|\band\b/i).filter((x) => x.trim()).length : 1;
      let suggestions: Suggestion[] = [];
      if (cat === "hat" && qty > 0) {
        // Hats use Phil's flat price list (same as the website), not the markup formula.
        // Embroidery = patch price up to 8,000 stitches; 2nd/3rd locations +$8 each.
        const hs = styleFromText(it.garment);
        const hp = hatPrice(hs, qty, { locations });
        const nq = hatNextTier(qty);
        pricing.push({
          suggestions: [], requested: hp, qty, method, hat: true, locations,
          next: nq ? { qty: nq, pick: hatPrice(hs, nq, { locations }) } : null,
          assumptions: [
            "hat price list, shipping included",
            method === "embroidery" ? `up to ${HAT_STITCH_LIMIT.toLocaleString()} stitches` : "",
            method === "embroidery" && qty < 50 ? "+$45 digitizing" : "",
            locations > 1 ? `${Math.min(locations, 3)} locations (+$8 each extra)` : "",
            locations > 3 ? "MORE THAN 3 LOCATIONS — price by hand" : "",
            qty < 12 ? "12 minimum" : "",
          ].filter(Boolean).join(", "),
        });
        continue;
      }
      if (cat && qty > 0 && method !== "unknown") {
        try {
          suggestions = await suggestTiers(db, cat, method, qty, { colors, locations });
        } catch (e) {
          console.error("pricing failed:", e);
        }
      }
      // Customer named a specific garment (e.g. "112PT") → price that exact style too
      let requested: Suggestion | null = null;
      const style = styleFromText(it.garment);
      if (style && qty > 0 && method !== "unknown") {
        try {
          requested = await suggestRequested(db, style, method, qty, { colors, locations });
        } catch (e) {
          console.error("requested-style pricing failed:", e);
        }
      }
      // Always show the next price break too (e.g. asked for 12 → also show 24)
      let next: Priced["next"] = null;
      const nq = method !== "unknown" ? matrixNextTier(method, qty) : null;
      if (nq && cat) {
        try {
          const ns = style ? await suggestRequested(db, style, method, nq, { colors, locations }) : null;
          const nt = ns ? null : (await suggestTiers(db, cat, method, nq, { colors, locations })).find((x) => x.tier === tierHint) ?? null;
          next = { qty: nq, pick: ns ?? nt };
        } catch (e) {
          console.error("next-tier pricing failed:", e);
        }
      }
      pricing.push({ suggestions, requested, qty, method, assumptions: assumptionsFor(method, colors), next });
    }

    // 5. Quote — follow-ups attach to the open quote instead of making a new one
    let quoteId: string | null = null;
    let quoteNumber: string | null = null;
    const attachToExisting = classification === "quote_follow_up" && openQuote;
    if (attachToExisting) {
      quoteId = openQuote!.id;
      quoteNumber = openQuote!.quote_number;
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
        const { error: liErr } = await db.from("quote_line_items").insert(rows);
        if (liErr) console.error("line items insert failed:", liErr.message);
      }
    }

    // 6. Action item
    const itemSummary = items.length
      ? items.map((it) => `${Number(it.quantity) > 0 ? `${it.quantity} ` : ""}${it.garment || it.item}`).join(", ")
      : "items TBD";
    const kind = classification === "quote_follow_up" ? "Customer reply"
      : classification === "existing_customer_order" ? "Existing customer"
      : "Email quote";
    const title = `${ready ? "✅" : "❓"} ${kind}: ${name}${company ? ` (${company})` : ""} — ${itemSummary}`.slice(0, 200);

    const willDraft = Boolean(ai.reply_draft) || (pricing.some((p) => p.hat && p.requested) &&
      ["new_quote_request", "quote_follow_up", "existing_customer_order"].includes(classification));
    const descLines = [
      ready ? "READY TO PRICE" : `NEEDS INFO: ${missing.join("; ") || "see email"}`,
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
      ...pricing.flatMap((p, i) => p.suggestions.length || p.requested ? [
        "",
        `Suggested price, item ${i + 1} (${p.qty} pcs, ${p.method.replace(/_/g, " ")}${p.assumptions ? `, ${p.assumptions}` : ""}):`,
        ...(p.requested ? [`  ★ ASKED FOR: ${p.requested.name} — $${p.requested.unit_price.toFixed(2)} ea / $${p.requested.total.toFixed(2)}`] : []),
        ...p.suggestions.map((s) =>
          `  ${!p.requested && s.tier === tierHint ? "→ " : "  "}${s.tier.toUpperCase()}: ${s.name} — $${s.unit_price.toFixed(2)} ea / $${s.total.toFixed(2)}${s.upcharge_2xl > 0 ? ` (2XL+ add $${s.upcharge_2xl.toFixed(2)})` : ""}`),
        ...(p.next?.pick ? [`  NEXT BREAK: ${p.next.qty} pcs of ${p.next.pick.name} — $${p.next.pick.unit_price.toFixed(2)} ea`] : []),
        ...(p.hat ? [`  UPSELL: side flag +$${HAT_SIDE_FLAG.toFixed(2)} per hat`] : []),
      ] : []),
      pricing.some((p) => p.suggestions.length || p.requested) ? "  (SanMar list cost × Printavo markup + decoration. Check before sending.)" : "",
      willDraft ? "\nA reply draft is saved in Gmail (hat prices included when it's a hat job) — review and send." : "",
    ].filter((l) => l !== "");

    const checklist = [
      ...missing.map((m) => ({ id: crypto.randomUUID(), text: `Get: ${m}`, done: false })),
      ...(willDraft ? [{ id: crypto.randomUUID(), text: "Review + send the Gmail reply draft", done: false }] : []),
      { id: crypto.randomUUID(), text: "Price it (Good / Better / Best)", done: false },
      { id: crypto.randomUUID(), text: "Push to Printavo", done: false },
    ];

    const { data: actionItem, error: aiErr } = await db
      .from("action_items")
      .insert({
        title,
        description: descLines.join("\n"),
        customer_name: name,
        customer_email: fromEmail,
        customer_phone: phone,
        customer_id: customerId,
        quote_id: quoteId,
        source: "email",
        priority: ready ? "high" : "medium",
        status: "open",
        checklist,
        notes: `${marker} thread:${threadId} mailbox:${mailbox}`,
      })
      .select("id")
      .single();
    if (aiErr) throw new Error(`action item insert failed: ${aiErr.message}`);

    // 7. Alert Phil (never blocks)
    try {
      await db.functions.invoke("notify-new-action-item", {
        body: { action_item: { title, description: descLines.join("\n"), customer_name: name, source: "email", priority: ready ? "high" : "medium" } },
      });
    } catch (e) {
      console.error("notify failed:", e);
    }

    // 8. Hat prices are a firm list, so the reply draft gives them the price,
    //    the next break, and the side-flag option. Phil still reviews before sending.
    let replyDraft: string | null = typeof ai.reply_draft === "string" && ai.reply_draft.trim() ? ai.reply_draft.trim() : null;
    const hatLines = pricing.filter((p) => p.hat && p.requested).map((p) => {
      const r = p.requested!;
      const nm = r.name.includes("not on hat list") ? "hats" : `${r.name.replace(/^Richardson /, "")} hats`;
      let t = `For ${Math.max(p.qty, 12)} ${nm} with your logo, it's $${r.unit_price.toFixed(2)} each.`;
      if (p.next?.pick) t += ` If you go to ${p.next.qty}, it drops to $${p.next.pick.unit_price.toFixed(2)} each.`;
      return t;
    });
    if (hatLines.length && ["new_quote_request", "quote_follow_up", "existing_customer_order"].includes(classification)) {
      const emb = pricing.some((p) => p.hat && p.method === "embroidery" && p.qty < 50);
      const para = [
        ...hatLines,
        "That includes a sample for approval and shipping in the lower 48.",
        emb ? "Embroidery has a one-time $45 digitizing fee." : "",
        `We can also add a flag on the side for $${HAT_SIDE_FLAG} more per hat.`,
        "Turnaround is about 2-3 weeks after payment.",
      ].filter(Boolean).join(" ");
      if (replyDraft) {
        const i = replyDraft.lastIndexOf("Thank you");
        replyDraft = i > 0 ? `${replyDraft.slice(0, i).trimEnd()}\n\n${para}\n\n${replyDraft.slice(i)}` : `${replyDraft}\n\n${para}`;
      } else {
        const first = String(name || "").split(/\s|@/)[0] || "there";
        replyDraft = `Hi ${first},\n\nThanks for reaching out. ${para}\n\nThank you\n\nPhil`;
      }
    }

    return json({
      status: "created",
      classification,
      ready_to_price: ready,
      action_item_id: actionItem.id,
      quote_number: quoteNumber,
      reply_draft: replyDraft,
    });
  } catch (err) {
    console.error("process-inbound-email error:", err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
