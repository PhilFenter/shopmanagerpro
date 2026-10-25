-- Paperless Production, Phase 1: InkSoft work-order import, review, approval, DTF transfer list.
--
-- Additive only: new prod_* tables, functions, and one private storage bucket.
-- No existing table, function, or policy is changed. Rollback:
--   supabase/rollbacks/20261025120000_paperless_production_phase1.down.sql
--
-- Security model:
--   * RLS on every table. Any signed-in user with a role (admin/manager/team) can READ.
--   * There are no INSERT/UPDATE/DELETE policies. All writes go through the SECURITY DEFINER
--     functions below, which check the role, enforce the rules, and write prod_events.
--   * Import, edit, and approval need admin or manager. Marking transfers printed needs any role.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prod_is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.prod_is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager');
$$;

CREATE OR REPLACE FUNCTION public.prod__require_manager()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.prod_is_manager() THEN
    RAISE EXCEPTION 'Only a manager or admin can do this' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prod__require_staff()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.prod_is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.prod_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_sha256 text NOT NULL UNIQUE,
  page_count int,
  csv_file_name text,
  csv_storage_path text,
  csv_sha256 text,
  parser_version text,
  printed_at text,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsed', 'failed')),
  parse_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb,
  error text,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.prod_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'inksoft',
  order_number text NOT NULL,
  store_name text,
  customer_name text,
  customer_email text,
  fulfillment text NOT NULL DEFAULT 'unknown' CHECK (fulfillment IN ('pickup', 'ship', 'unknown')),
  pickup_location text,
  shipping_method text,
  checkout_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  csv_item_count int,
  order_date date,
  due_date date,
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('review', 'approved', 'on_hold', 'cancelled')),
  current_revision int NOT NULL DEFAULT 1,
  approved_revision int,
  approved_by uuid,
  approved_at timestamptz,
  pending_revision int,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  flags_ack_by uuid,
  flags_ack_at timestamptz,
  flags_ack_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, order_number)
);

-- Every time an order appeared in an upload. extracted = the order exactly as the parser read it.
CREATE TABLE public.prod_order_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.prod_orders(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.prod_import_batches(id) ON DELETE CASCADE,
  revision int NOT NULL,
  pages int[] NOT NULL DEFAULT '{}',
  content_sha256 text NOT NULL,
  extracted jsonb NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('new', 'unchanged', 'updated', 'pending', 'applied', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, batch_id)
);

-- One per InkSoft product block ("Item N of M"): style + color + design.
CREATE TABLE public.prod_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.prod_orders(id) ON DELETE CASCADE,
  item_index int,
  item_of int,
  page int,
  mfg_sku text,
  inksoft_sku text,
  color text,
  product_name text,
  design_name text,
  design_id text,
  truncated text[] NOT NULL DEFAULT '{}',
  mockup_hash text,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_values jsonb,
  edited_by uuid,
  edited_at timestamptz
);
CREATE INDEX prod_order_items_order_idx ON public.prod_order_items(order_id);

CREATE TABLE public.prod_item_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.prod_order_items(id) ON DELETE CASCADE,
  seq int NOT NULL,
  size text NOT NULL,
  quantity int CHECK (quantity IS NULL OR quantity >= 0),
  source_quantity int,
  edited_by uuid,
  edited_at timestamptz,
  UNIQUE (item_id, seq)
);

CREATE TABLE public.prod_item_decorations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.prod_order_items(id) ON DELETE CASCADE,
  seq int NOT NULL,
  location text,
  method_inksoft text,          -- verbatim from InkSoft, never edited
  method_production text CHECK (method_production IS NULL OR method_production IN
    ('embroidery', 'dtf', 'screen_print', 'laser', 'leather_patch', 'other')),
  method_source text CHECK (method_source IS NULL OR method_source IN ('rule', 'staff')),
  override_reason text,
  override_by uuid,
  override_at timestamptz,
  colorway text,
  color_count text,
  width_in numeric,
  height_in numeric,
  thread_colors text[] NOT NULL DEFAULT '{}',
  artwork_hash text,
  mockup_hash text,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_values jsonb,
  transfer_printed_at timestamptz,
  transfer_printed_by uuid,
  edited_by uuid,
  edited_at timestamptz,
  UNIQUE (item_id, seq)
);

