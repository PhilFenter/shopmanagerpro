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

---

# Phase 2: garment labels, scan stations, table spots, pickup labels

## How the shop uses it
1. **Approve** the order on InkSoft Imports (same as Phase 1). Approval now creates one record per
   physical piece (a "garment") and one task per decoration on it. Test A: 5 garments, 6 tasks.
2. **Print garment labels** from the order page (Production Board → order → "Print garment labels").
   2×2 Rollo, paper 2 × 2 in, margins None, scale 100%. One label per piece, stuck on a shoulder or
   sleeve away from the press and hoop. The label shows the short code (`1002714-03`), the size, SKU and
   color, the decorations, and the customer's name in small print. The QR holds only a link with a random
   12-character code (`/g/7KQ2M9XHT4PA`). No names or order details are inside the QR.
3. **Scan at the DTF station or embroidery room** after the work is done. The scan completes only that
   station's tasks on that piece. Scanning twice says "Already done". Scanning at the wrong station
   says "Nothing for this station" and lists what the piece still needs. A double-fired scanner or a
   network retry is ignored (each scan has its own id).
4. **Scan at Shipping & Receiving** to put the piece in its spot. A piece with an unfinished decoration is
   refused ("Not finished: Back EMB"). Otherwise, the first piece of an order gets the lowest free spot,
   and later pieces go to the same spot. The screen shows the spot number in large print, plus "3 of 5".
   When the last piece is in, it says "Ready for final check". If an order won't fit, "Add a spot" on the
   order page gives it a second one, and new pieces go to the newest spot.
5. **Final check** on the order page: tick each line (count × size × garment). After that:
   - Pickup orders: print the 4×6 pickup label (name, order number, department name/number only if the
     Orders CSV has them, and a QR). Put it on the mailer, then scan it at Shipping & Receiving. That marks
     the order packed and frees the spot.
   - Ship orders: "Mark shipped" (no carrier or postage integration). That also frees the spot.

Stations log in as ordinary **team** users (one login per station computer is fine). There is no
per-person tracking in v1. Managers can change the number of spots (default 20) on the Production Board.

## Corrections after labels are printed
Reopen the order, fix it, approve again. Pieces are matched by line and size:
- Existing pieces keep their label (same code, same QR).
- Extra quantity → new pieces with the next numbers (`-06`, `-07`). The approval message says how many
  new labels to print, and "Print garment labels" prints only those.
- Less quantity → the extra piece is voided (unlabeled or unassembled pieces first). Its label scans
  as "Do not use" and its tasks no longer block anything.
- An order in review scans as "Hold this". Reopening is blocked once an order is packed or shipped.

## Undo
The scan page has Undo for task completions made on that computer. The order page lets anyone mark a
task done by hand (laser, patches, a missed scan) or undo it, until the piece is in its spot.

## For Drew: applying Phase 2
Run these in order, in the same database as Phase 1:
1. `supabase/migrations/20261025120000_paperless_production_phase1.sql` (if it isn't there yet)
2. `supabase/migrations/20261025180000_paperless_production_phase2.sql`
   - Additive only. It adds new columns to `prod_orders`, five new `prod_*` tables and the new functions,
     and replaces the Phase 1 `prod_approve_order` / `prod_reopen_order`.
   - Orders already approved get their garments filled in automatically.

Check query (should return 5 tables, 1 settings row, 0 missing functions):
```sql
SELECT
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN
     ('prod_garments','prod_tasks','prod_spot_assignments','prod_settings','prod_scans')) AS tables,
  (SELECT count(*) FROM public.prod_settings) AS settings_rows,
  (SELECT count(*) FROM unnest(ARRAY['prod_scan','prod_final_check','prod_mark_shipped','prod_mark_labels_printed',
     'prod_set_task','prod_add_spot','prod_release_spot','prod_set_spot_count']) f
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f)) AS missing_functions;
```

Rollback, newest first: `supabase/rollbacks/20261025180000_paperless_production_phase2.down.sql` (restores
the Phase 1 approve/reopen functions), then the Phase 1 rollback if needed.

Order when going live: **SQL first, then merge, then Lovable Publish.**

## Phase 2 tests
`npx vitest run src/lib/production/db.phase2.test.ts` runs both migrations in PGlite and covers:
garment and task creation, the back-fill, permissions, label printing, station scans and duplicate scans,
assembly refusals, spot assignment and full spots, final check, pack, ship, corrections after printing,
undo, unknown labels, and rollback.
