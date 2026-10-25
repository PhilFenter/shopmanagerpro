# Decisions Log

Short entries on non-obvious calls made in this app, so nobody (including future us)
"fixes" something back without knowing why it's the way it is.

---

## Counter Quote screen is customer-facing on purpose
**Date:** 2026-10
**What:** `/counter` is a full-screen walk-in quote page with no sidebar. It's meant to be used with
the customer sitting next to the salesperson at the work-area iMac. Prices come from
`_shared/hcd-pricing.ts`, the same engine as email and website intake. Saving creates one
quote, its line items, and one action item (`source: "counter"`). "Send to Printavo" calls the
existing `push-to-printavo` on that same quote.

**Why:** Walk-ins were ending up on sticky notes. Typing a Printavo quote while the customer
watches felt awkward: lots of internal fields, costs and markups on screen, and no price until
the end. This screen shows the price first, contact info comes second, and nothing internal
(garment cost, markup %) is ever shown.

**Don't:**
- Show garment cost or markup on this page. The customer can see it.
- Copy pricing numbers into `src/lib/counterQuote.ts`. Change `hcd-pricing.ts`, and the counter,
  email, and website quotes all stay in sync.
- Remove "Quick note". It's the sticky-note replacement for when there's no time for a full quote.
- Price customer-supplied garments here. The screen flags them for management review, per the written policy.

---

## Garment labels and scan stations (paperless production Phase 2)
**Date:** 2026-10-25
**What:** Approving an InkSoft order creates one `prod_garments` row per physical piece and one
`prod_tasks` row per decoration. Each piece gets a 2×2 label with a QR link (`/g/<random code>`).
Station computers (DTF, embroidery, shipping & receiving) scan with keyboard-mode scanners into `/scan`.
Shipping & receiving assigns numbered table spots (blue tape) and does the final check. Pickup orders get a
4×6 label (`/p/<random code>`); ship orders are marked shipped.

**Why:** Phil asked for this on Oct 25 2026: 2×2 labels on a shoulder or sleeve, three scanner stations,
about 20 tape spots on glacier days, and a pickup label with name, order number and department only if the
order has one. Stations use ordinary team logins, because the shop is all internal and doesn't need
per-person tracking yet.

**Don't:**
- Put names, order numbers or anything personal inside the QR. The random code is looked up in the database.
- Delete or renumber garments when an order changes. Void them, so printed labels keep meaning the same piece.
- Let a scan complete a task at a different station, or put a piece with an open task into a spot.
- Require a pickup label for ship orders, or add carrier/postage integration here.
- Remove `client_scan_id`. It's what makes a double-fired scan harmless.

---

## InkSoft work-order import: read the PDF in the browser, approve before anything is produced
**Date:** 2026-10-25
**What:** `/production/imports` reads InkSoft work-order PDFs with pdf.js in the browser (no AI, no
server parsing), stores the original PDF untouched in the private `production-imports` bucket, and
saves orders as `prod_*` rows in **review** status. A manager approves each order before it counts
for anything (transfer list now, labels and scanning later). The Orders CSV is optional and only adds
pickup location and Department / Department Number. `/production/transfers` lists DTF transfers
for approved orders. Design: `docs/PAPERLESS-PRODUCTION.md`.

**Why:** InkSoft is the source of truth and we can't change it. We needed the work orders as data
without retyping, and without trusting a parser blindly. A missing page, a cut-off SKU or a total
that doesn't add up blocks approval instead of being guessed.

**Don't:**
- Write to `prod_*` tables directly. Every change goes through a `prod_*` RPC that checks the role,
  logs a `prod_events` row and refuses to edit approved orders.
- Treat preview images as production art. They are low-res copies from the PDF
  (`production_ready` is CHECK-constrained false). Never send them to DTF or embroidery.
- Overwrite InkSoft's decoration method. `method_inksoft` stays verbatim. `method_production` is
  HCD's call: for now `ScreenPrint`→DTF and `DigitalPrint`→DTF via `prod_method_rules`. Staff
  changes need a reason.
- Let a re-uploaded file make duplicates. The same file (sha256) opens the earlier import. The
  same order with the same content is "unchanged". A changed copy of an approved order waits as a
  pending revision until a manager applies or dismisses it.
- Put customer details in a QR code (later phases): only an opaque ID.

---

## Time Tracking gated to Admin/Manager only
**Date:** 2026-07
**What:** The Time Tracking block (`JobTimer`, `TimeEntryForm`, `TimeEntriesList`) on the
Job detail view is now hidden from regular team roles and only visible when
`hasFinancialAccess(role)` is true (same gate as `JobCostSummary`).

