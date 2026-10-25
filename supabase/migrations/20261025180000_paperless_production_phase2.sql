-- Paperless Production, Phase 2: garments + labels, station scanning, table spots, final check,
-- pickup label, mark shipped. Requires 20261025120000_paperless_production_phase1.sql.
--
-- Additive: new prod_* tables and functions. Replaces two Phase 1 functions (prod_approve_order now
-- also creates the garment records; prod_reopen_order keeps working with them). Nothing outside prod_*
-- is touched. Rollback: supabase/rollbacks/20261025180000_paperless_production_phase2.down.sql
--
-- Same security model as Phase 1: staff can read; every write goes through a function below.
-- Station logins use the 'team' role. Scans, task completion, assembly, final check, packing and
-- marking shipped are allowed for any staff role. Spot count changes need a manager.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Random label ID: 12 characters, no look-alikes (no 0/O, 1/I/L). Carries no order or customer data.
CREATE OR REPLACE FUNCTION public.prod__token()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  b bytea := decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex');
  out text := '';
  i int;
BEGIN
  FOR i IN 0..11 LOOP
    out := out || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
  END LOOP;
  RETURN out;
END $$;

ALTER TABLE public.prod_orders
  ADD COLUMN pickup_token text UNIQUE,
  ADD COLUMN check_passed_at timestamptz,
  ADD COLUMN check_passed_by uuid,
  ADD COLUMN packed_at timestamptz,
  ADD COLUMN packed_by uuid,
  ADD COLUMN shipped_at timestamptz,
  ADD COLUMN shipped_by uuid;

-- One row per physical piece. Keeps its own copy of what the label says, so later edits to the
-- order never change what a printed label means. Pieces are never deleted or renumbered, only voided.
CREATE TABLE public.prod_garments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.prod_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.prod_order_items(id) ON DELETE SET NULL,
  size_id uuid REFERENCES public.prod_item_sizes(id) ON DELETE SET NULL,
  seq int NOT NULL,
  token text NOT NULL UNIQUE DEFAULT public.prod__token(),
  item_index int,
  size text NOT NULL,
  mfg_sku text,
  color text,
  product_name text,
  label_printed_at timestamptz,
  label_printed_by uuid,
  assembled_at timestamptz,
  assembled_by uuid,
  assembled_spot int,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, seq)
);
CREATE INDEX prod_garments_order_idx ON public.prod_garments(order_id);

-- One per garment × decoration.
CREATE TABLE public.prod_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garment_id uuid NOT NULL REFERENCES public.prod_garments(id) ON DELETE CASCADE,
  decoration_id uuid REFERENCES public.prod_item_decorations(id) ON DELETE SET NULL,
  location text NOT NULL,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'voided')),
  done_at timestamptz,
  done_by uuid,
  done_station text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prod_tasks_garment_idx ON public.prod_tasks(garment_id);

-- Table spots (blue tape + Sharpie). An order can hold more than one spot; new pieces go to the newest.
CREATE TABLE public.prod_spot_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.prod_orders(id) ON DELETE CASCADE,
  spot int NOT NULL CHECK (spot > 0),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  release_reason text
);
CREATE UNIQUE INDEX prod_spot_one_order ON public.prod_spot_assignments(spot) WHERE released_at IS NULL;

CREATE TABLE public.prod_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  spot_count int NOT NULL DEFAULT 20 CHECK (spot_count BETWEEN 1 AND 200),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.prod_settings (id) VALUES (true);

