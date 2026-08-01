-- Storage RLS policies. Run AFTER the restore (step 3) and after 02-post-restore.sql.
--
-- These are NOT covered by the restore: they live in the `storage` schema, and the
-- restore only brings `public` (plus auth data and storage.buckets). Without them,
-- every signed URL 400s and job photos are invisible in the app.
--
-- Extracted verbatim from the 2026-07-31 dump — this is the live policy state, not a
-- reconstruction from the migration files. 12 policies across 3 buckets.
--
-- `job-photos` being private comes from restoring storage.buckets (its public flag is
-- part of that row), so there is nothing to set here.
--
-- If any statement fails with "must be owner of table objects", run this file from the
-- Supabase dashboard SQL editor instead of over the pooler connection, or recreate the
-- policies through Storage -> Policies in the dashboard.

-- Idempotent: safe to re-run.
DROP POLICY IF EXISTS "Admins can delete job photos"                  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete artwork"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete sop media"      ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read quote-artwork"    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update artwork"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their uploads"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload artwork"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload job photos"     ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload sop media"      ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to quote-artwork" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view job photos"       ON storage.objects;
DROP POLICY IF EXISTS "Public read access for sop media"              ON storage.objects;


-- ── job-photos (private bucket; read via signed URLs) ──────────────────────
CREATE POLICY "Authenticated users can view job photos" ON storage.objects
  FOR SELECT USING (((bucket_id = 'job-photos'::text) AND (auth.uid() IS NOT NULL)));

CREATE POLICY "Authenticated users can upload job photos" ON storage.objects
  FOR INSERT WITH CHECK (((bucket_id = 'job-photos'::text) AND (auth.uid() IS NOT NULL)));

CREATE POLICY "Authenticated users can update their uploads" ON storage.objects
  FOR UPDATE USING (((bucket_id = 'job-photos'::text) AND (auth.uid() IS NOT NULL)));

CREATE POLICY "Admins can delete job photos" ON storage.objects
  FOR DELETE USING (((bucket_id = 'job-photos'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));


-- ── quote-artwork ─────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read quote-artwork" ON storage.objects
  FOR SELECT USING (((bucket_id = 'quote-artwork'::text) AND (auth.uid() IS NOT NULL)));

CREATE POLICY "Authenticated users can upload to quote-artwork" ON storage.objects
  FOR INSERT WITH CHECK (((bucket_id = 'quote-artwork'::text) AND (auth.uid() IS NOT NULL)));

CREATE POLICY "Authenticated users can upload artwork" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'quote-artwork'::text));

CREATE POLICY "Authenticated users can update artwork" ON storage.objects
  FOR UPDATE TO authenticated USING ((bucket_id = 'quote-artwork'::text));

CREATE POLICY "Authenticated users can delete artwork" ON storage.objects
  FOR DELETE TO authenticated USING ((bucket_id = 'quote-artwork'::text));


-- ── sop-media ─────────────────────────────────────────────────────────────
CREATE POLICY "Public read access for sop media" ON storage.objects
  FOR SELECT USING ((bucket_id = 'sop-media'::text));

CREATE POLICY "Authenticated users can upload sop media" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'sop-media'::text));

CREATE POLICY "Authenticated users can delete sop media" ON storage.objects
  FOR DELETE TO authenticated USING ((bucket_id = 'sop-media'::text));


-- Verify: expect 12 rows.
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
