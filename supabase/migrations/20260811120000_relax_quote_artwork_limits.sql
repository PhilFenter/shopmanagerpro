-- Remove the MIME allowlist on quote-artwork and raise the size cap to 100 MB.
--
-- The allowlist was added in 20260730120000 to stop the bucket being used as
-- anonymous file hosting. It was the wrong control for this app:
--
--   * It rejected formats a print shop genuinely receives. Verified against the
--     live bucket: image/heic (every iPhone photo), image/tiff, and
--     application/octet-stream (what browsers report for many .ai and .cdr
--     files) all came back 415 "mime type is not supported".
--   * Artwork upload had been dead since it was applied — zero new objects in
--     quote-artwork, while job-photos, which has no restriction, kept working.
--   * The abuse it guarded against is already prevented elsewhere: the anon
--     INSERT policy on this bucket was dropped in 20260628123827, so only
--     signed-in staff can upload at all.
--
-- The 100 MB cap stays as a guard against a runaway upload.

UPDATE storage.buckets
   SET allowed_mime_types = NULL,
       file_size_limit    = 104857600  -- 100 MB
 WHERE id = 'quote-artwork';

SELECT id, public, file_size_limit, allowed_mime_types
  FROM storage.buckets
 WHERE id = 'quote-artwork';
