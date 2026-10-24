#!/usr/bin/env node
// Email regression tests for process-inbound-email.
//
// Sends each real customer email in cases.json to the function in PREVIEW mode (dry_run: "draft"):
// the real AI and real pricing run and the full reply draft comes back, but nothing is written
// (no customer, quote, action item or alert). Then every draft is checked against the HCD standard:
// Good/Better/Best from the pricing code, pleasant + short, consistent policies (Phil 2026-10-17).
//
//   EMAIL_EVAL_URL=https://<ref>.supabase.co/functions/v1/process-inbound-email-eval \
//   EMAIL_EVAL_SECRET=... node tests/email-eval/run.mjs [--only id,id] [--report report.md]
//
// Exit code 1 if any case fails. The AI isn't perfectly repeatable, so a case that fails once and
// passes on a re-run is still worth a look.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const only = opt("--only")?.split(",");
const reportPath = opt("--report");
const url = process.env.EMAIL_EVAL_URL;
const secret = process.env.EMAIL_EVAL_SECRET;
if (!url || !secret) { console.error("Set EMAIL_EVAL_URL and EMAIL_EVAL_SECRET."); process.exit(2); }

const { cases } = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const todo = cases.filter((c) => !only || only.includes(c.id));

// ── Checks ──────────────────────────────────────────────────────────────────
const MAX_WORDS = 170; // words outside the price lines
const FILLER = /pricing depends|hope (this|you|your)|finds you well|don'?t hesitate|feel free to reach out|however many you plan|explain those options/i;
const DATE_PROMISE = /we(?:'ll| will| can) (?:definitely )?(?:have|get) (?:them|it|these|everything|your \w+) (?:done |ready |finished |to you )?by|\bguarantee/i;
const HAT_SIZES = /hat sizes|sizes for the hats|sizes? (?:of|on) the hats|what size hats/i;
const PRICE = /\$\d/;
// Phil decides calls, photos, samples and dates — the draft never promises them (2026-10-24).
const PROMISE = /\b(?:I|we)(?:'ll| will| can)\s+(?:also\s+)?(?:give you a (?:ring|call)|call you|send (?:you\s+)?(?:over\s+)?(?:some\s+|the\s+|a few\s+)?(?:pictures|photos|pics|samples?|a mockup|mockups|spec sheets?|the colors|colors))|\bshortly\b/i;
const THANKS_OPENER = /^(?:hi|hello|hey)\b[^\n]*\n+\s*(?:thanks|thank you)(?: so much)? for (?:confirming|following up|the follow|sending|letting|the update|getting back|checking in)/i;

function textOf(draft) {
  const cut = draft.indexOf("\n--\n");
  return (cut >= 0 ? draft.slice(0, cut) : draft).trim();
}
function sentences(t) {
  return t.replace(/\n/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 30);
}

function check(c, res) {
  const fails = [];
  const e = c.expect;
  const draft = typeof res.reply_draft === "string" ? textOf(res.reply_draft) : "";
  if (e.draft === false) {
    if (draft) fails.push(`should get NO draft (paperwork/vendor), but got one`);
    return { fails, draft };
  }
  if (!draft && e.draft_optional) return { fails, draft };
  if (!draft) { fails.push(`no draft came back (status: ${res.status}${res.classification ? `, ${res.classification}` : ""})`); return { fails, draft }; }

  const email = `${c.subject} ${c.body}`;
  // Always-on standard
  if (/\bpvc\b/i.test(draft) && !/\bpvc\b/i.test(email)) fails.push("mentions PVC, but the customer didn't ask");
  if (FILLER.test(draft)) fails.push(`filler: "${draft.match(FILLER)[0]}"`);
  const sents = sentences(draft);
  const dup = sents.find((s, i) => sents.indexOf(s) !== i);
  if (dup) fails.push(`repeats a sentence: "${dup.slice(0, 70)}…"`);
  const words = draft.split("\n").filter((l) => !PRICE.test(l)).join(" ").split(/\s+/).filter(Boolean).length;
  if (words > MAX_WORDS) fails.push(`too long: ${words} words outside the price lines (max ${MAX_WORDS})`);
  if (e.max_words && words > e.max_words) fails.push(`too long for a quick reply: ${words} words (max ${e.max_words})`);
  if (PROMISE.test(draft)) fails.push(`makes a promise for Phil: "${draft.match(PROMISE)[0]}"`);
  if (e.followup && THANKS_OPENER.test(draft)) fails.push(`follow-up opens with "Thanks for…"`);
  if (e.followup) {
    if (/thanks for reaching out/i.test(draft)) fails.push(`follow-up repeats "Thanks for reaching out"`);
  } else if (PRICE.test(draft) && draft.includes("?") && draft.indexOf("?") < draft.search(PRICE)) {
    fails.push(`asks a question before giving a price: "${draft.slice(Math.max(0, draft.lastIndexOf("\n", draft.indexOf("?")) + 1), draft.indexOf("?") + 1).trim().slice(0, 90)}"`);
  }

  // Per-case
  for (const s of e.contains ?? []) if (!draft.includes(s)) fails.push(`missing "${s}"`);
  for (const group of e.contains_any ?? []) if (!group.some((s) => draft.toLowerCase().includes(s.toLowerCase()))) fails.push(`missing any of: ${group.join(" / ")}`);
  for (const group of e.contains_any_re ?? []) if (!group.some((r) => new RegExp(r, "i").test(draft))) fails.push(`missing any of: ${group.join(" / ")}`);
  for (const s of e.not_contains ?? []) if (draft.toLowerCase().includes(s.toLowerCase())) fails.push(`should not say "${s}"`);
  for (const r of e.not_contains_re ?? []) if (new RegExp(r, "i").test(draft)) fails.push(`should not say /${r}/`);
  if (e.hat_sizes === false && HAT_SIZES.test(draft)) fails.push(`asks for hat sizes: "${draft.match(HAT_SIZES)[0]}"`);
  if (e.gbb) {
    const priceLines = draft.split("\n").filter((l) => /^\s*[-•*]\s.*\$\d/.test(l)).length;
    const need = e.min_option_lines ?? 3;
    if (priceLines < need) fails.push(`Good/Better/Best missing (found ${priceLines} option line${priceLines === 1 ? "" : "s"} with prices, need ${need})`);
  }
  for (const [word, max] of Object.entries(e.max_mentions ?? {})) {
    const n = (draft.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length;
    if (n > max) fails.push(`repeats "${word}" ${n} times (the options should be listed once)`);
  }
  if (e.no_prices && PRICE.test(draft)) fails.push("gives a price (it shouldn't for this one)");
  if (e.no_date_promise && DATE_PROMISE.test(draft)) fails.push(`promises a date: "${draft.match(DATE_PROMISE)[0]}"`);
  const flags = Array.isArray(res.flags) ? res.flags : [];
  for (const r of e.flags ?? []) if (!flags.some((f) => new RegExp(r, "i").test(f))) fails.push(`action item should flag /${r}/ (flags: ${flags.length ? flags.join(" | ") : "none"})`);
  const t = checkTemplate(c, res);
  fails.push(...t.fails);
  return { fails, draft, words, items: res.ai?.items, template: t.draft, templateId: res.template_id };
}

// The office (info@) template reply. Same safety rules; only the price numbers are checked from "contains".
function checkTemplate(c, res) {
  const e = c.expect ?? {};
  const fails = [];
  const draft = typeof res.template_draft === "string" ? textOf(res.template_draft) : "";
  const id = res.template_id;
  if (e.template && !(Array.isArray(e.template) ? e.template : [e.template]).includes(id)) fails.push(`template: picked "${id}", expected ${[].concat(e.template).join(" / ")}`);
  if (e.draft === false) { if (draft) fails.push("template: should be no reply, but got one"); return { fails, draft }; }
  if (!draft) { if (e.draft && !e.draft_optional && !e.template_optional) fails.push(`template: no reply (picked "${id}")`); return { fails, draft }; }
  if (PROMISE.test(draft)) fails.push(`template: makes a promise: "${draft.match(PROMISE)[0]}"`);
  if (e.no_prices && PRICE.test(draft)) fails.push("template: gives a price (it shouldn't for this one)");
  for (const s of (e.contains ?? []).filter((x) => x.startsWith("$"))) if (!draft.includes(s)) fails.push(`template: missing "${s}"`);
  for (const s of e.not_contains ?? []) if (draft.toLowerCase().includes(s.toLowerCase())) fails.push(`template: should not say "${s}"`);
  for (const r of e.not_contains_re ?? []) if (new RegExp(r, "i").test(draft)) fails.push(`template: should not say /${r}/`);
  if (e.hat_sizes === false && HAT_SIZES.test(draft)) fails.push(`template: asks for hat sizes`);
  return { fails, draft };
}

// ── Run ─────────────────────────────────────────────────────────────────────
async function send(c, attempt = 1) {
  const payload = {
    dry_run: "draft",
    message_id: `eval-${c.id}-${Date.now()}`,
    thread_id: `eval-thread-${c.id}`,
    mailbox: "phil",
    from_email: c.from_email ?? `eval+${c.id}@example.com`,
    from_name: c.from_name,
    subject: c.subject,
    body: c.body,
    thread_context: c.thread_context ?? "",
    attachment_names: (c.attachments ?? []).map((a) => a.name),
    attachment_meta: c.attachments ?? [],
  };
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-eval-secret": secret }, body: JSON.stringify(payload) });
  const json = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok && attempt < 2 && r.status >= 500) return send(c, attempt + 1);
  if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
  return json;
}

// The AI words things a little differently each run. A case only fails if it misses on two tries;
// a miss-then-pass is reported as "wobbly" so it's visible without blocking.
async function runOne(c) {
  try { return { c, ...check(c, await send(c)) }; }
  catch (err) { return { c, fails: [`request failed: ${err.message}`], draft: "" }; }
}
const results = [];
const queue = [...todo];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const c = queue.shift();
    let r = await runOne(c);
    if (r.fails.length) {
      const second = await runOne(c);
      if (!second.fails.length) r = { ...second, wobbly: r.fails };
      else r = second;
    }
    results.push(r);
  }
}));
results.sort((a, b) => todo.indexOf(a.c) - todo.indexOf(b.c));

