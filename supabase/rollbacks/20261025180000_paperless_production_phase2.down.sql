-- Rollback for 20261025180000_paperless_production_phase2.sql (run this BEFORE the Phase 1 rollback).
-- Removes garments, tasks, spots, scans and settings, the new order columns, and the new functions,
-- and puts back the Phase 1 versions of prod_approve_order and prod_reopen_order.
-- Imported orders, reviews and approvals from Phase 1 are kept.
BEGIN;
DROP TABLE IF EXISTS public.prod_scans CASCADE;
DROP TABLE IF EXISTS public.prod_tasks CASCADE;
DROP TABLE IF EXISTS public.prod_garments CASCADE;
DROP TABLE IF EXISTS public.prod_spot_assignments CASCADE;
DROP TABLE IF EXISTS public.prod_settings CASCADE;

DROP FUNCTION IF EXISTS public.prod_scan(text, text, text);
DROP FUNCTION IF EXISTS public.prod_set_task(uuid, boolean);
DROP FUNCTION IF EXISTS public.prod_add_spot(uuid);
DROP FUNCTION IF EXISTS public.prod_release_spot(uuid, int, text);
DROP FUNCTION IF EXISTS public.prod_set_spot_count(int);
DROP FUNCTION IF EXISTS public.prod_final_check(uuid);
DROP FUNCTION IF EXISTS public.prod_mark_shipped(uuid);
DROP FUNCTION IF EXISTS public.prod_mark_labels_printed(uuid[]);
DROP FUNCTION IF EXISTS public.prod__sync_garments(uuid);
DROP FUNCTION IF EXISTS public.prod__task_list(uuid);
DROP FUNCTION IF EXISTS public.prod__order_progress(uuid);
DROP FUNCTION IF EXISTS public.prod__free_spot();

ALTER TABLE public.prod_orders
  DROP COLUMN IF EXISTS pickup_token,
  DROP COLUMN IF EXISTS check_passed_at,
  DROP COLUMN IF EXISTS check_passed_by,
  DROP COLUMN IF EXISTS packed_at,
  DROP COLUMN IF EXISTS packed_by,
  DROP COLUMN IF EXISTS shipped_at,
  DROP COLUMN IF EXISTS shipped_by;
DROP FUNCTION IF EXISTS public.prod__token();

-- Phase 1 versions
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
COMMIT;
