// Runs supabase/migrations/20261111180000_staff_only_access.sql in an in-memory
// Postgres (PGlite) against copies of the live policies, then checks who can do what:
// staff, a stranger who signed up (no role), and a signed-out website visitor.
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261111180000_staff_only_access.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(root, 'supabase/rollbacks/20261111180000_staff_only_access.down.sql'), 'utf8');

const ADMIN = '00000000-0000-0000-0000-00000000000a';
const STAFF = '00000000-0000-0000-0000-00000000000b';
const STRANGER = '00000000-0000-0000-0000-00000000000c';

// Minimal stand-ins for what Supabase provides, plus the live definitions this
// migration touches (handle_new_user, representative table policies, and all 19
// storage policies copied verbatim from the live database on 2026-11-11).
const SETUP = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'team');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role app_role NOT NULL, UNIQUE (user_id, role));
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE FUNCTION public.has_financial_access(_user_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'manager')) $$;
CREATE FUNCTION public.prod_is_staff() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) $$;
CREATE FUNCTION public.prod_is_manager() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_financial_access(auth.uid()) $$;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Sign-up trigger as it is live today (migration 20260504153646)
CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, full_name text);
CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb);
CREATE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'team'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Representative table policies (same shapes as the 71 live "signed in" policies)
CREATE TABLE public.jobs (id serial PRIMARY KEY, customer_name text);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view jobs" ON public.jobs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update jobs" ON public.jobs FOR UPDATE
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete jobs" ON public.jobs FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE TABLE public.notification_settings (stage text PRIMARY KEY);
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view notification settings" ON public.notification_settings
  FOR SELECT TO authenticated USING (true);
