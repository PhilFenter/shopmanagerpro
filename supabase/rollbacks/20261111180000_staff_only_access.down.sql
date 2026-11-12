-- Rollback for supabase/migrations/20261111180000_staff_only_access.sql
--
-- Puts back "any signed-in user" access and the automatic Team role for new
-- sign-ups. Only run this if staff-only access is breaking something you can't
-- fix forward: it reopens the hole where anyone who signs up can read shop data.
--
-- Table policies go back to TO authenticated USING (auth.uid() IS NOT NULL).
-- Some were originally TO public with the same expression; for a signed-out
-- visitor the two behave identically, because auth.uid() is null.

-- 1. New sign-ups get Team again
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'team'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Table policies back to "signed in"
DO $$
DECLARE
  r record;
  s text;
  staff text := '^\(\s*SELECT\s+(public\.)?is_staff\(auth\.uid\(\)\)\s+AS\s+is_staff\)$';
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND (qual ~ staff OR with_check ~ staff)
  LOOP
    s := format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
    IF r.qual ~ staff THEN s := s || ' USING (auth.uid() IS NOT NULL)'; END IF;
    IF r.with_check ~ staff THEN s := s || ' WITH CHECK (auth.uid() IS NOT NULL)'; END IF;
    EXECUTE s;
  END LOOP;
END $$;

-- 3. Storage policies back to their original definitions
ALTER POLICY "Authenticated users can read quote-artwork" ON storage.objects TO public
  USING (bucket_id = 'quote-artwork' AND auth.uid() IS NOT NULL);
ALTER POLICY "Authenticated users can upload artwork" ON storage.objects TO authenticated
  WITH CHECK (bucket_id = 'quote-artwork');
ALTER POLICY "Authenticated users can upload to quote-artwork" ON storage.objects TO public
  WITH CHECK (bucket_id = 'quote-artwork' AND auth.uid() IS NOT NULL);
ALTER POLICY "Authenticated users can update artwork" ON storage.objects TO authenticated
  USING (bucket_id = 'quote-artwork');
ALTER POLICY "Authenticated users can delete artwork" ON storage.objects TO authenticated
  USING (bucket_id = 'quote-artwork');

ALTER POLICY "Authenticated users can view job photos" ON storage.objects TO public
  USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);
ALTER POLICY "Authenticated users can upload job photos" ON storage.objects TO public
  WITH CHECK (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);
ALTER POLICY "Authenticated users can update their uploads" ON storage.objects TO public
  USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

ALTER POLICY "Authenticated users can upload sop media" ON storage.objects TO authenticated
  WITH CHECK (bucket_id = 'sop-media');
ALTER POLICY "Authenticated users can delete sop media" ON storage.objects TO authenticated
  USING (bucket_id = 'sop-media');

ALTER POLICY "Signed-in users can read production files" ON storage.objects TO authenticated
  USING (bucket_id = 'production-files');
ALTER POLICY "Signed-in users can upload production files" ON storage.objects TO authenticated
  WITH CHECK (bucket_id = 'production-files');
ALTER POLICY "Signed-in users can update production files" ON storage.objects TO authenticated
  USING (bucket_id = 'production-files');

-- 4. Nothing uses is_staff any more. This fails, on purpose, if something still does.
DROP FUNCTION public.is_staff(uuid);