const passed = results.filter((r) => !r.fails.length).length;
const lines = [
  `## Email draft tests: ${passed} of ${results.length} pass`,
  "",
  "| | Email | Result |",
  "|---|---|---|",
  ...results.map((r) => `| ${r.fails.length ? "❌" : r.wobbly ? "⚠️" : "✅"} | ${r.c.title} | ${r.fails.length ? r.fails.join("; ").replace(/\|/g, "/") : r.wobbly ? `pass on 2nd try (1st: ${r.wobbly.join("; ").replace(/\|/g, "/")})` : "pass"} |`),
  "",
  ...results.filter((r) => r.fails.length && r.draft).flatMap((r) => [
    `<details><summary>${r.c.id}: the draft</summary>`, "", "```", r.draft, "```",
    ...(r.items ? ["AI items:", "```json", JSON.stringify(r.items.map((it) => ({ item: it.item, garment: it.garment, quantity: it.quantity, decoration: it.decoration, notes: it.notes })), null, 0), "```"] : []), "</details>", "",
  ]),
  ...(results.some((r) => !r.fails.length && r.draft) ? [
    "<details><summary>All passing drafts</summary>", "",
    ...results.filter((r) => !r.fails.length).flatMap((r) => [`**${r.c.id}**`, "", "```", r.draft || "(no draft)", "```", ""]),
    "</details>", "",
    "<details><summary>Office template replies (info@)</summary>", "",
    ...results.flatMap((r) => [`**${r.c.id}** — ${r.templateId ?? "?"}`, "", "```", r.template || "(no reply)", "```", ""]),
    "</details>", "",
  ] : []),
];
const report = lines.join("\n");
console.log(report);
if (reportPath) writeFileSync(reportPath, report);
process.exit(passed === results.length ? 0 : 1);