-- Every scan, once. client_scan_id makes a double-fired scan or a network retry harmless.
CREATE TABLE public.prod_scans (
  client_scan_id text PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  station text NOT NULL,
  code text NOT NULL,
  garment_id uuid,
  order_id uuid,
  result jsonb NOT NULL
);
CREATE INDEX prod_scans_at_idx ON public.prod_scans(at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prod_garments', 'prod_tasks', 'prod_spot_assignments', 'prod_settings', 'prod_scans'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.prod_is_staff())',
                   t || '_staff_read', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Garment records: created at approval, reconciled when a corrected order is approved again
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prod__sync_garments(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it record; sz record; g record; d record; t record;
  v_have int; v_next int; v_added int := 0; v_voided int := 0; v_tasks_added int := 0; v_tasks_voided int := 0;
  v_gid uuid;
BEGIN
  SELECT coalesce(max(seq), 0) INTO v_next FROM public.prod_garments WHERE order_id = p_order_id;

  -- pieces whose product line is gone
  UPDATE public.prod_garments gg SET voided_at = now(), void_reason = 'Removed from the order'
  WHERE gg.order_id = p_order_id AND gg.voided_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.prod_order_items i WHERE i.order_id = p_order_id AND i.item_index = gg.item_index);
  GET DIAGNOSTICS v_have = ROW_COUNT; v_voided := v_voided + v_have;

  FOR it IN SELECT * FROM public.prod_order_items WHERE order_id = p_order_id ORDER BY item_index LOOP
    -- sizes no longer on this line
    UPDATE public.prod_garments gg SET voided_at = now(), void_reason = 'Size removed from the order'
    WHERE gg.order_id = p_order_id AND gg.voided_at IS NULL AND gg.item_index = it.item_index
      AND NOT EXISTS (SELECT 1 FROM public.prod_item_sizes s WHERE s.item_id = it.id AND s.size = gg.size AND coalesce(s.quantity, 0) > 0);
    GET DIAGNOSTICS v_have = ROW_COUNT; v_voided := v_voided + v_have;

    FOR sz IN SELECT * FROM public.prod_item_sizes WHERE item_id = it.id AND coalesce(quantity, 0) > 0 ORDER BY seq LOOP
      -- re-link surviving pieces to the current rows and refresh the label copy
      UPDATE public.prod_garments SET item_id = it.id, size_id = sz.id, mfg_sku = it.mfg_sku, color = it.color,
        product_name = it.product_name
      WHERE order_id = p_order_id AND voided_at IS NULL AND item_index = it.item_index AND size = sz.size;
      SELECT count(*) INTO v_have FROM public.prod_garments
      WHERE order_id = p_order_id AND voided_at IS NULL AND item_index = it.item_index AND size = sz.size;
      WHILE v_have < sz.quantity LOOP
        v_next := v_next + 1;
        INSERT INTO public.prod_garments (order_id, item_id, size_id, seq, item_index, size, mfg_sku, color, product_name)
        VALUES (p_order_id, it.id, sz.id, v_next, it.item_index, sz.size, it.mfg_sku, it.color, it.product_name);
        v_have := v_have + 1; v_added := v_added + 1;
      END LOOP;
      -- quantity went down: void the newest pieces first, preferring ones not yet labeled or started
      FOR g IN SELECT gg.id FROM public.prod_garments gg
               WHERE gg.order_id = p_order_id AND gg.voided_at IS NULL AND gg.item_index = it.item_index AND gg.size = sz.size
               ORDER BY (gg.assembled_at IS NOT NULL), (gg.label_printed_at IS NOT NULL), gg.seq DESC
               LIMIT greatest(v_have - sz.quantity, 0) LOOP
        UPDATE public.prod_garments SET voided_at = now(), void_reason = 'Quantity reduced' WHERE id = g.id;
        v_voided := v_voided + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  UPDATE public.prod_tasks tt SET status = 'voided'
  FROM public.prod_garments gg WHERE gg.id = tt.garment_id AND gg.order_id = p_order_id AND gg.voided_at IS NOT NULL AND tt.status = 'open';

  -- tasks: one per decoration on each live piece
  FOR g IN SELECT gg.* FROM public.prod_garments gg WHERE gg.order_id = p_order_id AND gg.voided_at IS NULL LOOP
    FOR d IN SELECT * FROM public.prod_item_decorations WHERE item_id = g.item_id ORDER BY seq LOOP
      SELECT * INTO t FROM public.prod_tasks
      WHERE garment_id = g.id AND status <> 'voided' AND lower(location) = lower(coalesce(d.location, '?'))
      ORDER BY created_at LIMIT 1;
      IF FOUND THEN
        UPDATE public.prod_tasks SET decoration_id = d.id,
          method = CASE WHEN status = 'open' THEN d.method_production ELSE method END
        WHERE id = t.id;
      ELSE
        INSERT INTO public.prod_tasks (garment_id, decoration_id, location, method)
        VALUES (g.id, d.id, coalesce(d.location, '?'), d.method_production);
        v_tasks_added := v_tasks_added + 1;
      END IF;
    END LOOP;
    UPDATE public.prod_tasks tt SET status = 'voided'
    WHERE tt.garment_id = g.id AND tt.status = 'open'
      AND NOT EXISTS (SELECT 1 FROM public.prod_item_decorations dd WHERE dd.item_id = g.item_id AND lower(coalesce(dd.location, '?')) = lower(tt.location));
    GET DIAGNOSTICS v_have = ROW_COUNT; v_tasks_voided := v_tasks_voided + v_have;
  END LOOP;

  UPDATE public.prod_orders SET pickup_token = coalesce(pickup_token, public.prod__token()) WHERE id = p_order_id;

  RETURN jsonb_build_object('added', v_added, 'voided', v_voided, 'tasks_added', v_tasks_added, 'tasks_voided', v_tasks_voided);
END $$;

-- Approve = Phase 1 rules + create/reconcile the garment records.
CREATE OR REPLACE FUNCTION public.prod_approve_order(p_order_id uuid, p_expected_revision int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.prod_orders; b text[]; s jsonb;
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
    approved_by = auth.uid(), approved_at = now(), updated_at = now(),
    -- a corrected order has to pass the final check again
    check_passed_at = NULL, check_passed_by = NULL
  WHERE id = p_order_id;
  s := public.prod__sync_garments(p_order_id);
  INSERT INTO public.prod_events (order_id, action, details)
  VALUES (p_order_id, 'approved', jsonb_build_object('revision', o.current_revision, 'garments', s));
  RETURN jsonb_build_object('ok', true, 'garments', s);
END $$;

-- Reopen: same as Phase 1, but not after the order was packed or shipped.
CREATE OR REPLACE FUNCTION public.prod_reopen_order(p_order_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.prod_orders;
BEGIN
  PERFORM public.prod__require_manager();
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO o FROM public.prod_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status NOT IN ('approved', 'on_hold') THEN RAISE EXCEPTION 'Order is %', o.status; END IF;
  IF o.packed_at IS NOT NULL OR o.shipped_at IS NOT NULL THEN
    RAISE EXCEPTION 'This order is already packed or shipped';
  END IF;
  UPDATE public.prod_orders SET status = 'review', approved_revision = NULL, approved_by = NULL, approved_at = NULL,
    check_passed_at = NULL, check_passed_by = NULL, updated_at = now()
  WHERE id = p_order_id;
  INSERT INTO public.prod_events (order_id, action, details) VALUES (p_order_id, 'reopened', jsonb_build_object('reason', trim(p_reason)));
END $$;

-- Back-fill: orders approved before this migration get their garment records now.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.prod_orders WHERE status = 'approved' LOOP
    PERFORM public.prod__sync_garments(r.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Labels
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prod_mark_labels_printed(p_garment_ids uuid[])
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  PERFORM public.prod__require_staff();
  UPDATE public.prod_garments SET label_printed_at = now(), label_printed_by = auth.uid()
  WHERE id = ANY(p_garment_ids) AND label_printed_at IS NULL AND voided_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.prod_events (order_id, action, details)
  SELECT DISTINCT order_id, 'labels_printed', jsonb_build_object('garment_ids', to_jsonb(p_garment_ids), 'new', n)
  FROM public.prod_garments WHERE id = ANY(p_garment_ids);
  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- Scanning
-- ---------------------------------------------------------------------------
-- Accepts a full label URL (…/g/<token>, …/p/<token>), a bare token, or a typed short code
-- like 1002714-03 (garment) or 1002714 (order, packing station only).
CREATE OR REPLACE FUNCTION public.prod__task_list(p_garment_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'location', location, 'method', method, 'status', status,
                                               'done_at', done_at, 'done_station', done_station) ORDER BY created_at), '[]')
  FROM public.prod_tasks WHERE garment_id = p_garment_id AND status <> 'voided';
$$;

CREATE OR REPLACE FUNCTION public.prod__order_progress(p_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'garments', (SELECT count(*) FROM public.prod_garments WHERE order_id = p_order_id AND voided_at IS NULL),
    'assembled', (SELECT count(*) FROM public.prod_garments WHERE order_id = p_order_id AND voided_at IS NULL AND assembled_at IS NOT NULL),
    'spots', (SELECT coalesce(jsonb_agg(spot ORDER BY assigned_at), '[]') FROM public.prod_spot_assignments
              WHERE order_id = p_order_id AND released_at IS NULL));
$$;

CREATE OR REPLACE FUNCTION public.prod__free_spot()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; s int;
BEGIN
  -- one spot handed out at a time, so two stations can't get the same spot
  PERFORM pg_advisory_xact_lock(hashtext('prod_spots'));
  SELECT spot_count INTO n FROM public.prod_settings WHERE id;
  SELECT x INTO s FROM generate_series(1, n) x
  WHERE NOT EXISTS (SELECT 1 FROM public.prod_spot_assignments WHERE spot = x AND released_at IS NULL)
  ORDER BY x LIMIT 1;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.prod_scan(p_code text, p_station text, p_client_scan_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := upper(trim(coalesce(p_code, '')));
  v_token text; v_m text[];
  g public.prod_garments; o public.prod_orders;
  v_open jsonb; v_done jsonb; v_other jsonb; v_spot int; v_prog jsonb; v_res jsonb; v_prev jsonb;
  v_method text;
BEGIN
  PERFORM public.prod__require_staff();
  IF p_station NOT IN ('dtf', 'embroidery', 'assembly', 'pack', 'lookup') THEN RAISE EXCEPTION 'Unknown station'; END IF;
  IF coalesce(p_client_scan_id, '') = '' THEN RAISE EXCEPTION 'Missing scan id'; END IF;

  SELECT result INTO v_prev FROM public.prod_scans WHERE client_scan_id = p_client_scan_id;
  IF FOUND THEN RETURN v_prev || jsonb_build_object('repeat', true); END IF;

  -- what was scanned
  v_m := regexp_match(v_code, '/(G|P)/([2-9A-HJKMNP-Z]{12})');
  IF v_m IS NOT NULL THEN v_token := v_m[2];
  ELSIF v_code ~ '^[2-9A-HJKMNP-Z]{12}$' THEN v_token := v_code;
  END IF;

  IF v_token IS NOT NULL THEN
    SELECT * INTO g FROM public.prod_garments WHERE token = v_token FOR UPDATE;
    IF NOT FOUND THEN
      SELECT * INTO o FROM public.prod_orders WHERE pickup_token = v_token FOR UPDATE;
    END IF;
  ELSIF v_code ~ '^\d{4,}-\d{1,3}$' THEN
    SELECT gg.* INTO g FROM public.prod_garments gg JOIN public.prod_orders oo ON oo.id = gg.order_id
    WHERE oo.order_number = split_part(v_code, '-', 1) AND gg.seq = split_part(v_code, '-', 2)::int FOR UPDATE OF gg;
  ELSIF v_code ~ '^\d{4,}$' THEN
    SELECT * INTO o FROM public.prod_orders WHERE order_number = v_code FOR UPDATE;
  END IF;

  IF g.id IS NOT NULL THEN
    SELECT * INTO o FROM public.prod_orders WHERE id = g.order_id FOR UPDATE;
  END IF;

  IF g.id IS NULL AND o.id IS NULL THEN
    v_res := jsonb_build_object('ok', false, 'kind', 'unknown', 'message', 'Label not recognized');
  ELSIF g.id IS NOT NULL AND g.voided_at IS NOT NULL THEN
    v_res := jsonb_build_object('ok', false, 'kind', 'voided', 'message', 'Do not use: ' || coalesce(g.void_reason, 'removed from the order'));
  ELSIF o.status <> 'approved' THEN
    v_res := jsonb_build_object('ok', false, 'kind', 'on_hold', 'message', 'Hold this: the order is back in review');
  ELSIF p_station = 'lookup' THEN
    v_res := jsonb_build_object('ok', true, 'kind', 'info');
  ELSIF p_station IN ('dtf', 'embroidery') THEN
    IF g.id IS NULL THEN
      v_res := jsonb_build_object('ok', false, 'kind', 'wrong_label', 'message', 'That’s an order label. Scan the garment label.');
    ELSE
      v_method := p_station;
      WITH done AS (
        UPDATE public.prod_tasks SET status = 'done', done_at = now(), done_by = auth.uid(), done_station = p_station
        WHERE garment_id = g.id AND method = v_method AND status = 'open'
        RETURNING location)
      SELECT coalesce(jsonb_agg(location), '[]') INTO v_done FROM done;
      SELECT coalesce(jsonb_agg(location || ' ' || method), '[]') INTO v_other
      FROM public.prod_tasks WHERE garment_id = g.id AND status = 'open';
      IF jsonb_array_length(v_done) > 0 THEN
        v_res := jsonb_build_object('ok', true, 'kind', 'done', 'done', v_done, 'still_open', v_other,
          'message', CASE WHEN jsonb_array_length(v_other) = 0 THEN 'Done. Piece is ready for assembly.'
                          ELSE 'Done. Still needs: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(v_other) x) END);
      ELSIF EXISTS (SELECT 1 FROM public.prod_tasks WHERE garment_id = g.id AND method = v_method AND status = 'done') THEN
        v_res := jsonb_build_object('ok', true, 'kind', 'already', 'still_open', v_other,
          'message', 'Already done' || CASE WHEN jsonb_array_length(v_other) > 0
            THEN '. Still needs: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(v_other) x) ELSE '' END);
      ELSE
        v_res := jsonb_build_object('ok', false, 'kind', 'not_here', 'still_open', v_other,
          'message', 'Nothing for this station' || CASE WHEN jsonb_array_length(v_other) > 0
            THEN '. Needs: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(v_other) x) ELSE '' END);
      END IF;
    END IF;
  ELSIF p_station = 'assembly' THEN
    IF g.id IS NULL THEN
      v_res := jsonb_build_object('ok', false, 'kind', 'wrong_label', 'message', 'That’s an order label. Scan the garment label.');
    ELSIF g.assembled_at IS NOT NULL THEN
      v_prog := public.prod__order_progress(o.id);
      v_res := jsonb_build_object('ok', true, 'kind', 'already', 'spot', g.assembled_spot, 'progress', v_prog,
        'message', format('Already counted. Spot %s (%s of %s)', g.assembled_spot, v_prog->>'assembled', v_prog->>'garments'));
    ELSE
      SELECT coalesce(jsonb_agg(location || ' ' || method), '[]') INTO v_other
      FROM public.prod_tasks WHERE garment_id = g.id AND status = 'open';
      IF jsonb_array_length(v_other) > 0 THEN
        v_res := jsonb_build_object('ok', false, 'kind', 'not_finished', 'still_open', v_other,
          'message', 'Not finished: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(v_other) x));
      ELSE
        SELECT spot INTO v_spot FROM public.prod_spot_assignments
        WHERE order_id = o.id AND released_at IS NULL ORDER BY assigned_at DESC LIMIT 1;
        IF v_spot IS NULL THEN
          v_spot := public.prod__free_spot();
          IF v_spot IS NOT NULL THEN
            INSERT INTO public.prod_spot_assignments (order_id, spot) VALUES (o.id, v_spot);
          END IF;
        END IF;
        IF v_spot IS NULL THEN
          v_res := jsonb_build_object('ok', false, 'kind', 'no_spot', 'message', 'No free spots. Pack an order or add spots.');
        ELSE
          UPDATE public.prod_garments SET assembled_at = now(), assembled_by = auth.uid(), assembled_spot = v_spot WHERE id = g.id;
          v_prog := public.prod__order_progress(o.id);
          v_res := jsonb_build_object('ok', true, 'kind', 'assembled', 'spot', v_spot, 'progress', v_prog,
            'complete', (v_prog->>'assembled')::int = (v_prog->>'garments')::int,
            'message', CASE WHEN (v_prog->>'assembled')::int = (v_prog->>'garments')::int
              THEN format('Spot %s. All %s pieces are in. Ready for final check.', v_spot, v_prog->>'garments')
              ELSE format('Spot %s. %s of %s pieces', v_spot, v_prog->>'assembled', v_prog->>'garments') END);
        END IF;
      END IF;
    END IF;
  ELSIF p_station = 'pack' THEN
    IF o.packed_at IS NOT NULL OR o.shipped_at IS NOT NULL THEN
      v_res := jsonb_build_object('ok', true, 'kind', 'already', 'message', 'Already packed');
    ELSIF o.check_passed_at IS NULL THEN
      v_res := jsonb_build_object('ok', false, 'kind', 'not_checked', 'message', 'Final check not done yet');
    ELSE
      UPDATE public.prod_orders SET packed_at = now(), packed_by = auth.uid(), updated_at = now() WHERE id = o.id;
      UPDATE public.prod_spot_assignments SET released_at = now(), release_reason = 'packed'
      WHERE order_id = o.id AND released_at IS NULL;
      v_res := jsonb_build_object('ok', true, 'kind', 'packed', 'message', 'Packed. Spot is free.');
    END IF;
  END IF;

  IF o.id IS NOT NULL THEN
    v_res := v_res || jsonb_build_object(
      'order', jsonb_build_object('id', o.id, 'order_number', o.order_number, 'customer_name', o.customer_name,
                                  'store_name', o.store_name, 'fulfillment', o.fulfillment),
      'progress', coalesce(v_res->'progress', public.prod__order_progress(o.id)));
  END IF;
  IF g.id IS NOT NULL THEN
    v_res := v_res || jsonb_build_object('garment', jsonb_build_object('id', g.id, 'seq', g.seq,
      'code', o.order_number || '-' || lpad(g.seq::text, 2, '0'), 'size', g.size, 'mfg_sku', g.mfg_sku, 'color', g.color,
      'tasks', public.prod__task_list(g.id)));
  END IF;

  INSERT INTO public.prod_scans (client_scan_id, station, code, garment_id, order_id, result)
  VALUES (p_client_scan_id, p_station, left(p_code, 200), g.id, o.id, v_res);
  IF v_res->>'kind' IN ('done', 'assembled', 'packed') THEN
    INSERT INTO public.prod_events (order_id, action, details)
    VALUES (o.id, 'scan_' || (v_res->>'kind'), jsonb_build_object('station', p_station, 'garment_id', g.id, 'result', v_res - 'order' - 'garment'));
  END IF;
  RETURN v_res;
END $$;

-- Undo a task (scanned by mistake), or finish one by hand (laser, patches, or a missed scan).
CREATE OR REPLACE FUNCTION public.prod_set_task(p_task_id uuid, p_done boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  PERFORM public.prod__require_staff();
  SELECT tt.*, gg.order_id, gg.assembled_at, gg.voided_at AS g_void, oo.status AS o_status
  INTO t FROM public.prod_tasks tt JOIN public.prod_garments gg ON gg.id = tt.garment_id JOIN public.prod_orders oo ON oo.id = gg.order_id
  WHERE tt.id = p_task_id FOR UPDATE OF tt;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF t.status = 'voided' OR t.g_void IS NOT NULL THEN RAISE EXCEPTION 'This piece was removed from the order'; END IF;
  IF t.o_status <> 'approved' THEN RAISE EXCEPTION 'The order is back in review'; END IF;
  IF NOT p_done AND t.assembled_at IS NOT NULL THEN RAISE EXCEPTION 'This piece is already in its spot'; END IF;
  IF (t.status = 'done') = p_done THEN RETURN; END IF;
  UPDATE public.prod_tasks SET status = CASE WHEN p_done THEN 'done' ELSE 'open' END,
    done_at = CASE WHEN p_done THEN now() END, done_by = CASE WHEN p_done THEN auth.uid() END,
    done_station = CASE WHEN p_done THEN 'manual' END
  WHERE id = p_task_id;
  INSERT INTO public.prod_events (order_id, action, details)
  VALUES (t.order_id, CASE WHEN p_done THEN 'task_done_manual' ELSE 'task_undone' END,
          jsonb_build_object('task_id', p_task_id, 'location', t.location, 'method', t.method));
END $$;

-- ---------------------------------------------------------------------------
-- Spots, final check, shipping
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prod_add_spot(p_order_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v int;
BEGIN
  PERFORM public.prod__require_staff();
  IF NOT EXISTS (SELECT 1 FROM public.prod_orders WHERE id = p_order_id AND status = 'approved' AND packed_at IS NULL AND shipped_at IS NULL) THEN
    RAISE EXCEPTION 'Order is not in production';
  END IF;
  v := public.prod__free_spot();
  IF v IS NULL THEN RAISE EXCEPTION 'No free spots'; END IF;
  INSERT INTO public.prod_spot_assignments (order_id, spot) VALUES (p_order_id, v);
  INSERT INTO public.prod_events (order_id, action, details) VALUES (p_order_id, 'spot_added', jsonb_build_object('spot', v));
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.prod_release_spot(p_order_id uuid, p_spot int, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.prod__require_staff();
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  UPDATE public.prod_spot_assignments SET released_at = now(), release_reason = trim(p_reason)
  WHERE order_id = p_order_id AND spot = p_spot AND released_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'That spot isn’t assigned to this order'; END IF;
  INSERT INTO public.prod_events (order_id, action, details) VALUES (p_order_id, 'spot_released', jsonb_build_object('spot', p_spot, 'reason', trim(p_reason)));
END $$;

CREATE OR REPLACE FUNCTION public.prod_set_spot_count(p_count int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.prod__require_manager();
  IF p_count IS NULL OR p_count < 1 OR p_count > 200 THEN RAISE EXCEPTION 'Spots must be between 1 and 200'; END IF;
  UPDATE public.prod_settings SET spot_count = p_count, updated_at = now() WHERE id;
  INSERT INTO public.prod_events (action, details) VALUES ('spot_count', jsonb_build_object('count', p_count));
END $$;

-- Final check: every live piece is in its spot. Then the pickup label can print (or the order can be marked shipped).
CREATE OR REPLACE FUNCTION public.prod_final_check(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.prod_orders; p jsonb;
BEGIN
  PERFORM public.prod__require_staff();
  SELECT * INTO o FROM public.prod_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status <> 'approved' THEN RAISE EXCEPTION 'The order is back in review'; END IF;
  p := public.prod__order_progress(p_order_id);
  IF (p->>'garments')::int = 0 OR (p->>'assembled')::int < (p->>'garments')::int THEN
    RAISE EXCEPTION 'Not all pieces are in the spot yet (% of %)', p->>'assembled', p->>'garments';
  END IF;
  IF o.check_passed_at IS NULL THEN
    UPDATE public.prod_orders SET check_passed_at = now(), check_passed_by = auth.uid(), updated_at = now() WHERE id = p_order_id;
    INSERT INTO public.prod_events (order_id, action) VALUES (p_order_id, 'final_check_passed');
  END IF;
  RETURN jsonb_build_object('ok', true, 'pickup_token', o.pickup_token);
END $$;

CREATE OR REPLACE FUNCTION public.prod_mark_shipped(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.prod_orders;
BEGIN
  PERFORM public.prod__require_staff();
  SELECT * INTO o FROM public.prod_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.check_passed_at IS NULL THEN RAISE EXCEPTION 'Final check not done yet'; END IF;
  IF o.shipped_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.prod_orders SET shipped_at = now(), shipped_by = auth.uid(), updated_at = now() WHERE id = p_order_id;
  UPDATE public.prod_spot_assignments SET released_at = now(), release_reason = 'shipped' WHERE order_id = p_order_id AND released_at IS NULL;
  INSERT INTO public.prod_events (order_id, action) VALUES (p_order_id, 'shipped');
END $$;

-- ---------------------------------------------------------------------------
-- Permissions on functions
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.prod__token() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prod__sync_garments(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prod__task_list(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prod__order_progress(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prod__free_spot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prod_mark_labels_printed(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prod_scan(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prod_set_task(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prod_add_spot(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prod_release_spot(uuid, int, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prod_set_spot_count(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prod_final_check(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prod_mark_shipped(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prod_mark_labels_printed(uuid[]), public.prod_scan(text, text, text),
  public.prod_set_task(uuid, boolean), public.prod_add_spot(uuid), public.prod_release_spot(uuid, int, text),
  public.prod_set_spot_count(int), public.prod_final_check(uuid), public.prod_mark_shipped(uuid) TO authenticated;
