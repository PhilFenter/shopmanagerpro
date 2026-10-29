// Runs Phase 1 + Phase 2 migrations in PGlite and walks orders through labels, station scans,
// table spots, final check, packing and shipping, plus corrections after labels are printed.
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseWorkOrders } from './inksoftParser';
import { buildImportPayload } from './importPayload';
import { DEFAULT_METHOD_RULES } from './methods';
import type { PdfData } from './pdfTypes';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const phase1 = read('supabase/migrations/20261025120000_paperless_production_phase1.sql');
const phase2 = read('supabase/migrations/20261025180000_paperless_production_phase2.sql');
const deleteImport = read('supabase/migrations/20261029120000_prod_delete_import.sql');
const rollback1 = read('supabase/rollbacks/20261025120000_paperless_production_phase1.down.sql');
const rollback2 = read('supabase/rollbacks/20261025180000_paperless_production_phase2.down.sql');
const fixture = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', `${n}.json`), 'utf8')) as PdfData;

const SUPABASE_STUB = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'team');
CREATE TABLE public.user_roles (user_id uuid NOT NULL, role app_role NOT NULL);
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
`;

const MANAGER = '00000000-0000-0000-0000-00000000000a';
const STATION = '00000000-0000-0000-0000-00000000000b';
const NOBODY = '00000000-0000-0000-0000-00000000000c';

let db: PGlite;
let scanN = 0;

async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.query('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    await db.query('SET LOCAL ROLE authenticated');
    const r = await db.query<T>(sql, params);
    await db.query('COMMIT');
    return r.rows;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}
const one = async <T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []) => (await as<T>(uid, sql, params))[0];

interface ScanResult {
  ok: boolean; kind: string; message?: string; spot?: number; repeat?: boolean; complete?: boolean;
  done?: string[]; still_open?: string[];
  progress?: { garments: number; assembled: number; spots: number[] };
  garment?: { code: string };
}
const scan = async (code: string, station: string, id = `scan-${++scanN}`, uid = STATION) =>
  (await one<{ r: ScanResult }>(uid, `SELECT prod_scan($1, $2, $3) AS r`, [code, station, id])).r;

async function importAndApprove(name: string, sha: string) {
  const payload = await buildImportPayload(parseWorkOrders(fixture(name)), DEFAULT_METHOD_RULES, null);
  const b = await one<{ r: { batch_id: string } }>(MANAGER, `SELECT prod_create_batch($1,$2,$3,$4) AS r`, [`${name}.pdf`, `pdf/${sha}.pdf`, sha, 1]);
  await as(MANAGER, `SELECT prod_save_extraction($1, $2::jsonb)`, [b.r.batch_id, JSON.stringify(payload)]);
  const orders = (await db.query<{ id: string; order_number: string; current_revision: number; status: string }>(
    `SELECT id, order_number, current_revision, status FROM prod_orders WHERE order_number = ANY($1)`,
    [payload.orders.map((o: { order_number: string }) => o.order_number)])).rows;
  for (const o of orders) {
    if (o.status !== 'review') continue;
    const r = await one<{ r: { ok: boolean; blockers?: string[] } }>(MANAGER, `SELECT prod_approve_order($1, $2) AS r`, [o.id, o.current_revision]);
    expect(r.r, `${o.order_number}: ${JSON.stringify(r.r.blockers)}`).toMatchObject({ ok: true });
  }
  return orders;
}

const garments = async (orderNumber: string) =>
  (await db.query<{ id: string; seq: number; token: string; size: string; voided_at: string | null; item_index: number }>(
    `SELECT g.id, g.seq, g.token, g.size, g.voided_at, g.item_index FROM prod_garments g JOIN prod_orders o ON o.id = g.order_id
     WHERE o.order_number = $1 ORDER BY g.seq`, [orderNumber])).rows;
const tasks = async (orderNumber: string) =>
  (await db.query<{ garment_id: string; method: string; location: string; status: string }>(
    `SELECT t.garment_id, t.method, t.location, t.status FROM prod_tasks t JOIN prod_garments g ON g.id = t.garment_id
     JOIN prod_orders o ON o.id = g.order_id WHERE o.order_number = $1`, [orderNumber])).rows;
const orderRow = async (n: string) =>
  (await db.query<{ id: string; pickup_token: string; current_revision: number; check_passed_at: string | null; packed_at: string | null }>(
    `SELECT id, pickup_token, current_revision, check_passed_at, packed_at FROM prod_orders WHERE order_number = $1`, [n])).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(phase1);
  await db.exec(`INSERT INTO user_roles VALUES ('${MANAGER}', 'manager'), ('${STATION}', 'team')`);
  // an order approved before Phase 2 exists gets its garments from the back-fill
  await importAndApprove('workorder-1002714', 'sha-A');
  await db.exec(phase2);
  await db.exec(deleteImport);
}, 60_000);

describe('Phase 2: garments, labels, scanning, spots', () => {
  it('Test A: approval made 5 garments (labels) and 6 tasks; IDs carry no order data', async () => {
    const g = await garments('1002714');
    expect(g.map((x) => x.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(g.map((x) => x.token)).size).toBe(5);
    for (const x of g) expect(x.token).toMatch(/^[2-9A-HJKMNP-Z]{12}$/);
    const t = await tasks('1002714');
    expect(t).toHaveLength(6);
    expect(t.filter((x) => x.method === 'dtf')).toHaveLength(2);
    expect(t.filter((x) => x.method === 'embroidery')).toHaveLength(4);
    expect((await orderRow('1002714')).pickup_token).toMatch(/^[2-9A-HJKMNP-Z]{12}$/);
  });

  it('Test B: 10 more garments and 15 tasks', async () => {
    await importAndApprove('workorders-5', 'sha-B');
    const n = await db.query<{ g: number; t: number }>(
      `SELECT (SELECT count(*)::int FROM prod_garments g JOIN prod_orders o ON o.id=g.order_id WHERE o.order_number <> '1002714') g,
              (SELECT count(*)::int FROM prod_tasks t JOIN prod_garments g ON g.id=t.garment_id JOIN prod_orders o ON o.id=g.order_id WHERE o.order_number <> '1002714') t`);
    expect(n.rows[0]).toEqual({ g: 10, t: 15 });
  });

  it('only signed-in staff can scan; nobody can write the tables directly', async () => {
    await expect(scan('X', 'dtf', 'nobody-1', NOBODY)).rejects.toThrow(/Not allowed/);
    await expect(as(STATION, `UPDATE prod_tasks SET status = 'done'`)).rejects.toThrow(/permission denied/);
    await expect(as(STATION, `INSERT INTO prod_spot_assignments (order_id, spot) SELECT id, 1 FROM prod_orders LIMIT 1`)).rejects.toThrow(/permission denied/);
  });

  it('labels: marking printed counts each piece once', async () => {
    const ids = (await garments('1002714')).map((g) => g.id);
    expect((await one<{ n: number }>(STATION, `SELECT prod_mark_labels_printed($1::uuid[]) AS n`, [ids])).n).toBe(5);
    expect((await one<{ n: number }>(STATION, `SELECT prod_mark_labels_printed($1::uuid[]) AS n`, [ids])).n).toBe(0);
  });

  it('station scans complete only that station’s work, and never twice', async () => {
    const g = await garments('1002714');
    const t = await tasks('1002714');
    const withDtf = g.find((x) => t.some((y) => y.garment_id === x.id && y.method === 'dtf'))!;
    const url = `https://app.example.com/g/${withDtf.token}`;

    const r1 = await scan(url, 'dtf', 'dup-1');
    expect(r1).toMatchObject({ ok: true, kind: 'done' });
    // scanner double-fires: same scan id → same answer, nothing new
    expect(await scan(url, 'dtf', 'dup-1')).toMatchObject({ kind: 'done', repeat: true });
    // scanned again later
    expect(await scan(url, 'dtf')).toMatchObject({ ok: true, kind: 'already' });
    // wrong station
    const embOnly = g.find((x) => !t.some((y) => y.garment_id === x.id && y.method === 'dtf'))!;
    expect(await scan(embOnly.token, 'dtf')).toMatchObject({ ok: false, kind: 'not_here' });
    const done = (await tasks('1002714')).filter((x) => x.status === 'done');
    expect(done.length).toBe((r1.done ?? []).length);
  });

  it('assembly refuses unfinished pieces, then gives every piece of an order the same spot', async () => {
    const g = await garments('1002714');
    const t = await tasks('1002714');
    const unfinished = g.find((x) => t.some((y) => y.garment_id === x.id && y.status === 'open'))!;
    expect(await scan(unfinished.token, 'assembly')).toMatchObject({ ok: false, kind: 'not_finished' });

    for (const x of g) {
      await scan(x.token, 'dtf');
      await scan(x.token, 'embroidery');
    }
    const results: ScanResult[] = [];
    for (const x of g) results.push(await scan(x.token, 'assembly'));
    expect(results.every((r) => r.ok && r.kind === 'assembled' && r.spot === 1)).toBe(true);
    expect(results[4]).toMatchObject({ complete: true, progress: { garments: 5, assembled: 5 } });
    // counted already
    expect(await scan(g[0].token, 'assembly')).toMatchObject({ kind: 'already', spot: 1 });
    // short code typed by hand works too
    expect(await scan('1002714-02', 'assembly')).toMatchObject({ kind: 'already', spot: 1 });
  });

  it('a second order gets the next free spot; full spots are refused', async () => {
    const g = await garments('1002747');
    for (const x of g) { await scan(x.token, 'dtf'); await scan(x.token, 'embroidery'); }
    expect(await scan(g[0].token, 'assembly')).toMatchObject({ kind: 'assembled', spot: 2 });

    await as(MANAGER, `SELECT prod_set_spot_count(2)`);
    const h = await garments('1002748');
    for (const x of h) { await scan(x.token, 'dtf'); await scan(x.token, 'embroidery'); }
    expect(await scan(h[0].token, 'assembly')).toMatchObject({ ok: false, kind: 'no_spot' });
    await expect(as(STATION, `SELECT prod_set_spot_count(30)`)).rejects.toThrow(/manager/);
    await as(MANAGER, `SELECT prod_set_spot_count(20)`);
    expect(await scan(h[0].token, 'assembly')).toMatchObject({ kind: 'assembled', spot: 3 });
  });

  it('pickup: final check, then the pickup label scan packs it and frees the spot', async () => {
    const o = await orderRow('1002714');
    expect(await scan(`https://app.example.com/p/${o.pickup_token}`, 'pack')).toMatchObject({ ok: false, kind: 'not_checked' });
    await expect(as(STATION, `SELECT prod_final_check($1)`, [(await orderRow('1002747')).id])).rejects.toThrow(/Not all pieces/);
    await as(STATION, `SELECT prod_final_check($1)`, [o.id]);
    expect(await scan(`https://app.example.com/p/${o.pickup_token}`, 'pack')).toMatchObject({ ok: true, kind: 'packed' });
    expect(await scan(o.pickup_token, 'pack')).toMatchObject({ kind: 'already' });
    const free = await db.query(`SELECT 1 FROM prod_spot_assignments WHERE spot = 1 AND released_at IS NULL`);
    expect(free.rows).toHaveLength(0);
    await expect(as(MANAGER, `SELECT prod_reopen_order($1, 'x')`, [o.id])).rejects.toThrow(/packed or shipped/);
  });

  it('shipping: mark shipped after the final check, no pickup label needed', async () => {
    const o = await orderRow('1002748');
    await expect(as(STATION, `SELECT prod_mark_shipped($1)`, [o.id])).rejects.toThrow(/Final check/);
    const g = await garments('1002748');
    for (const x of g) await scan(x.token, 'assembly');
    await as(STATION, `SELECT prod_final_check($1)`, [o.id]);
    await as(STATION, `SELECT prod_mark_shipped($1)`, [o.id]);
    expect((await db.query(`SELECT 1 FROM prod_spot_assignments WHERE order_id = $1 AND released_at IS NULL`, [o.id])).rows).toHaveLength(0);
  });

  it('correcting an order after labels: pieces are kept, extras voided, new ones get new numbers', async () => {
    const n = '1002750';
    const before = await garments(n);
    const o = await orderRow(n);
    await as(MANAGER, `SELECT prod_reopen_order($1, 'customer changed size')`, [o.id]);
    // while in review, its pieces are on hold
    expect(await scan(before[0].token, 'dtf')).toMatchObject({ ok: false, kind: 'on_hold' });

    const sz = (await db.query<{ id: string; quantity: number; size: string }>(
      `SELECT s.id, s.quantity, s.size FROM prod_item_sizes s JOIN prod_order_items i ON i.id = s.item_id WHERE i.order_id = $1 ORDER BY i.item_index, s.seq`, [o.id])).rows;
    await as(MANAGER, `SELECT prod_update_size($1, $2)`, [sz[0].id, sz[0].quantity + 1]);
    const r = await one<{ r: { ok: boolean; garments: { added: number; voided: number } } }>(
      MANAGER, `SELECT prod_approve_order($1, $2) AS r`, [o.id, o.current_revision]);
    expect(r.r.garments).toMatchObject({ added: 1, voided: 0 });
    const after = await garments(n);
    expect(after.slice(0, before.length).map((g) => g.token)).toEqual(before.map((g) => g.token)); // printed labels still valid
    expect(after.at(-1)!.seq).toBe(before.length + 1);

    await as(MANAGER, `SELECT prod_reopen_order($1, 'back to original')`, [o.id]);
    await as(MANAGER, `SELECT prod_update_size($1, $2)`, [sz[0].id, sz[0].quantity]);
    const r2 = await one<{ r: { garments: { added: number; voided: number } } }>(
      MANAGER, `SELECT prod_approve_order($1, $2) AS r`, [o.id, o.current_revision]);
    expect(r2.r.garments).toMatchObject({ added: 0, voided: 1 });
    const voided = (await garments(n)).filter((g) => g.voided_at);
    expect(voided).toHaveLength(1);
    expect(await scan(voided[0].token, 'dtf')).toMatchObject({ ok: false, kind: 'voided' });
    // its open tasks don't block anything
    const live = await db.query<{ n: number }>(
      `SELECT count(*)::int n FROM prod_tasks t WHERE t.garment_id = $1 AND t.status = 'open'`, [voided[0].id]);
    expect(live.rows[0].n).toBe(0);
  });

  it('undo a mistaken scan; not after the piece is in its spot', async () => {
    const g = await garments('1002751');
    await scan(g[0].token, 'embroidery');
    await scan(g[0].token, 'dtf');
    const t = (await db.query<{ id: string }>(`SELECT id FROM prod_tasks WHERE garment_id = $1 AND status = 'done' LIMIT 1`, [g[0].id])).rows[0];
    await as(STATION, `SELECT prod_set_task($1, false)`, [t.id]);
    expect((await db.query<{ status: string }>(`SELECT status FROM prod_tasks WHERE id = $1`, [t.id])).rows[0].status).toBe('open');
    await as(STATION, `SELECT prod_set_task($1, true)`, [t.id]);
    await scan(g[0].token, 'assembly');
    await expect(as(STATION, `SELECT prod_set_task($1, false)`, [t.id])).rejects.toThrow(/already in its spot/);
  });

  it('unknown labels are reported, not guessed', async () => {
    expect(await scan('HELLO', 'assembly')).toMatchObject({ ok: false, kind: 'unknown' });
    expect(await scan('ABCDEFGHJKMN', 'assembly')).toMatchObject({ ok: false, kind: 'unknown' });
  });

  it('the check query in the docs returns 5 | 1 | 0', async () => {
    const doc = read('docs/PAPERLESS-PRODUCTION.md');
    const sql = doc.split('Check query')[1].split('```sql')[1].split('```')[0];
    expect((await db.query(sql)).rows[0]).toEqual({ tables: 5, settings_rows: 1, missing_functions: 0 });
  });

  it('admin reset: deleting an import removes its orders, garments and scans; the file can be imported again', async () => {
    const ADMIN = '00000000-0000-0000-0000-0000000000ad';
    await db.exec(`INSERT INTO user_roles VALUES ('${ADMIN}', 'admin')`);
    const orders = await importAndApprove('workorders-3', 'sha-reset');
    const nums = orders.map((o) => o.order_number);
    const g = await garments(nums[0]);
    expect(g.length).toBeGreaterThan(0);
    await scan(g[0].token, 'dtf');
    const batch = (await db.query<{ id: string }>(`SELECT id FROM prod_import_batches WHERE file_sha256 = 'sha-reset'`)).rows[0];
    const otherOrders = (await db.query(`SELECT 1 FROM prod_orders WHERE NOT (order_number = ANY($1))`, [nums])).rows.length;

    await expect(as(MANAGER, `SELECT prod_delete_import($1)`, [batch.id])).rejects.toThrow(/Only an admin/);
    await expect(as(STATION, `SELECT prod_delete_import($1)`, [batch.id])).rejects.toThrow(/Only an admin/);
    await expect(as(STATION, `DELETE FROM prod_orders`)).rejects.toThrow();

    const r = await one<{ r: { orders: number; garments: number; scans: number } }>(ADMIN, `SELECT prod_delete_import($1) AS r`, [batch.id]);
    expect(r.r.orders).toBe(nums.length);
    expect(r.r.scans).toBeGreaterThan(0);
    expect((await db.query(`SELECT 1 FROM prod_orders WHERE order_number = ANY($1)`, [nums])).rows).toHaveLength(0);
    expect((await db.query(`SELECT 1 FROM prod_garments WHERE id = $1`, [g[0].id])).rows).toHaveLength(0);
    expect((await db.query(`SELECT 1 FROM prod_scans WHERE garment_id = $1`, [g[0].id])).rows).toHaveLength(0);
    expect((await db.query(`SELECT 1 FROM prod_orders WHERE NOT (order_number = ANY($1))`, [nums])).rows.length).toBe(otherOrders);
    expect((await db.query(`SELECT 1 FROM prod_events WHERE action = 'import_deleted'`)).rows).toHaveLength(1);
    // old label no longer scans as a garment
    expect(await scan(g[0].token, 'dtf')).toMatchObject({ ok: false });

    const again = await importAndApprove('workorders-3', 'sha-reset');
    expect(again.map((o) => o.order_number).sort()).toEqual([...nums].sort());
    expect((await garments(nums[0]))[0].token).not.toBe(g[0].token);
  });

  it('rollback: Phase 2 then Phase 1 leave nothing behind', async () => {
    await db.exec(read('supabase/rollbacks/20261029120000_prod_delete_import.down.sql'));
    await db.exec(rollback2);
    expect((await db.query(`SELECT 1 FROM pg_tables WHERE tablename IN ('prod_garments','prod_tasks','prod_scans')`)).rows).toHaveLength(0);
    expect((await db.query(`SELECT 1 FROM prod_orders`)).rows.length).toBeGreaterThan(0);
    await db.exec(rollback1);
    expect((await db.query(`SELECT 1 FROM pg_tables WHERE tablename LIKE 'prod\\_%'`)).rows).toHaveLength(0);
    expect((await db.query(`SELECT 1 FROM pg_proc WHERE proname LIKE 'prod\\_%'`)).rows).toHaveLength(0);
  });
});