CREATE TABLE public.time_entries (id serial PRIMARY KEY, user_id uuid);
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own time entries" ON public.time_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Storage
CREATE SCHEMA storage;
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:cardinality(string_to_array(name, '/')) - 1] $$;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
CREATE POLICY "Admins can delete job photos" ON storage.objects FOR DELETE TO public
  USING ((bucket_id = 'job-photos') AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete production files" ON storage.objects FOR DELETE TO authenticated
  USING ((bucket_id = 'production-files') AND has_financial_access(auth.uid()));
CREATE POLICY "Authenticated users can delete artwork" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'quote-artwork');
CREATE POLICY "Authenticated users can delete sop media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sop-media');
CREATE POLICY "Authenticated users can read quote-artwork" ON storage.objects FOR SELECT TO public
  USING ((bucket_id = 'quote-artwork') AND (auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can update artwork" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'quote-artwork');
CREATE POLICY "Authenticated users can update their uploads" ON storage.objects FOR UPDATE TO public
  USING ((bucket_id = 'job-photos') AND (auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can upload artwork" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quote-artwork');
CREATE POLICY "Authenticated users can upload job photos" ON storage.objects FOR INSERT TO public
  WITH CHECK ((bucket_id = 'job-photos') AND (auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can upload sop media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sop-media');
CREATE POLICY "Authenticated users can upload to quote-artwork" ON storage.objects FOR INSERT TO public
  WITH CHECK ((bucket_id = 'quote-artwork') AND (auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can view job photos" ON storage.objects FOR SELECT TO public
  USING ((bucket_id = 'job-photos') AND (auth.uid() IS NOT NULL));
CREATE POLICY "Public can upload quote artwork" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK ((bucket_id = 'quote-artwork') AND (array_length(storage.foldername(name), 1) = 1));
CREATE POLICY "Public read access for sop media" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'sop-media');
CREATE POLICY "Signed-in users can read production files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'production-files');
CREATE POLICY "Signed-in users can update production files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'production-files');
CREATE POLICY "Signed-in users can upload production files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'production-files');
CREATE POLICY "production-imports manager upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'production-imports') AND prod_is_manager());
CREATE POLICY "production-imports staff read" ON storage.objects FOR SELECT TO authenticated
  USING ((bucket_id = 'production-imports') AND prod_is_staff());

-- Data
INSERT INTO public.user_roles (user_id, role) VALUES ('${ADMIN}', 'admin'), ('${STAFF}', 'team');
INSERT INTO public.jobs (customer_name) VALUES ('Acme'), ('Globex');
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('job-photos', 'job-1/front.jpg'), ('quote-artwork', 'web/logo.png'), ('sop-media', 'sop-1/step.png');
`;

const LOOSE = `
  SELECT count(*)::int AS n FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual IN ('true', '(auth.uid() IS NOT NULL)') OR with_check IN ('true', '(auth.uid() IS NOT NULL)'))`;

async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SETUP);
  return db;
}

/** Run SQL the way PostgREST does: as `authenticated` with a user id, or as `anon` when uid is null. */
async function as<T = Record<string, unknown>>(db: PGlite, uid: string | null, sql: string): Promise<T[]> {
  await db.query('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    await db.query(uid ? 'SET LOCAL ROLE authenticated' : 'SET LOCAL ROLE anon');
    const r = await db.query<T>(sql);
    await db.query('COMMIT');
    return r.rows;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}
const count = async (db: PGlite, uid: string | null, sql: string) =>
  ((await as<{ n: number }>(db, uid, `SELECT count(*)::int AS n FROM (${sql}) q`))[0]).n;

describe('staff-only access migration', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDb();
    expect((await db.query<{ n: number }>(LOOSE)).rows[0].n).toBe(4);
    await db.exec(migration);
  });

  it('leaves no table policy that lets any signed-in user through', async () => {
    expect((await db.query<{ n: number }>(LOOSE)).rows[0].n).toBe(0);
  });

  it('keeps own-row and role-based policies exactly as they were', async () => {
    const rows = (await db.query<{ policyname: string; qual: string }>(
      `SELECT policyname, qual FROM pg_policies WHERE policyname IN
       ('Users can update their own time entries', 'Admins can delete jobs', 'Users can view their own roles')
       ORDER BY policyname`,
    )).rows;
    expect(rows.map((r) => r.qual)).toEqual([
      "has_role(auth.uid(), 'admin'::app_role)",
      '(auth.uid() = user_id)',
      '(auth.uid() = user_id)',
    ]);
  });

  it('lets staff keep reading and writing', async () => {
    expect(await count(db, STAFF, 'SELECT * FROM public.jobs')).toBe(2);
    await as(db, STAFF, `INSERT INTO public.jobs (customer_name) VALUES ('Initech')`);
    expect(await count(db, STAFF, 'SELECT * FROM public.jobs')).toBe(3);
    expect(await count(db, ADMIN, 'SELECT * FROM public.notification_settings')).toBe(0); // allowed, just empty
  });

  it('gives a stranger who signed up nothing', async () => {
    expect(await count(db, STRANGER, 'SELECT * FROM public.jobs')).toBe(0);
    await expect(as(db, STRANGER, `INSERT INTO public.jobs (customer_name) VALUES ('x')`)).rejects.toThrow(/row-level security/);
    await as(db, STRANGER, `UPDATE public.jobs SET customer_name = 'hacked'`);
    expect(await count(db, STAFF, `SELECT * FROM public.jobs WHERE customer_name = 'hacked'`)).toBe(0);
  });

  it('gives signed-out visitors nothing', async () => {
    expect(await count(db, null, 'SELECT * FROM public.jobs')).toBe(0);
  });

  it('still lets everyone read their own role, which sign-in needs', async () => {
    expect(await count(db, STAFF, 'SELECT * FROM public.user_roles')).toBe(1);
    expect(await count(db, STRANGER, 'SELECT * FROM public.user_roles')).toBe(0);
  });

  it('gives new sign-ups a profile but no role', async () => {
    const id = '00000000-0000-0000-0000-0000000000dd';
    await db.query(`INSERT INTO auth.users (id, raw_user_meta_data) VALUES ($1, '{"full_name":"New Hire"}')`, [id]);
    expect((await db.query('SELECT 1 FROM public.profiles WHERE user_id = $1', [id])).rows).toHaveLength(1);
    expect((await db.query('SELECT 1 FROM public.user_roles WHERE user_id = $1', [id])).rows).toHaveLength(0);
  });

  it("still accepts the website's anonymous artwork upload", async () => {
    await as(db, null, `INSERT INTO storage.objects (bucket_id, name) VALUES ('quote-artwork', 'web/new-request.png')`);
    await expect(
      as(db, null, `INSERT INTO storage.objects (bucket_id, name) VALUES ('quote-artwork', 'a/b/deep.png')`),
    ).rejects.toThrow(/row-level security/);
  });

  it('keeps strangers out of job photos and artwork', async () => {
    expect(await count(db, STRANGER, `SELECT * FROM storage.objects WHERE bucket_id = 'job-photos'`)).toBe(0);
    await as(db, STRANGER, `DELETE FROM storage.objects WHERE bucket_id = 'quote-artwork'`);
    expect((await db.query(`SELECT 1 FROM storage.objects WHERE name = 'web/logo.png'`)).rows).toHaveLength(1);
    await expect(
      as(db, STRANGER, `INSERT INTO storage.objects (bucket_id, name) VALUES ('job-photos', 'job-1/x.jpg')`),
    ).rejects.toThrow(/row-level security/);
  });

  it('lets staff keep using files, and keeps public SOP media public', async () => {
    expect(await count(db, STAFF, `SELECT * FROM storage.objects WHERE bucket_id = 'job-photos'`)).toBe(1);
    await as(db, STAFF, `INSERT INTO storage.objects (bucket_id, name) VALUES ('quote-artwork', 'staff/deep/x.png')`);
    expect(await count(db, null, `SELECT * FROM storage.objects WHERE bucket_id = 'sop-media'`)).toBe(1);
  });
});

describe('staff-only access rollback', () => {
  it('restores the old behavior, and the migration can then be applied again', async () => {
    const db = await freshDb();
    const before = (await db.query(`SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'storage' ORDER BY policyname`)).rows;
    await db.exec(migration);
    await db.exec(rollback);

    expect((await db.query<{ n: number }>(LOOSE)).rows[0].n).toBe(4);
    expect(await count(db, STRANGER, 'SELECT * FROM public.jobs')).toBe(2);
    const after = (await db.query(`SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'storage' ORDER BY policyname`)).rows;
    expect(after).toEqual(before);
    await db.query(`INSERT INTO auth.users (id, raw_user_meta_data) VALUES ('00000000-0000-0000-0000-0000000000ee', '{}')`);
    expect((await db.query(`SELECT role FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000000ee'`)).rows)
      .toEqual([{ role: 'team' }]);
    expect((await db.query(`SELECT 1 FROM pg_proc WHERE proname = 'is_staff'`)).rows).toHaveLength(0);

    await db.exec(migration);
    expect((await db.query<{ n: number }>(LOOSE)).rows[0].n).toBe(0);
  });
});
