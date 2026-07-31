# Decisions Log

Short entries on non-obvious calls made in this app, so nobody (including future us)
"fixes" something back without knowing why it's the way it is.

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