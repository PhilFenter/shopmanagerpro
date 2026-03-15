
-- Allow authenticated users to upload files to quote-artwork bucket
CREATE POLICY "Authenticated users can upload artwork"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quote-artwork');

-- Allow authenticated users to delete files from quote-artwork bucket
CREATE POLICY "Authenticated users can delete artwork"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'quote-artwork');

-- Allow authenticated users to update files in quote-artwork bucket
CREATE POLICY "Authenticated users can update artwork"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'quote-artwork');
