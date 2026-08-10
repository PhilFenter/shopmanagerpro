-- Adding a shift that touches one you already have merges the two, instead of
-- being rejected by the shifts_no_overlap exclusion constraint.
--
-- Dragging across the grid is the main way people add hours, and dragging over
-- a block you already own is a completely reasonable thing to do — it means
-- "extend this". Previously it raised a constraint violation and the employee
-- just saw an error. Overlapping a *different* person is untouched: several
-- people working the same hours is normal and always was allowed.
--
-- Done in one function so the delete and the insert cannot half-apply. Doing it
-- from the client would be three round trips with no transaction, and a failure
-- between them would delete someone's shift and put nothing back.

CREATE OR REPLACE FUNCTION public.upsert_shift(
  p_worker_id uuid,
  p_starts_at timestamptz,
  p_ends_at   timestamptz,
  p_note      text DEFAULT NULL
)
RETURNS public.shifts
LANGUAGE plpgsql
-- SECURITY INVOKER on purpose: the caller's own RLS policies must still decide
-- whether they may write this worker's shifts. A definer function here would
-- let any signed-in user schedule anyone.
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
  v_note  text;
  v_row   public.shifts;
BEGIN
  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'end time must be after start time';
  END IF;

  -- Absorb this worker's shifts that overlap OR merely touch the new range, so
  -- 8-10 followed by 10-12 becomes one 8-12 block rather than two abutting ones.
  SELECT least(min(s.starts_at), p_starts_at),
         greatest(max(s.ends_at), p_ends_at),
         min(s.note) FILTER (WHERE s.note IS NOT NULL)
    INTO v_start, v_end, v_note
    FROM public.shifts s
   WHERE s.worker_id = p_worker_id
     AND (
       tstzrange(s.starts_at, s.ends_at) && tstzrange(p_starts_at, p_ends_at)
       OR tstzrange(s.starts_at, s.ends_at) -|- tstzrange(p_starts_at, p_ends_at)
     );

  DELETE FROM public.shifts s
   WHERE s.worker_id = p_worker_id
     AND (
       tstzrange(s.starts_at, s.ends_at) && tstzrange(p_starts_at, p_ends_at)
       OR tstzrange(s.starts_at, s.ends_at) -|- tstzrange(p_starts_at, p_ends_at)
     );

  INSERT INTO public.shifts (worker_id, starts_at, ends_at, note, created_by)
  VALUES (
    p_worker_id,
    coalesce(v_start, p_starts_at),
    coalesce(v_end, p_ends_at),
    coalesce(p_note, v_note),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_shift(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_shift(uuid, timestamptz, timestamptz, text) TO authenticated, service_role;
