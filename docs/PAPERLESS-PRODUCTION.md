# Paperless Production: Phase 1 (InkSoft import, review, DTF transfer list)

Branch: `feature/paperless-production`. Nothing here is merged or live yet.

## What it does
- **InkSoft Imports** (`/production/imports`, admin/manager): upload the InkSoft work-order PDF, and
  optionally the Orders CSV. The PDF is read in the browser with pdf.js, so there's no AI or server
  cost. The original file is kept as-is in the private `production-imports` bucket.
- **Review** (`/production/imports/:batchId`): every order starts in review. Missing pages, totals
  that don't add up, cut-off SKUs, missing embroidery thread or size info, and missing artwork are
  flagged. Red flags block approval; amber flags are things to check. Managers can fix
  quantities and colors, set pickup or ship, change the production method (a reason is required), and approve.
- **DTF Transfers** (`/production/transfers`, everyone): transfers needed for approved orders,
  grouped by design + colorway + location, with orders and garment sizes. Tick a line when it's
  printed. `/print/transfers` gives a paper copy.

Not in this phase: labels, QR codes, scanning, bins, pickup labels, and purchasing.

## Store rules
`prod_method_rules`: InkSoft `Embroidery`→Embroidery, `DigitalPrint`→DTF and `ScreenPrint`→DTF.
InkSoft's method is always stored as written. The production method is shown next to it, along with the reason.

## Duplicates
- Same file uploaded again (same sha256): opens the earlier import and creates nothing.
- Same order in a different file, with the same content: marked "Already imported, no changes".
- Same order with different content:
  - If it's still in review, it's updated, logged, and goes back to review.
  - If it's already approved, nothing changes. The newer copy waits until a manager clicks
    "Use newer copy" or "Keep current".

## For Drew: applying the migration
Apply it to a **staging/branch database first**, not production, until Phil says go.

1. `supabase/migrations/20261025120000_paperless_production_phase1.sql`
   - Additive only: new `prod_*` tables and functions, one private bucket, and three seeded rules.
   - It doesn't touch any existing table, function, or policy.
   - It uses the existing `has_role(uuid, app_role)`.
2. Regenerate types if you want to (`supabase gen types typescript …`). The module works without it,
   because it uses an untyped client for `prod_*`.
3. Rollback: `supabase/rollbacks/20261025120000_paperless_production_phase1.down.sql`. It drops the
   `prod_*` tables, the functions and the two storage policies. On purpose, it leaves the
   `production-imports` bucket and the original files in place. Delete those by hand only if you're sure.

**Order matters when this goes live:** migration first, then merge, then Lovable Publish. If the UI is
published without the migration, the new pages show errors. Existing pages aren't affected.

## Tests
- `npx vitest run src/lib/production`
  - Parser tests against anonymized fixtures: Test A (1 order, 5 garments, 6 decorations, 5 labels),
    Test B (5 / 10 / 15 / 10) and the 3-order file.
  - The database tests run the real migration in PGlite (in-memory Postgres). They cover
    permissions, duplicate uploads, approval blockers, revisions and rollback.
- `npx vite-node scripts/dump-workorder.ts <file.pdf>` prints what the parser reads from a PDF.

## Dependencies added
- `pdfjs-dist` 4.10.38 (runtime; loaded only on the import page).
- `@electric-sql/pglite` 0.2.17 (dev only, for the database tests).