**Why:** This feature came from the original Lovable-generated project plan
(`.lovable/plan.md`, Phase 2), not from an actual production need. It asked every
operator to find the job, pick who's working, note the operation, and start/stop a
timer on every job — real friction for a small team, for data nobody was reliably
using. It was originally justified by trust concerns with two former employees who
are no longer here; the current team doesn't have that problem, and manual entries
have been inconsistent regardless (people don't reliably clock out).

**What it's for now:** Not deleted, just not part of the daily workflow. Still available
to admins/managers to spot-check actual time on a new or unusual job when it's useful
for pricing — a deliberate, occasional pricing tool, not an ambient requirement.

**What replaces it for day-to-day costing:** Standard time per operation (quantity ×
known rate for screen print/DTF/embroidery runs) rather than measured time per job.
Shop-level breakeven doesn't need per-job timer data either — it comes from aggregate
labor hours and overhead, which doesn't require anyone hitting a stopwatch.

**Don't re-enable for the team without:**
- A real decision to bring back per-job measured time (e.g. a trust/accountability
  issue recurs), not just "it'd be nice to have the data."
- A way to capture it that piggybacks on something people are already doing
  (like the QR-scan fulfillment flow), not a standalone data-entry step.

---

<!-- Add new entries above this line, most recent first. -->
## 2026-10-07 — System health fixes (silent failures)
- Scheduled jobs (Printavo sync, quote status/import, Shopify sync) were all getting 401: Vault holds the legacy service-role JWT, the runtime's SUPABASE_SERVICE_ROLE_KEY no longer string-matches it. `_shared/auth.ts` `isServiceRoleRequest()` now accepts either form; a JWT is only trusted after Supabase Auth's admin API accepts it.
- Quote follow-ups stay OFF on purpose: Phil sends quote reminders from Printavo. quote-follow-up is unchanged and keeps rejecting the cron call; unschedule `quote-follow-up-daily` if it should stop trying.
- Resend rejects the root domain (not verified); alerts@ and quotes@ now send from mail.hellscanyondesigns.com like the customer emails, replies to info@.
- notify-new-action-item was callable by anyone with any body; it now builds the alert from the real row and only for items created in the last 2 minutes (same rule as send-push).

## 2026-10-07 — Jobs are paid-in-full invoices only
- Phil: "until it's paid it's not a job." Quotes stay separate (sent to Printavo, art and sizes added there); a job comes into ShopManagerPro only once Printavo marks the invoice paid in full. Jobs drive metrics, customer spend, 80/20, and later saved recipes / production files.
- printavo-sync asks Printavo for `paymentStatus: PAID` and double-checks `paidInFull`. Lookback is 90 days by creation date so an invoice paid weeks after it was created still comes in (was 7 days).
- Existing unpaid jobs were left in place pending Phil's review (17 on 2026-10-07: 5 with money owed, 12 at $0).
- printavo-schema-probe is now a read-only, service-role-only list of unpaid / partly paid invoices.

## 2026-10-09 — Counter "customer's pick": live SanMar / S&S lookup
- product_catalog doesn't have many styles customers ask for (PC55, PC54, PC61) and 1,323 SanMar rows are $0 (Gildan 5000, BC3001, PC450…). The style box used to say "We'll look up…" and stop.
- Now: catalog first; if missing or $0, ask SanMar getPricing for HCD's own cost (myPrice), then S&S. S–XL cost uses the higher (color) price, 2XL likewise: estimate high, never raise later. Result is cached for the session and written back to product_catalog (admins), so email/website quotes see it too.
- The screen waits for a 0.7s typing pause before looking up, shows "Looking up PC55…", and says plainly when a style isn't found at either supplier.
- sanmar-api accepted only user sessions, so the nightly Printavo sync's SanMar cost step was getting 401 every night; it now also accepts the service role.

## 2026-10-09 — Screen print: different color counts per location
- Each location is its own design, priced at its own color column (1-color front + 3-color back at 72 = $1.65 + $3.45). Screens = sum of colors × $20 (waived 144+). Previously every extra location was assumed 1-color.
- Minimum (Phil): total colors across all locations → 24 + 12 per extra color (1 + 3 = 4 colors = 60). Between the busiest single design's minimum and that total: priced, flagged "needs a manager's OK" on screen and in the saved quote notes. Below the busiest design's minimum: hard stop with DTF offer, as before.
- Engine: PriceOpts.screenColors + shared decoPrice(); email/website quotes are unchanged until they pass per-location colors.