-- Low-resolution previews pulled from the PDF. Never production art (enforced).
CREATE TABLE public.prod_artwork_previews (
  hash text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('artwork', 'mockup')),
  storage_path text NOT NULL,
  width_px int,
  height_px int,
  first_batch_id uuid REFERENCES public.prod_import_batches(id) ON DELETE SET NULL,
  production_ready boolean NOT NULL DEFAULT false CHECK (production_ready = false),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- InkSoft method -> in-house production method. store_name NULL = every store.
CREATE TABLE public.prod_method_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text,
  method_inksoft text NOT NULL,
  method_production text NOT NULL CHECK (method_production IN
    ('embroidery', 'dtf', 'screen_print', 'laser', 'leather_patch', 'other')),
  note text,
  approved_by_name text,
  approved_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX prod_method_rules_unique
  ON public.prod_method_rules (coalesce(lower(store_name), ''), lower(method_inksoft)) WHERE active;

-- Append-only audit log.
CREATE TABLE public.prod_events (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  order_id uuid,
  batch_id uuid,
  item_id uuid,
  action text NOT NULL,
  details jsonb
);
CREATE INDEX prod_events_order_idx ON public.prod_events(order_id, at);

-- Rules confirmed by Phil on Oct 25 2026.
INSERT INTO public.prod_method_rules (store_name, method_inksoft, method_production, note, approved_by_name, approved_at) VALUES
  (NULL, 'Embroidery',   'embroidery', 'InkSoft embroidery', 'Phil (Oct 25 2026)', '2026-10-25'),
  (NULL, 'DigitalPrint', 'dtf',        'InkSoft DigitalPrint is DTF at HCD', 'Phil (Oct 25 2026)', '2026-10-25'),
  (NULL, 'ScreenPrint',  'dtf',        'Store orders marked ScreenPrint are produced as DTF', 'Phil (Oct 25 2026)', '2026-10-25');

