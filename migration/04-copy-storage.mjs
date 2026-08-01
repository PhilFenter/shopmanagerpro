/**
 * Copy storage bucket contents from the old project to the new one.
 *
 * The pg_dump carries storage.buckets and storage.objects ROWS, but the actual
 * files live in S3, not Postgres. Without this step every artwork thumbnail,
 * production photo, and SOP video is a broken link, even though the database
 * looks complete.
 *
 * Paths are preserved exactly, so the restored storage.objects rows and the
 * image_url / file_path columns in public tables keep resolving.
 *
 * AUTH, and why the two sides differ:
 *
 *   OLD project — sign in with an admin EMAIL + PASSWORD. Its service-role key is
 *   not obtainable: Lovable Cloud gives no dashboard and does not list it in the
 *   secrets tab. That is fine, because `job-photos` (the only private bucket) has
 *   the SELECT policy `bucket_id = 'job-photos' AND auth.uid() IS NOT NULL`, so
 *   any signed-in user can read every file in it.
 *
 *   NEW project — use the service-role key from its dashboard, so uploads bypass
 *   RLS and are not affected by policy ordering.
 *
 * Usage:
 *   npm i @supabase/supabase-js       (or: bun add @supabase/supabase-js)
 *
 *   OLD_URL=https://<old>.supabase.co \
 *   OLD_ANON_KEY=<old anon key from .env> \
 *   OLD_EMAIL=you@example.com OLD_PASSWORD='...' \
 *   NEW_URL=https://<new>.supabase.co NEW_SERVICE_KEY=... \
 *   node migration/04-copy-storage.mjs
 *
 * Pass all of these as environment variables; never hardcode them.
 * Safe to re-run: existing objects are skipped unless OVERWRITE=1.
 */

import { createClient } from "@supabase/supabase-js";

const {
  OLD_URL, OLD_ANON_KEY, OLD_EMAIL, OLD_PASSWORD,
  NEW_URL, NEW_SERVICE_KEY,
  OVERWRITE,
} = process.env;

for (const [name, value] of Object.entries({
  OLD_URL, OLD_ANON_KEY, OLD_EMAIL, OLD_PASSWORD, NEW_URL, NEW_SERVICE_KEY,
})) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

const oldDb = createClient(OLD_URL, OLD_ANON_KEY, { auth: { persistSession: false } });
const newDb = createClient(NEW_URL, NEW_SERVICE_KEY, { auth: { persistSession: false } });

const { data: session, error: signInError } = await oldDb.auth.signInWithPassword({
  email: OLD_EMAIL,
  password: OLD_PASSWORD,
});

if (signInError || !session?.user) {
  console.error(`Could not sign in to the old project: ${signInError?.message ?? "no session"}`);
  process.exit(1);
}
console.log(`Signed in to old project as ${session.user.email}`);

const BUCKETS = ["job-photos", "quote-artwork", "sop-media"];
const PAGE = 100;

/** Storage list() is per-prefix and not recursive, so walk the tree. */
async function listAllPaths(client, bucket, prefix = "") {
  const found = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });

    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A row with no id is a folder placeholder, not a file.
      if (entry.id === null) found.push(...(await listAllPaths(client, bucket, path)));
      else found.push({ path, size: entry.metadata?.size ?? 0, mime: entry.metadata?.mimetype });
    }

    if (data.length < PAGE) break;
  }
  return found;
}

let totalCopied = 0, totalSkipped = 0, totalBytes = 0;
const failures = [];

for (const bucket of BUCKETS) {
  console.log(`\n=== ${bucket} ===`);

  const files = await listAllPaths(oldDb, bucket);
  console.log(`  ${files.length} file(s) in source`);

  // Ensure the bucket exists on the target. The restore of storage.buckets
  // normally creates it; this is a no-op safety net for a fresh project.
  const { data: existing } = await newDb.storage.getBucket(bucket);
  if (!existing) {
    console.log(`  bucket missing on target — creating`);
    const { error } = await newDb.storage.createBucket(bucket, { public: bucket !== "job-photos" });
    if (error) console.warn(`  createBucket: ${error.message}`);
  }

  let done = 0;
  for (const file of files) {
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${files.length}...`);

    if (!OVERWRITE) {
      const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
      const base = file.path.slice(file.path.lastIndexOf("/") + 1);
      const { data: hit } = await newDb.storage.from(bucket).list(dir, { limit: 1, search: base });
      if (hit && hit.length > 0) { totalSkipped++; continue; }
    }

    const { data: blob, error: dlError } = await oldDb.storage.from(bucket).download(file.path);
    if (dlError) { failures.push(`${bucket}/${file.path}: download ${dlError.message}`); continue; }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const { error: upError } = await newDb.storage.from(bucket).upload(file.path, buffer, {
      contentType: file.mime || blob.type || "application/octet-stream",
      upsert: Boolean(OVERWRITE),
    });

    if (upError) { failures.push(`${bucket}/${file.path}: upload ${upError.message}`); continue; }

    totalCopied++;
    totalBytes += buffer.length;
  }
}

console.log(`\n──────────────────────────────────────`);
console.log(`copied  ${totalCopied}`);
console.log(`skipped ${totalSkipped} (already present; set OVERWRITE=1 to force)`);
console.log(`bytes   ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures.slice(0, 40)) console.log(`  ${f}`);
  if (failures.length > 40) console.log(`  ...and ${failures.length - 40} more`);
  process.exitCode = 1;
} else {
  console.log(`\nNo failures.`);
}

console.log(`
Verify in the app, not just here: open a job with production photos, a quote
with artwork, and an SOP with media. A file count match does not prove the
paths line up with what the database rows expect.`);
