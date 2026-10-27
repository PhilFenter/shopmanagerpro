-- Rollback for 20261025120000_paperless_production_phase1.sql
-- Drops ONLY the prod_* objects and the production-imports policies it created.
-- The storage bucket and its files are left in place on purpose (originals are preserved);
-- delete them by hand in the Supabase dashboard if you really want them gone.
BEGIN;
DROP POLICY IF EXISTS "production-imports staff read" ON storage.objects;
DROP POLICY IF EXISTS "production-imports manager upload" ON storage.objects;

DROP TABLE IF EXISTS public.prod_events CASCADE;
DROP TABLE IF EXISTS public.prod_item_decorations CASCADE;
DROP TABLE IF EXISTS public.prod_item_sizes CASCADE;
DROP TABLE IF EXISTS public.prod_order_items CASCADE;
DROP TABLE IF EXISTS public.prod_order_sources CASCADE;
DROP TABLE IF EXISTS public.prod_artwork_previews CASCADE;
DROP TABLE IF EXISTS public.prod_orders CASCADE;
DROP TABLE IF EXISTS public.prod_import_batches CASCADE;
DROP TABLE IF EXISTS public.prod_method_rules CASCADE;

DO $$
DECLARE f text;
BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname LIKE 'prod\_%'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', f);
  END LOOP;
END $$;
COMMIT;
