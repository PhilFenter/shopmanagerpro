-- Staff-only access: new sign-ups wait for an admin.
--
-- Problem: anyone can create an account on the login page, and handle_new_user()
-- gave every new account the Team role. On top of that, 71 table policies and 13
-- storage policies only checked "is signed in". So a stranger who signed up could
-- read and edit jobs, customers, quotes and files.
--
-- Fix:
--   1. New accounts get no role. An admin approves them in Team > Logins & Access.
--      The app already signs out anyone with no role and tells them to ask an admin.
--   2. public.is_staff(uid) is true when the user has any role (team, manager, admin).
--   3. Every public-schema policy whose only test is "signed in" (`true` or
--      `auth.uid() IS NOT NULL`) now requires is_staff instead.
--   4. The 13 storage policies that only checked "signed in" now require is_staff.
--      Left alone on purpose: "Public can upload quote artwork" (the website's
--      anonymous artwork upload), "Public read access for sop media", and the
--      policies that already check a role.
--
-- Same intent as Lovable's drizzle/migrations/0000_staff_only_policies.sql, which
-- ran only against the old Lovable Cloud database. That version also locks the
-- website's anonymous artwork upload, so do not apply it here.
--
-- Tests: src/lib/db/staffOnlyAccess.test.ts
-- Rollback: supabase/rollbacks/20261111180000_staff_only_access.down.sql

-- 1. Who counts as staff ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- 2. New sign-ups get a profile but no role ----------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  -- No role row: an admin grants access in Team > Logins & Access.
  RETURN NEW;
END;
$$;

-- 3. Table policies: "signed in" becomes "staff" ------------------------------
DO $$
DECLARE
  r record;
  s text;
  n int := 0;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual IN ('true', '(auth.uid() IS NOT NULL)') OR with_check IN ('true', '(auth.uid() IS NOT NULL)'))
      AND NOT ('anon' = ANY (roles))
  LOOP
    s := format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
    IF r.qual IN ('true', '(auth.uid() IS NOT NULL)') THEN
      s := s || ' USING ((SELECT public.is_staff(auth.uid())))';
    END IF;
    IF r.with_check IN ('true', '(auth.uid() IS NOT NULL)') THEN
      s := s || ' WITH CHECK ((SELECT public.is_staff(auth.uid())))';
    END IF;
    EXECUTE s;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'staff_only_access: % table policies now require staff', n;
END $$;

-- 4. Storage policies that only checked "signed in" ---------------------------
ALTER POLICY "Authenticated users can read quote-artwork" ON storage.objects TO authenticated
  USING (bucket_id = 'quote-artwork' AND (SELECT public.is_staff(auth.uid())));
ALTER POLICY "Authenticated users can upload artwork" ON storage.objects TO authenticated
  WITH CHECK (bucket_id = 'quote-artwork' AND (SELECT public.is_staff(auth.uid())));
ALTER POLICY "Authenticated users can upload to quote-artwork" ON storage.objects TO authenticated
  WITH CHECK (bucket_id = 'quote-artwork' AND (SELECT public.is_staff(auth.uid())));
ALTER POLICY "Authenticated users can update artwork" ON storage.objects TO authenticated
  USING (bucket_id = 'quote-artwork' AND (SELECT public.is_staff(auth.uid())));
ALTER POLICY "Authenticated users can delete artwork" ON storage.objects TO authenticated
  USING (bucket_id = 'quote-artwork' AND (SELECT public.is_staff(auth.uid())));

ALTER POLICY "Authenticated users can view job photos" ON storage.objects TO authenticated
  USING (bucket_id = 'job-photos' AND (SELECT public.is_staff(auth.uid())));
ALTER POLICY "Authenticated users can upload job photos" ON storage.objects TO authenticated
  WITH CHECK (bucket_id = 'job-photos' AND (SELECT public.is_staff(auth.uid())));
ALTER POLICY "Authenticated users can update their uploads" ON storage.objects TO authenticated
  USING (bucket_id = 'job-photos' AND (SELECT public.is_staff(auth.uid())));

ALTER POLICY "Authenticated users can upload sop media" ON storage.objects TO authenticated
  WITH CHECK (bucket_id = 'sop-media' AND (SELECT public.is_staff(auth.uid())));
ALTER POLICY "Authenticated users can delete sop media" ON storage.objects TO authenticated
  USING (bucket_id = 'sop-media' AND (SELECT public.is_staff(auth.uid())));

ALTER POLICY "Signed-in users can read production files" ON storage.objects TO authenticated
  USING (bucket_id = 'production-files' AND (SELECT public.is_staff(auth.uid())));
ALTER POLICY "Signed-in users can upload production files" ON storage.objects TO authenticated
  WITH CHECK (bucket_id = 'production-files' AND (SELECT public.is_staff(auth.uid())));
ALTER POLICY "Signed-in users can update production files" ON storage.objects TO authenticated
  USING (bucket_id = 'production-files' AND (SELECT public.is_staff(auth.uid())));

-- 5. Refuse to finish if anything still lets any signed-in user through ------
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual IN ('true', '(auth.uid() IS NOT NULL)') OR with_check IN ('true', '(auth.uid() IS NOT NULL)'))
    AND NOT ('anon' = ANY (roles));
  IF remaining > 0 THEN
    RAISE EXCEPTION 'staff_only_access: % table policies still allow any signed-in user', remaining;
  END IF;

  -- Every storage policy must check a role, except the two that are public on purpose.
  SELECT count(*) INTO remaining
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND NOT ('anon' = ANY (roles))
    AND policyname <> 'Public read access for sop media'
    AND coalesce(qual, '') || ' ' || coalesce(with_check, '')
        !~ '(is_staff|has_role|has_financial_access|prod_is_staff|prod_is_manager)\(';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'staff_only_access: % storage policies still allow any signed-in user', remaining;
  END IF;
END $$;
