
-- Create the artwork upload bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-artwork', 'quote-artwork', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload files (quotes are anonymous)
CREATE POLICY "Allow public uploads to quote-artwork"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'quote-artwork');

-- Allow public reads
CREATE POLICY "Allow public reads from quote-artwork"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'quote-artwork');
