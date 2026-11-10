CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- New signups no longer get a role automatically; an admin must approve them.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

DO $$
DECLARE r record; nq text; nc text; s text;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies
           WHERE schemaname='public'
             AND (qual IN ('true','(auth.uid() IS NOT NULL)') OR with_check IN ('true','(auth.uid() IS NOT NULL)'))
             AND NOT ('anon' = ANY(roles))
  LOOP
    s := format('ALTER POLICY %I ON %I.%I TO authenticated', r.policyname, r.schemaname, r.tablename);
    IF r.qual IN ('true','(auth.uid() IS NOT NULL)') THEN s := s || ' USING (public.is_staff(auth.uid()))'; END IF;
    IF r.with_check IN ('true','(auth.uid() IS NOT NULL)') THEN s := s || ' WITH CHECK (public.is_staff(auth.uid()))'; END IF;
    EXECUTE s;
  END LOOP;

  FOR r IN SELECT policyname, qual, with_check FROM pg_policies
           WHERE schemaname='storage' AND policyname NOT IN ('Public read access for sop media')
             AND coalesce(qual,'') NOT LIKE '%has_role%' AND coalesce(qual,'') NOT LIKE '%has_financial_access%'
  LOOP
    s := format('ALTER POLICY %I ON storage.objects TO authenticated', r.policyname);
    IF r.qual IS NOT NULL THEN
      nq := regexp_replace(r.qual, '\(auth\.uid\(\) IS NOT NULL\)', 'public.is_staff(auth.uid())');
      IF nq NOT LIKE '%is_staff%' THEN nq := '(' || nq || ' AND public.is_staff(auth.uid()))'; END IF;
      s := s || ' USING ' || nq;
    END IF;
    IF r.with_check IS NOT NULL THEN
      nc := regexp_replace(r.with_check, '\(auth\.uid\(\) IS NOT NULL\)', 'public.is_staff(auth.uid())');
      IF nc NOT LIKE '%is_staff%' THEN nc := '(' || nc || ' AND public.is_staff(auth.uid()))'; END IF;
      s := s || ' WITH CHECK ' || nc;
    END IF;
    EXECUTE s;
  END LOOP;
END $$;