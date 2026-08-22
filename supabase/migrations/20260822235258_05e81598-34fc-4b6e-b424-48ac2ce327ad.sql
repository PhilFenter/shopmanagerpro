CREATE POLICY "Signed-in users can upload production files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'production-files');

CREATE POLICY "Signed-in users can read production files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'production-files');

CREATE POLICY "Signed-in users can update production files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'production-files');

CREATE POLICY "Admins can delete production files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'production-files' AND public.has_financial_access(auth.uid()));