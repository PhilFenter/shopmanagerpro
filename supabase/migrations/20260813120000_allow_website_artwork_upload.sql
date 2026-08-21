-- Let the public website upload artwork again.
--
-- hellscanyondesigns.com lets a customer configure an order and attach their
-- artwork, then submits it to create-quote-action-item as a new action item.
-- The file is uploaded straight to this bucket with the anon key, so it is RLS
-- that decides whether it lands.
--
-- Migration 20260628123827 dropped "Allow public uploads to quote-artwork" as a
-- hardening pass, which silently broke that flow on 2026-06-28. Every one of
-- the 25 files in the bucket predates it and came from the website, in the shape
-- <service_type>/<timestamp>-<original name> — e.g.
-- custom_apparel/1778876909796-morale_shirt.png.
--
-- This restores anonymous upload, but only into a single folder level, matching
-- how the site organises submissions. That stops the bucket being used as a
-- general dumping ground with arbitrary nested paths, while needing no update
-- when a new service type is added to the site.
--
-- Note the remaining protections, which is why this is a reasonable trade:
--   * INSERT only — anon has no UPDATE or DELETE policy, so existing artwork
--     cannot be overwritten or removed.
--   * The 100 MB per-file cap from 20260811120000 still applies.
--   * Reads of the bucket are already public by design (public = true), so this
--     grants no new visibility.

DROP POLICY IF EXISTS "Public can upload quote artwork" ON storage.objects;

CREATE POLICY "Public can upload quote artwork"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'quote-artwork'
    -- exactly one folder level: "screen_print/file.png" yes, "a/b/file.png" no,
    -- and a bare "file.png" at the bucket root no.
    AND array_length(storage.foldername(name), 1) = 1
  );

SELECT policyname, cmd, roles
  FROM pg_policies
 WHERE schemaname = 'storage' AND tablename = 'objects'
   AND with_check LIKE '%quote-artwork%'
 ORDER BY policyname;
