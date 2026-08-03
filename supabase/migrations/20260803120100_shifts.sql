-- Planned work shifts, for the two-week schedule page.
--
-- Distinct from time_entries: that table records work actually logged against a
-- specific job (job_id NOT NULL, entered retroactively). A shift is forward-
-- looking intent, not attached to any job, and is what an employee signs up for.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.shifts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id  uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  note       text,
  -- auth.uid() of whoever entered it, which is not always the person working:
  -- a manager can schedule someone else.
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT shifts_end_after_start CHECK (ends_at > starts_at)
);

-- One person cannot be in two places at once. Enforced by the database rather
-- than hoped for by the UI — the client would have to read every existing shift
-- to check this, and would still race against another user doing the same.
ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_no_overlap;
ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_no_overlap
  EXCLUDE USING gist (
    worker_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  );

-- The page always queries one two-week window, filtered on starts_at.
CREATE INDEX IF NOT EXISTS idx_shifts_starts_at ON public.shifts (starts_at);
CREATE INDEX IF NOT EXISTS idx_shifts_worker_id ON public.shifts (worker_id);

DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.shifts;
CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════
-- Everyone sees the whole schedule — that is the point of it. Writes are
-- limited to your own shifts, with admins and managers able to fix anyone's.
--
-- has_role() twice rather than has_financial_access(): that helper does mean
-- admin-or-manager, but its name is about money and reusing it here would
-- conflate "can see pay" with "can manage the schedule".

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view shifts"    ON public.shifts;
DROP POLICY IF EXISTS "Users can create their own shifts"      ON public.shifts;
DROP POLICY IF EXISTS "Users can update their own shifts"      ON public.shifts;
DROP POLICY IF EXISTS "Users can delete their own shifts"      ON public.shifts;

CREATE POLICY "Authenticated users can view shifts"
  ON public.shifts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create their own shifts"
  ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (
    worker_id = public.current_worker_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

CREATE POLICY "Users can update their own shifts"
  ON public.shifts FOR UPDATE TO authenticated
  USING (
    worker_id = public.current_worker_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  WITH CHECK (
    worker_id = public.current_worker_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

CREATE POLICY "Users can delete their own shifts"
  ON public.shifts FOR DELETE TO authenticated
  USING (
    worker_id = public.current_worker_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

-- Table-level grants. Objects created outside Supabase's migration runner do not
-- get these automatically, and RLS alone is not enough — both layers must pass.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;

-- Without this the client's realtime subscription silently never fires.
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
