
-- Create a public storage bucket for SOP media (photos & videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sop-media', 'sop-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to sop-media
CREATE POLICY "Authenticated users can upload sop media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sop-media');

-- Allow anyone to view sop-media (public bucket)
CREATE POLICY "Public read access for sop media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'sop-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete sop media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sop-media');
