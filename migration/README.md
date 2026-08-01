# Lovable Cloud → owned Supabase project

Operational runbook. Full reasoning lives in the plan doc; this is the checklist.

The source export is a **pg_dump custom-format archive** (`PGDMP`, dump version 1.16,
zstd, 1205 entries), taken from **PostgreSQL 17.6** on 2026-07-31 19:51 UTC. It contains
the full database: 44 `public` tables with data, the `auth` schema including
`auth.users` **with password hashes**, `storage` metadata, and `cron.job`.

We restore that dump. We do **not** replay the 76 files in `supabase/migrations/` —
they contain hardcoded-UUID seed data that would collide, `cron.unschedule(1)` calls
that fail on a fresh project, and `current_setting('app.settings.*')` GUCs that only
existed on Lovable. Those files stay as history.

## Prerequisites

- [x] PostgreSQL client tools ≥ 17 (installed: 18.4 via scoop, at
      `C:\Users\Drew\scoop\apps\postgresql\current\bin`)
- [ ] New Supabase project on **PG 17 or newer** (must be ≥ 17.6 source)
- [ ] `pg_cron` and `pg_net` extensions enabled on it
- [ ] Session-pooler connection string (port **5432**, not 6543)

## Order of operations

| # | Step | File |
|---|---|---|
| 1 | Restore auth.users → auth.identities → public → storage.buckets | `01-restore.ps1` |
| 2 | **Grants**, signup trigger, repoint trigger URLs, quote sequence | `02-post-restore.sql` |
| 3 | Storage RLS policies (12, taken verbatim from the dump) | `05-storage-policies.sql` |
| 4 | Copy the actual bucket files | `04-copy-storage.mjs` |
| 5 | Rewrite absolute URLs holding the old project ref | `06-rewrite-urls.sql` |
| 6 | Close the anon RLS holes | `../supabase/migrations/20260730120000_close_anon_rls_holes.sql` |
| 7 | Recreate the 7 scheduled jobs | `03-cron.sql` |
| 8 | Deploy edge functions, set secrets, flip env vars | below |

Ordering constraints that matter:
- Step 2 before step 6 — step 2 blanket-grants EXECUTE on public functions, and step 6
  revokes it again for `get_team_members_safe`.
- Step 3 before step 4 — uploads need the policies in place.
- Step 6 also sets the `quote-artwork` bucket's size/MIME limits, so the bucket must
  exist by then (it does, from step 1).

`storage.objects` is deliberately **not** restored. Nothing in `public` references it,
and step 4 recreates each row as it uploads; restoring the rows first would make every
upload fail as a duplicate.

**Step 2 is not optional.** The restore runs `--no-acl` because the dump's grants
reference Lovable-only roles. Without step 2 every table has zero privileges for
`anon`/`authenticated` and the app returns "permission denied for table X" on every
query, with RLS policies that look perfectly correct. Grants and RLS are separate
layers; both must pass.

## Step 6 — config cutover

- `.env`: all three `VITE_` vars → new project
- `supabase/config.toml:1`: `project_id` → new ref
- Same three env vars in Lovable, so the hosted build points at the new backend
- `supabase functions deploy` for all 33 functions (`config.toml` carries the 12
  `verify_jwt = false` entries)
- Re-enter **22 third-party secrets**: Resend, Stripe, Twilio ×3, Printavo ×2,
  Shopify ×2, SanMar ×3, S&S ×2, Dropbox ×4, InkSoft, VAPID ×3,
  `NEW_QUOTE_ALERT_EMAIL`, `LOVABLE_API_KEY`
- Vault secrets for cron: `project_url`, `service_role_key` (see `03-cron.sql`)
- Auth → URL Configuration: Site URL + redirect allowlist for the production origin
- **VAPID**: reuse the existing keypair if the values can be read out of Lovable.
  `src/lib/push.ts:3` hardcodes the public key; if it changes, every row in
  `push_subscriptions` is dead and users must re-subscribe.
- **`LOVABLE_API_KEY`**: `ai-draft-knowledge`, `ai-draft-message`, `ai-draft-standard`
  and `voice-recipe-parse` call `ai.gateway.lovable.dev`. Verify it still works from
  the new project rather than assuming.
- Replace the three hardcoded `https://shopmanagerpro.lovable.app` constants
  (`create-quote-checkout:68`, `send-quote-email:117`, `notify-new-action-item:36`)

## Verification

1. Row counts per table, old vs new, all 44 tables
2. Log in as an existing user **with their current password**
3. An admin still has `admin` in `user_roles` and can see Financials — a lost role
   looks identical to a grants failure
4. Open a job with photos, a quote with artwork, an SOP with media (proves step 5)
5. Create a job, a quote, and a handoff (exercises the sequence, fanout triggers, push)
6. Incognito + anon key: `job_line_items` returns `[]` (proves step 3)
7. `SELECT internal.call_edge_function('printavo-quote-import');` returns a request id,
   not NULL, then check `net._http_response` for a 200
8. Diff the restored schema against `src/integrations/supabase/types.ts`, which was
   generated from the live database

## Execution shape

Dry run into a throwaway project first. Then at real cutover: freeze data entry, take
a **fresh** export, re-run the proven steps, flip env vars. The 2026-07-31 file is a
rehearsal artifact — anything entered after 12:53 that day is not in it.

## Working files

The extracted dump and TOC are in the session scratchpad, **not** this repo — they
contain customer PII and password hashes:
`%LOCALAPPDATA%\Temp\claude\c--Loveable-shopmanagerpro\<session>\scratchpad\migration\`