-- ---------------------------------------------------------------------------
-- RLS: read for staff, no direct writes
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prod_import_batches','prod_orders','prod_order_sources','prod_order_items',
                           'prod_item_sizes','prod_item_decorations','prod_artwork_previews',
                           'prod_method_rules','prod_events']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.prod_is_staff())',
                   t || '_staff_read', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public.prod_events_id_seq FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for the original PDFs/CSVs and preview images
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('production-imports', 'production-imports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "production-imports staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'production-imports' AND public.prod_is_staff());
-- Upload only; objects are never overwritten or deleted from the app (originals are preserved).
CREATE POLICY "production-imports manager upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'production-imports' AND public.prod_is_manager());

-- ---------------------------------------------------------------------------
-- Internal: write an order's items from a normalized payload
-- payload.items[] = { item_index, item_of, page, mfg_sku, inksoft_sku, color, product_name,
--   design_name, design_id, truncated[], mockup_hash, flags,
--   sizes[] = { size, quantity },
--   decorations[] = { location, method_inksoft, method_production, method_source, colorway,
--     color_count, width_in, height_in, thread_colors[], artwork_hash, mockup_hash, flags } }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prod__write_items(p_order_id uuid, p_order jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it jsonb; sz jsonb; dc jsonb; v_item uuid; i int; j int;
BEGIN
  DELETE FROM public.prod_order_items WHERE order_id = p_order_id;
  FOR it, i IN SELECT e, o FROM jsonb_array_elements(coalesce(p_order->'items', '[]')) WITH ORDINALITY AS x(e, o) LOOP
    INSERT INTO public.prod_order_items (order_id, item_index, item_of, page, mfg_sku, inksoft_sku, color,
      product_name, design_name, design_id, truncated, mockup_hash, flags, source_values)
    VALUES (p_order_id,
      coalesce((it->>'item_index')::int, i::int), (it->>'item_of')::int, (it->>'page')::int,
      it->>'mfg_sku', it->>'inksoft_sku', it->>'color', it->>'product_name', it->>'design_name', it->>'design_id',
      coalesce(ARRAY(SELECT jsonb_array_elements_text(it->'truncated')), '{}'),
      it->>'mockup_hash', coalesce(it->'flags', '[]'),
      it - 'sizes' - 'decorations')
    RETURNING id INTO v_item;

    FOR sz, j IN SELECT e, o FROM jsonb_array_elements(coalesce(it->'sizes', '[]')) WITH ORDINALITY AS x(e, o) LOOP
      INSERT INTO public.prod_item_sizes (item_id, seq, size, quantity, source_quantity)
      VALUES (v_item, j::int, sz->>'size', (sz->>'quantity')::int, (sz->>'quantity')::int);
    END LOOP;

    FOR dc, j IN SELECT e, o FROM jsonb_array_elements(coalesce(it->'decorations', '[]')) WITH ORDINALITY AS x(e, o) LOOP
      INSERT INTO public.prod_item_decorations (item_id, seq, location, method_inksoft, method_production,
        method_source, colorway, color_count, width_in, height_in, thread_colors, artwork_hash, mockup_hash,
        flags, source_values)
      VALUES (v_item, j::int, dc->>'location', dc->>'method_inksoft', dc->>'method_production',
        CASE WHEN dc->>'method_production' IS NULL THEN NULL ELSE coalesce(dc->>'method_source', 'rule') END,
        dc->>'colorway', dc->>'color_count', (dc->>'width_in')::numeric, (dc->>'height_in')::numeric,
        coalesce(ARRAY(SELECT jsonb_array_elements_text(dc->'thread_colors')), '{}'),
        dc->>'artwork_hash', dc->>'mockup_hash', coalesce(dc->'flags', '[]'), dc);
    END LOOP;
  END LOOP;
END $$;

-- CSV fields on an order (only fills what the CSV provides; never clears data)
CREATE OR REPLACE FUNCTION public.prod__apply_csv(p_order_id uuid, p_csv jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_csv IS NULL OR jsonb_typeof(p_csv) <> 'object' THEN RETURN; END IF;
  UPDATE public.prod_orders SET
    fulfillment = CASE WHEN p_csv->>'fulfillment' IN ('pickup', 'ship') THEN p_csv->>'fulfillment' ELSE fulfillment END,
    pickup_location = coalesce(p_csv->>'pickup_location', pickup_location),
    shipping_method = coalesce(p_csv->>'shipping_method', shipping_method),
    customer_email = coalesce(p_csv->>'email', customer_email),
    checkout_fields = CASE WHEN jsonb_array_length(coalesce(p_csv->'checkout_fields', '[]')) > 0
                           THEN p_csv->'checkout_fields' ELSE checkout_fields END,
    csv_item_count = coalesce((p_csv->>'item_count')::int, csv_item_count),
    updated_at = now()
  WHERE id = p_order_id;
END $$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

-- Register an uploaded PDF. Same file (by SHA-256) => returns the existing batch, creates nothing.
CREATE OR REPLACE FUNCTION public.prod_create_batch(
  p_file_name text, p_storage_path text, p_file_sha256 text, p_page_count int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.prod_import_batches;
BEGIN
  PERFORM public.prod__require_manager();
  SELECT * INTO b FROM public.prod_import_batches WHERE file_sha256 = p_file_sha256;
  IF FOUND THEN
    RETURN jsonb_build_object('batch_id', b.id, 'existing', true, 'created_at', b.created_at);
  END IF;
  INSERT INTO public.prod_import_batches (file_name, storage_path, file_sha256, page_count)
  VALUES (p_file_name, p_storage_path, p_file_sha256, p_page_count)
  RETURNING * INTO b;
  INSERT INTO public.prod_events (batch_id, action, details)
  VALUES (b.id, 'batch_uploaded', jsonb_build_object('file_name', p_file_name, 'pages', p_page_count));
  RETURN jsonb_build_object('batch_id', b.id, 'existing', false, 'created_at', b.created_at);
END $$;

-- Save what the parser read. One transaction; per order:
--   new order                      -> created for review
--   same content as current        -> 'unchanged' (nothing changes)
--   changed, not yet approved      -> 'updated' (review data replaced, new revision)
--   changed, already approved      -> 'pending' (kept aside; a manager must compare and apply)
CREATE OR REPLACE FUNCTION public.prod_save_extraction(p_batch_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o jsonb; pv jsonb; ord public.prod_orders; v_outcome text; v_rev int; v_prev_sha text;
  results jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.prod__require_manager();
  PERFORM 1 FROM public.prod_import_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import not found'; END IF;

  FOR pv IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'previews', '[]')) LOOP
    INSERT INTO public.prod_artwork_previews (hash, kind, storage_path, width_px, height_px, first_batch_id)
    VALUES (pv->>'hash', pv->>'kind', pv->>'storage_path', (pv->>'width_px')::int, (pv->>'height_px')::int, p_batch_id)
    ON CONFLICT (hash) DO NOTHING;
  END LOOP;

  FOR o IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'orders', '[]')) LOOP
    IF coalesce(o->>'order_number', '') = '' THEN CONTINUE; END IF;
    SELECT * INTO ord FROM public.prod_orders
      WHERE source = 'inksoft' AND order_number = o->>'order_number' FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.prod_orders (order_number, store_name, customer_name, order_date, due_date, flags)
      VALUES (o->>'order_number', o->>'store_name', o->>'customer_name',
              (o->>'order_date')::date, (o->>'ship_date')::date, coalesce(o->'flags', '[]'))
      RETURNING * INTO ord;
      PERFORM public.prod__write_items(ord.id, o);
      v_outcome := 'new'; v_rev := 1;
    ELSE
      SELECT content_sha256 INTO v_prev_sha FROM public.prod_order_sources
        WHERE order_id = ord.id AND revision = coalesce(ord.pending_revision, ord.current_revision)
          AND outcome IN ('new', 'updated', 'applied', 'pending')
        ORDER BY created_at DESC LIMIT 1;
      IF v_prev_sha IS NOT DISTINCT FROM (o->>'content_sha256') THEN
        v_outcome := 'unchanged'; v_rev := coalesce(ord.pending_revision, ord.current_revision);
      ELSIF ord.status = 'review' THEN
        v_rev := greatest(ord.current_revision, coalesce(ord.pending_revision, 0)) + 1;
        UPDATE public.prod_orders SET store_name = o->>'store_name', customer_name = o->>'customer_name',
          order_date = (o->>'order_date')::date, due_date = (o->>'ship_date')::date,
          flags = coalesce(o->'flags', '[]'), flags_ack_by = NULL, flags_ack_at = NULL, flags_ack_reason = NULL,
          current_revision = v_rev, pending_revision = NULL, updated_at = now()
        WHERE id = ord.id;
        UPDATE public.prod_order_sources SET outcome = 'dismissed' WHERE order_id = ord.id AND outcome = 'pending';
        PERFORM public.prod__write_items(ord.id, o);
        v_outcome := 'updated';
      ELSE
        v_rev := greatest(ord.current_revision, coalesce(ord.pending_revision, 0)) + 1;
        UPDATE public.prod_order_sources SET outcome = 'dismissed' WHERE order_id = ord.id AND outcome = 'pending';
        UPDATE public.prod_orders SET pending_revision = v_rev, updated_at = now() WHERE id = ord.id;
        v_outcome := 'pending';
      END IF;
    END IF;

    INSERT INTO public.prod_order_sources (order_id, batch_id, revision, pages, content_sha256, extracted, outcome)
    VALUES (ord.id, p_batch_id, v_rev,
            coalesce(ARRAY(SELECT jsonb_array_elements_text(o->'pages')::int), '{}'),
            coalesce(o->>'content_sha256', ''), o, v_outcome)
    ON CONFLICT (order_id, batch_id) DO NOTHING;

    -- CSV data never changes production details, so it's applied whatever the outcome
    PERFORM public.prod__apply_csv(ord.id, o->'csv');

    INSERT INTO public.prod_events (order_id, batch_id, action, details)
    VALUES (ord.id, p_batch_id, 'import_' || v_outcome, jsonb_build_object('revision', v_rev));
    results := results || jsonb_build_object('order_number', o->>'order_number', 'order_id', ord.id,
                                             'outcome', v_outcome, 'revision', v_rev);
  END LOOP;

  UPDATE public.prod_import_batches SET
    status = 'parsed', parser_version = p_payload->>'parser_version', printed_at = p_payload->>'printed_at',
    parse_flags = coalesce(p_payload->'flags', '[]'), summary = p_payload->'summary', error = NULL
  WHERE id = p_batch_id;
  RETURN results;
END $$;

CREATE OR REPLACE FUNCTION public.prod_mark_batch_failed(p_batch_id uuid, p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.prod__require_manager();
  UPDATE public.prod_import_batches SET status = 'failed', error = left(p_error, 2000)
  WHERE id = p_batch_id AND status <> 'parsed';
  INSERT INTO public.prod_events (batch_id, action, details) VALUES (p_batch_id, 'parse_failed', jsonb_build_object('error', left(p_error, 500)));
END $$;

-- Attach an InkSoft Orders CSV to a batch and apply its fields to matching orders.
-- p_orders[] = { order_number, fulfillment, pickup_location, shipping_method, email, checkout_fields, item_count }
CREATE OR REPLACE FUNCTION public.prod_apply_csv(
  p_batch_id uuid, p_file_name text, p_storage_path text, p_sha256 text, p_orders jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c jsonb; v_id uuid; matched int := 0; unmatched jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.prod__require_manager();
  UPDATE public.prod_import_batches SET csv_file_name = p_file_name, csv_storage_path = p_storage_path, csv_sha256 = p_sha256
  WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import not found'; END IF;
  FOR c IN SELECT * FROM jsonb_array_elements(coalesce(p_orders, '[]')) LOOP
    SELECT id INTO v_id FROM public.prod_orders WHERE source = 'inksoft' AND order_number = c->>'order_number';
    IF v_id IS NULL THEN
      unmatched := unmatched || to_jsonb(c->>'order_number');
    ELSE
      PERFORM public.prod__apply_csv(v_id, c);
      matched := matched + 1;
      INSERT INTO public.prod_events (order_id, batch_id, action, details)
      VALUES (v_id, p_batch_id, 'csv_applied', jsonb_build_object('file_name', p_file_name));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('matched', matched, 'unmatched', unmatched);
END $$;

-- Review edits (only while the order is in review)
CREATE OR REPLACE FUNCTION public.prod__order_in_review(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text;
BEGIN
  SELECT status INTO s FROM public.prod_orders WHERE id = p_order_id FOR UPDATE;
  IF s IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF s <> 'review' THEN RAISE EXCEPTION 'This order is % — reopen it for review before editing', s; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prod_update_size(p_size_id uuid, p_quantity int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  PERFORM public.prod__require_manager();
  SELECT s.*, i.order_id INTO r FROM public.prod_item_sizes s JOIN public.prod_order_items i ON i.id = s.item_id WHERE s.id = p_size_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Size row not found'; END IF;
  PERFORM public.prod__order_in_review(r.order_id);
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 10000 THEN RAISE EXCEPTION 'Quantity must be 0 or more'; END IF;
  UPDATE public.prod_item_sizes SET quantity = p_quantity, edited_by = auth.uid(), edited_at = now() WHERE id = p_size_id;
  INSERT INTO public.prod_events (order_id, item_id, action, details)
  VALUES (r.order_id, r.item_id, 'edit_quantity', jsonb_build_object('size', r.size, 'from', r.quantity, 'to', p_quantity));
END $$;

-- p_patch keys allowed: color, mfg_sku, product_name
CREATE OR REPLACE FUNCTION public.prod_update_item(p_item_id uuid, p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.prod_order_items; k text;
BEGIN
  PERFORM public.prod__require_manager();
  SELECT * INTO r FROM public.prod_order_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  PERFORM public.prod__order_in_review(r.order_id);
  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF k NOT IN ('color', 'mfg_sku', 'product_name') THEN RAISE EXCEPTION 'Field % cannot be edited', k; END IF;
  END LOOP;
  UPDATE public.prod_order_items SET
    color = CASE WHEN p_patch ? 'color' THEN nullif(trim(p_patch->>'color'), '') ELSE color END,
    mfg_sku = CASE WHEN p_patch ? 'mfg_sku' THEN nullif(trim(p_patch->>'mfg_sku'), '') ELSE mfg_sku END,
    product_name = CASE WHEN p_patch ? 'product_name' THEN nullif(trim(p_patch->>'product_name'), '') ELSE product_name END,
    edited_by = auth.uid(), edited_at = now()
  WHERE id = p_item_id;
  INSERT INTO public.prod_events (order_id, item_id, action, details)
  VALUES (r.order_id, r.id, 'edit_item', jsonb_build_object('patch', p_patch,
    'from', jsonb_build_object('color', r.color, 'mfg_sku', r.mfg_sku, 'product_name', r.product_name)));
END $$;

-- p_patch keys allowed: location, method_production (+ override_reason), width_in, height_in, thread_colors
CREATE OR REPLACE FUNCTION public.prod_update_decoration(p_decoration_id uuid, p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; k text;
BEGIN
  PERFORM public.prod__require_manager();
  SELECT d.*, i.order_id INTO r FROM public.prod_item_decorations d JOIN public.prod_order_items i ON i.id = d.item_id
  WHERE d.id = p_decoration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Decoration not found'; END IF;
  PERFORM public.prod__order_in_review(r.order_id);
  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF k NOT IN ('location', 'method_production', 'override_reason', 'width_in', 'height_in', 'thread_colors') THEN
      RAISE EXCEPTION 'Field % cannot be edited', k;
    END IF;
  END LOOP;
  IF p_patch ? 'method_production' AND (p_patch->>'method_production') IS DISTINCT FROM r.method_production
     AND coalesce(trim(p_patch->>'override_reason'), '') = '' THEN
    RAISE EXCEPTION 'A reason is required to change the production method';
  END IF;
  UPDATE public.prod_item_decorations SET
    location = CASE WHEN p_patch ? 'location' THEN nullif(trim(p_patch->>'location'), '') ELSE location END,
    method_production = CASE WHEN p_patch ? 'method_production' THEN p_patch->>'method_production' ELSE method_production END,
    method_source = CASE WHEN p_patch ? 'method_production' THEN 'staff' ELSE method_source END,
    override_reason = CASE WHEN p_patch ? 'method_production' THEN trim(p_patch->>'override_reason') ELSE override_reason END,
    override_by = CASE WHEN p_patch ? 'method_production' THEN auth.uid() ELSE override_by END,
    override_at = CASE WHEN p_patch ? 'method_production' THEN now() ELSE override_at END,
    width_in = CASE WHEN p_patch ? 'width_in' THEN (p_patch->>'width_in')::numeric ELSE width_in END,
    height_in = CASE WHEN p_patch ? 'height_in' THEN (p_patch->>'height_in')::numeric ELSE height_in END,
    thread_colors = CASE WHEN p_patch ? 'thread_colors'
                         THEN coalesce(ARRAY(SELECT jsonb_array_elements_text(p_patch->'thread_colors')), '{}')
                         ELSE thread_colors END,
    edited_by = auth.uid(), edited_at = now()
  WHERE id = p_decoration_id;
  INSERT INTO public.prod_events (order_id, item_id, action, details)
  VALUES (r.order_id, r.item_id, 'edit_decoration', jsonb_build_object('decoration_id', r.id, 'patch', p_patch,
    'from', jsonb_build_object('location', r.location, 'method_production', r.method_production,
                               'width_in', r.width_in, 'height_in', r.height_in, 'thread_colors', r.thread_colors)));
END $$;

-- p_patch keys allowed: fulfillment, pickup_location
CREATE OR REPLACE FUNCTION public.prod_update_order(p_order_id uuid, p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.prod_orders; k text;
BEGIN
  PERFORM public.prod__require_manager();
  SELECT * INTO r FROM public.prod_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF k NOT IN ('fulfillment', 'pickup_location') THEN RAISE EXCEPTION 'Field % cannot be edited', k; END IF;
  END LOOP;
  UPDATE public.prod_orders SET
    fulfillment = CASE WHEN p_patch ? 'fulfillment' THEN p_patch->>'fulfillment' ELSE fulfillment END,
    pickup_location = CASE WHEN p_patch ? 'pickup_location' THEN nullif(trim(p_patch->>'pickup_location'), '') ELSE pickup_location END,
    updated_at = now()
  WHERE id = p_order_id;
  INSERT INTO public.prod_events (order_id, action, details)
  VALUES (p_order_id, 'edit_order', jsonb_build_object('patch', p_patch,
    'from', jsonb_build_object('fulfillment', r.fulfillment, 'pickup_location', r.pickup_location)));
END $$;

-- A manager confirms they checked the file-level problems (missing pages, etc.)
CREATE OR REPLACE FUNCTION public.prod_acknowledge_flags(p_order_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.prod__require_manager();
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A note is required'; END IF;
  PERFORM public.prod__order_in_review(p_order_id);
  UPDATE public.prod_orders SET flags_ack_by = auth.uid(), flags_ack_at = now(), flags_ack_reason = trim(p_reason), updated_at = now()
  WHERE id = p_order_id;
  INSERT INTO public.prod_events (order_id, action, details) VALUES (p_order_id, 'flags_acknowledged', jsonb_build_object('reason', trim(p_reason)));
END $$;

-- Problems that block approval, computed from the current (possibly edited) data.
CREATE OR REPLACE FUNCTION public.prod_order_blockers(p_order_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE out text[] := '{}'; o public.prod_orders; r record;
BEGIN
  SELECT * INTO o FROM public.prod_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN ARRAY['Order not found']; END IF;
  IF o.pending_revision IS NOT NULL THEN out := out || 'A newer copy of this order is waiting to be compared'::text; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(o.flags) f WHERE f->>'level' = 'block') AND o.flags_ack_at IS NULL THEN
    out := out || 'File problems need a manager’s check'::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prod_order_items WHERE order_id = p_order_id) THEN
    out := out || 'No products'::text;
  END IF;
  FOR r IN SELECT i.* FROM public.prod_order_items i WHERE i.order_id = p_order_id ORDER BY i.item_index LOOP
    IF r.mfg_sku IS NULL THEN out := out || format('Item %s: SKU missing', r.item_index); END IF;
    IF r.color IS NULL THEN out := out || format('Item %s: color missing', r.item_index); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.prod_item_sizes s WHERE s.item_id = r.id AND coalesce(s.quantity, 0) > 0) THEN
      out := out || format('Item %s: no quantity', r.item_index);
    END IF;
    IF EXISTS (SELECT 1 FROM public.prod_item_sizes s WHERE s.item_id = r.id AND s.quantity IS NULL) THEN
      out := out || format('Item %s: a size has no quantity', r.item_index);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.prod_item_decorations d WHERE d.item_id = r.id) THEN
      out := out || format('Item %s: no decoration', r.item_index);
    END IF;
    IF EXISTS (SELECT 1 FROM public.prod_item_decorations d WHERE d.item_id = r.id AND d.location IS NULL) THEN
      out := out || format('Item %s: a decoration has no location', r.item_index);
    END IF;
    IF EXISTS (SELECT 1 FROM public.prod_item_decorations d WHERE d.item_id = r.id AND d.method_production IS NULL) THEN
      out := out || format('Item %s: choose the production method', r.item_index);
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(r.flags) f WHERE f->>'level' = 'block'
               AND f->>'code' IN ('total_mismatch', 'missing_total', 'no_size_grid'))
       AND NOT EXISTS (SELECT 1 FROM public.prod_item_sizes s WHERE s.item_id = r.id AND s.edited_at IS NOT NULL)
       AND o.flags_ack_at IS NULL THEN
      out := out || format('Item %s: size totals don’t match the PDF — check the quantities', r.item_index);
    END IF;
  END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.prod_approve_order(p_order_id uuid, p_expected_revision int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.prod_orders; b text[];
BEGIN
  PERFORM public.prod__require_manager();
  SELECT * INTO o FROM public.prod_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status = 'approved' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'approved_at', o.approved_at);
  END IF;
  IF o.status <> 'review' THEN RAISE EXCEPTION 'Order is %', o.status; END IF;
  IF o.current_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'This order changed while you were reviewing it. Reload and check again.';
  END IF;
  b := public.prod_order_blockers(p_order_id);
  IF array_length(b, 1) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'blockers', to_jsonb(b));
  END IF;
  UPDATE public.prod_orders SET status = 'approved', approved_revision = current_revision,
    approved_by = auth.uid(), approved_at = now(), updated_at = now()
  WHERE id = p_order_id;
  INSERT INTO public.prod_events (order_id, action, details) VALUES (p_order_id, 'approved', jsonb_build_object('revision', o.current_revision));
  RETURN jsonb_build_object('ok', true);
END $$;

-- Back to review (Phase 1: allowed while no garment records exist — none do yet).
CREATE OR REPLACE FUNCTION public.prod_reopen_order(p_order_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.prod_orders;
BEGIN
  PERFORM public.prod__require_manager();
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO o FROM public.prod_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status NOT IN ('approved', 'on_hold') THEN RAISE EXCEPTION 'Order is %', o.status; END IF;
  UPDATE public.prod_orders SET status = 'review', approved_revision = NULL, approved_by = NULL, approved_at = NULL, updated_at = now()
  WHERE id = p_order_id;
  INSERT INTO public.prod_events (order_id, action, details) VALUES (p_order_id, 'reopened', jsonb_build_object('reason', trim(p_reason)));
END $$;

-- Apply or dismiss a newer copy of an approved order.
CREATE OR REPLACE FUNCTION public.prod_apply_revision(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.prod_orders; s public.prod_order_sources;
BEGIN
  PERFORM public.prod__require_manager();
  SELECT * INTO o FROM public.prod_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.pending_revision IS NULL THEN RAISE EXCEPTION 'No newer copy is waiting'; END IF;
  SELECT * INTO s FROM public.prod_order_sources WHERE order_id = p_order_id AND outcome = 'pending'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No newer copy is waiting'; END IF;
  PERFORM public.prod__write_items(p_order_id, s.extracted);
  UPDATE public.prod_orders SET store_name = s.extracted->>'store_name', customer_name = s.extracted->>'customer_name',
    order_date = (s.extracted->>'order_date')::date, due_date = (s.extracted->>'ship_date')::date,
    flags = coalesce(s.extracted->'flags', '[]'), flags_ack_by = NULL, flags_ack_at = NULL, flags_ack_reason = NULL,
    status = 'review', current_revision = o.pending_revision, pending_revision = NULL,
    approved_revision = NULL, approved_by = NULL, approved_at = NULL, updated_at = now()
  WHERE id = p_order_id;
  UPDATE public.prod_order_sources SET outcome = 'applied' WHERE id = s.id;
  INSERT INTO public.prod_events (order_id, batch_id, action, details)
  VALUES (p_order_id, s.batch_id, 'revision_applied', jsonb_build_object('from', o.current_revision, 'to', o.pending_revision));
END $$;

CREATE OR REPLACE FUNCTION public.prod_dismiss_revision(p_order_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.prod__require_manager();
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  UPDATE public.prod_order_sources SET outcome = 'dismissed' WHERE order_id = p_order_id AND outcome = 'pending';
  UPDATE public.prod_orders SET pending_revision = NULL, updated_at = now() WHERE id = p_order_id;
  INSERT INTO public.prod_events (order_id, action, details) VALUES (p_order_id, 'revision_dismissed', jsonb_build_object('reason', trim(p_reason)));
END $$;

-- DTF transfer list: mark decorations' transfers printed / not printed (any staff role).
CREATE OR REPLACE FUNCTION public.prod_set_transfers_printed(p_decoration_ids uuid[], p_printed boolean)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  PERFORM public.prod__require_staff();
  UPDATE public.prod_item_decorations d SET
    transfer_printed_at = CASE WHEN p_printed THEN now() ELSE NULL END,
    transfer_printed_by = CASE WHEN p_printed THEN auth.uid() ELSE NULL END
  FROM public.prod_order_items i, public.prod_orders o
  WHERE d.id = ANY(p_decoration_ids) AND i.id = d.item_id AND o.id = i.order_id
    AND o.status = 'approved' AND d.method_production = 'dtf'
    AND (d.transfer_printed_at IS NULL) = p_printed;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.prod_events (action, details)
  VALUES (CASE WHEN p_printed THEN 'transfers_printed' ELSE 'transfers_unmarked' END,
          jsonb_build_object('decoration_ids', to_jsonb(p_decoration_ids), 'changed', n));
  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- Function permissions: signed-in users only (each function checks the role itself)
-- ---------------------------------------------------------------------------
DO $$
DECLARE f text;
BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname LIKE 'prod\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    IF f LIKE 'prod\_\_%' THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
    END IF;
  END LOOP;
END $$;
