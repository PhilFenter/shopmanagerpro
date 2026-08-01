-- Rewrite absolute storage URLs that embed the OLD project ref.
--
-- Some columns store a full public URL rather than a bucket path, so after the
-- restore they still point at the Lovable backend. Artwork would keep loading
-- from the old project until it is eventually deleted, and then break.
--
-- Replace fzkxeodjkaeqkwqhwcdv before running.
--
-- Measured against the 2026-07-31 export:
--   quote_line_items.image_url  52 of 187 rows contain the old ref   <-- the only real one
--   job_prints.artwork_url       0
--   sops.cover_image_url         0
--   sop_steps.image_url          0
--   sop_steps.video_url          0
--   job_garments.image_url       0  (path-based; the http-prefixed variant is unused so far)
--
-- The other five are included anyway because the app can write absolute URLs into
-- them, and a later export may well have some. Every statement is guarded by a
-- LIKE, so a table with no matches is not touched at all — which also avoids
-- firing updated_at triggers on rows that did not change.
--
-- Not affected, correctly: job_photos.storage_path and job_mockups.storage_path
-- hold bucket paths, not URLs. They need nothing as long as the file copy
-- preserves paths byte-for-byte.


-- ── Preview first ─────────────────────────────────────────────────────────
-- Run this before the updates and note the counts.
SELECT 'quote_line_items.image_url' AS col, count(*) FROM public.quote_line_items WHERE image_url  LIKE '%cwwkkhcpbswvwghxbfgg%'
UNION ALL SELECT 'job_prints.artwork_url',     count(*) FROM public.job_prints      WHERE artwork_url     LIKE '%cwwkkhcpbswvwghxbfgg%'
UNION ALL SELECT 'sops.cover_image_url',       count(*) FROM public.sops            WHERE cover_image_url LIKE '%cwwkkhcpbswvwghxbfgg%'
UNION ALL SELECT 'sop_steps.image_url',        count(*) FROM public.sop_steps       WHERE image_url       LIKE '%cwwkkhcpbswvwghxbfgg%'
UNION ALL SELECT 'sop_steps.video_url',        count(*) FROM public.sop_steps       WHERE video_url       LIKE '%cwwkkhcpbswvwghxbfgg%'
UNION ALL SELECT 'job_garments.image_url',     count(*) FROM public.job_garments    WHERE image_url       LIKE '%cwwkkhcpbswvwghxbfgg%';


-- ── Rewrite ───────────────────────────────────────────────────────────────
UPDATE public.quote_line_items
   SET image_url = replace(image_url, 'cwwkkhcpbswvwghxbfgg', 'fzkxeodjkaeqkwqhwcdv')
 WHERE image_url LIKE '%cwwkkhcpbswvwghxbfgg%';

UPDATE public.job_prints
   SET artwork_url = replace(artwork_url, 'cwwkkhcpbswvwghxbfgg', 'fzkxeodjkaeqkwqhwcdv')
 WHERE artwork_url LIKE '%cwwkkhcpbswvwghxbfgg%';

UPDATE public.sops
   SET cover_image_url = replace(cover_image_url, 'cwwkkhcpbswvwghxbfgg', 'fzkxeodjkaeqkwqhwcdv')
 WHERE cover_image_url LIKE '%cwwkkhcpbswvwghxbfgg%';

UPDATE public.sop_steps
   SET image_url = replace(image_url, 'cwwkkhcpbswvwghxbfgg', 'fzkxeodjkaeqkwqhwcdv')
 WHERE image_url LIKE '%cwwkkhcpbswvwghxbfgg%';

UPDATE public.sop_steps
   SET video_url = replace(video_url, 'cwwkkhcpbswvwghxbfgg', 'fzkxeodjkaeqkwqhwcdv')
 WHERE video_url LIKE '%cwwkkhcpbswvwghxbfgg%';

UPDATE public.job_garments
   SET image_url = replace(image_url, 'cwwkkhcpbswvwghxbfgg', 'fzkxeodjkaeqkwqhwcdv')
 WHERE image_url LIKE '%cwwkkhcpbswvwghxbfgg%';


-- ── Verify: re-run the preview. Every count must now be 0. ────────────────
