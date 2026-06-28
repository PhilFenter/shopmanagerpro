
-- action_items: scope DELETE to creator or admin
DROP POLICY IF EXISTS "Authenticated users can delete action items" ON public.action_items;
CREATE POLICY "Creators or admins can delete action items"
  ON public.action_items FOR DELETE
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));

-- business_settings: remove broad team read
DROP POLICY IF EXISTS "Team can view non-sensitive settings" ON public.business_settings;
CREATE POLICY "Financial roles can view business settings"
  ON public.business_settings FOR SELECT
  USING (public.has_financial_access(auth.uid()));

-- customers: restrict writes to financial roles
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;
CREATE POLICY "Financial roles can update customers"
  ON public.customers FOR UPDATE
  USING (public.has_financial_access(auth.uid()))
  WITH CHECK (public.has_financial_access(auth.uid()));
CREATE POLICY "Admins can delete customers"
  ON public.customers FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- jobs: replace true with authenticated check
DROP POLICY IF EXISTS "Authenticated users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can view all jobs" ON public.jobs;
CREATE POLICY "Authenticated users can view jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- job_garments: replace true
DROP POLICY IF EXISTS "Authenticated users can create job garments" ON public.job_garments;
DROP POLICY IF EXISTS "Authenticated users can update job garments" ON public.job_garments;
CREATE POLICY "Authenticated users can create job garments"
  ON public.job_garments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update job garments"
  ON public.job_garments FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- job_line_items: replace true
DROP POLICY IF EXISTS "Authenticated users can view job line items" ON public.job_line_items;
DROP POLICY IF EXISTS "Authenticated users can create job line items" ON public.job_line_items;
DROP POLICY IF EXISTS "Authenticated users can update job line items" ON public.job_line_items;
CREATE POLICY "Authenticated users can view job line items"
  ON public.job_line_items FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create job line items"
  ON public.job_line_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update job line items"
  ON public.job_line_items FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- workers: drop broad team SELECT, keep manager SELECT
DROP POLICY IF EXISTS "Team members can view workers" ON public.workers;

-- quotes: restrict update to financial roles
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON public.quotes;
CREATE POLICY "Financial roles can update quotes"
  ON public.quotes FOR UPDATE
  USING (public.has_financial_access(auth.uid()))
  WITH CHECK (public.has_financial_access(auth.uid()));

-- quote-artwork storage: require auth for INSERT and SELECT (CDN reads bypass RLS)
DROP POLICY IF EXISTS "Allow public uploads to quote-artwork" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from quote-artwork" ON storage.objects;
CREATE POLICY "Authenticated users can upload to quote-artwork"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'quote-artwork' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read quote-artwork"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quote-artwork' AND auth.uid() IS NOT NULL);

-- realtime.messages: require authenticated to subscribe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Authenticated can use realtime" ON realtime.messages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- Revoke EXECUTE on internal SECURITY DEFINER trigger/helper functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.fanout_handoff_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fanout_handoff_new() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fanout_handoff_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_push_send() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_team_members_safe() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_financial_access(uuid) FROM PUBLIC, anon;
