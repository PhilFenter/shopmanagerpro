-- Admin-only reset: delete one InkSoft import and every order that came in with it
-- (garments, labels, tasks, table spots, scans). For training and testing.
-- The uploaded PDF/CSV files stay in storage, so the same files can be imported again as new.
CREATE OR REPLACE FUNCTION public.prod_delete_import(p_batch_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.prod_import_batches;
  v_orders uuid[];
  v_numbers text[];
  v_garments int;
  v_scans int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an admin can delete an import' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.prod_import_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import not found'; END IF;

  SELECT coalesce(array_agg(DISTINCT s.order_id), '{}') INTO v_orders
    FROM public.prod_order_sources s WHERE s.batch_id = p_batch_id;
  SELECT coalesce(array_agg(o.order_number ORDER BY o.order_number), '{}') INTO v_numbers
    FROM public.prod_orders o WHERE o.id = ANY(v_orders);
  SELECT count(*) INTO v_garments FROM public.prod_garments WHERE order_id = ANY(v_orders);

  DELETE FROM public.prod_scans
   WHERE order_id = ANY(v_orders)
      OR garment_id IN (SELECT id FROM public.prod_garments WHERE order_id = ANY(v_orders));
  GET DIAGNOSTICS v_scans = ROW_COUNT;

  -- orders cascade to sources, items, sizes, decorations, garments, tasks and spots
  DELETE FROM public.prod_orders WHERE id = ANY(v_orders);
  DELETE FROM public.prod_import_batches WHERE id = p_batch_id;

  INSERT INTO public.prod_events (batch_id, action, details)
  VALUES (p_batch_id, 'import_deleted', jsonb_build_object(
    'file_name', b.file_name, 'orders', to_jsonb(v_numbers), 'garments', v_garments, 'scans', v_scans));

  RETURN jsonb_build_object('orders', cardinality(v_numbers), 'order_numbers', to_jsonb(v_numbers),
                            'garments', v_garments, 'scans', v_scans);
END $$;

REVOKE ALL ON FUNCTION public.prod_delete_import(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prod_delete_import(uuid) TO authenticated;
