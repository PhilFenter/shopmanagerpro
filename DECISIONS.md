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
