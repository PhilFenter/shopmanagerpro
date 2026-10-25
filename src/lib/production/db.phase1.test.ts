// Runs the Phase 1 migration in an in-memory Postgres (PGlite) and checks the import,
// duplicate, revision, approval, permission, CSV and transfer-list rules end to end.
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseWorkOrders } from './inksoftParser';
import { buildImportPayload } from './importPayload';
import { DEFAULT_METHOD_RULES } from './methods';
import { buildTransferList, type TransferSourceDecoration } from './transfers';
import { parseInkSoftOrdersCsv } from './inksoftCsv';
import type { PdfData } from './pdfTypes';

const root = path.resolve(__dirname, '../../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261025120000_paperless_production_phase1.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(root, 'supabase/rollbacks/20261025120000_paperless_production_phase1.down.sql'), 'utf8');
const fixture = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', `${n}.json`), 'utf8')) as PdfData;

// Minimal stand-ins for what Supabase provides.
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
const TEAM = '00000000-0000-0000-0000-00000000000b';
const NOBODY = '00000000-0000-0000-0000-00000000000c';

let db: PGlite;

/** Run SQL as a signed-in user, the way PostgREST does. */
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

async function importFixture(name: string, sha: string, csvText?: string, mutate?: (p: Awaited<ReturnType<typeof buildImportPayload>>) => void) {
  const parsed = parseWorkOrders(fixture(name));
  const csv = csvText ? parseInkSoftOrdersCsv(csvText).orders : null;
  const payload = await buildImportPayload(parsed, DEFAULT_METHOD_RULES, csv);
  mutate?.(payload);
  const b = await one<{ r: { batch_id: string; existing: boolean } }>(MANAGER, `SELECT prod_create_batch($1,$2,$3,$4) AS r`, [
    `${name}.pdf`, `pdf/${sha}.pdf`, sha, fixture(name).pages.length,
  ]);
  if (b.r.existing) return { batch: b.r, results: null };
  const res = await one<{ r: { order_number: string; outcome: string; revision: number }[] }>(
    MANAGER, `SELECT prod_save_extraction($1, $2::jsonb) AS r`, [b.r.batch_id, JSON.stringify(payload)],
  );
  return { batch: b.r, results: res.r };
}

async function orderId(n: string) {
  return (await db.query<{ id: string }>(`SELECT id FROM prod_orders WHERE order_number = $1`, [n])).rows[0].id;
}

async function counts(orderNumbers: string[]) {
  const r = await db.query<{ garments: number; tasks: number }>(
    `SELECT
       (SELECT coalesce(sum(s.quantity),0)::int FROM prod_item_sizes s JOIN prod_order_items i ON i.id=s.item_id JOIN prod_orders o ON o.id=i.order_id WHERE o.order_number = ANY($1)) AS garments,
       (SELECT coalesce(sum(q.n * d.c),0)::int FROM prod_order_items i JOIN prod_orders o ON o.id=i.order_id
          JOIN LATERAL (SELECT coalesce(sum(quantity),0) n FROM prod_item_sizes WHERE item_id=i.id) q ON true
          JOIN LATERAL (SELECT count(*) c FROM prod_item_decorations WHERE item_id=i.id) d ON true
        WHERE o.order_number = ANY($1)) AS tasks`,
    [orderNumbers],
  );
  return r.rows[0];
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(migration);
  await db.exec(`INSERT INTO user_roles VALUES ('${MANAGER}', 'manager'), ('${TEAM}', 'team')`);
}, 60_000);

describe('Phase 1 database rules', () => {
  it('only managers can import', async () => {
    await expect(as(TEAM, `SELECT prod_create_batch('x.pdf','pdf/x.pdf','sha-x',1)`)).rejects.toThrow(/manager or admin/);
    await expect(as(NOBODY, `SELECT prod_create_batch('x.pdf','pdf/x.pdf','sha-x',1)`)).rejects.toThrow(/manager or admin/);
  });

  it('Test A: 1 order, 5 garments, 6 decoration tasks, methods from the rules', async () => {
    const { results } = await importFixture('workorder-1002714', 'sha-A');
    expect(results).toEqual([expect.objectContaining({ order_number: '1002714', outcome: 'new', revision: 1 })]);
    expect(await counts(['1002714'])).toEqual({ garments: 5, tasks: 6 });
    const m = await db.query<{ method_inksoft: string; method_production: string; n: number }>(
      `SELECT method_inksoft, method_production, count(*)::int n FROM prod_item_decorations GROUP BY 1,2 ORDER BY 1`);
    expect(m.rows).toEqual([
      { method_inksoft: 'DigitalPrint', method_production: 'dtf', n: 2 },
      { method_inksoft: 'Embroidery', method_production: 'embroidery', n: 4 },
    ]);
  });

  it('the same file twice creates nothing new', async () => {
    const again = await importFixture('workorder-1002714', 'sha-A');
    expect(again.batch.existing).toBe(true);
    expect((await db.query(`SELECT * FROM prod_import_batches`)).rows).toHaveLength(1);
    expect((await db.query(`SELECT * FROM prod_orders`)).rows).toHaveLength(1);
  });

  it('a fresh download of the same order is recognised as unchanged', async () => {
    const { results } = await importFixture('workorder-1002714', 'sha-A2');
    expect(results?.[0].outcome).toBe('unchanged');
    expect(await counts(['1002714'])).toEqual({ garments: 5, tasks: 6 });
  });

  it('browser users cannot write tables directly; read needs a role', async () => {
    await expect(as(MANAGER, `INSERT INTO prod_orders (order_number) VALUES ('999')`)).rejects.toThrow(/permission denied/);
    await expect(as(MANAGER, `UPDATE prod_item_sizes SET quantity = 9`)).rejects.toThrow(/permission denied/);
    await expect(as(TEAM, `DELETE FROM prod_events`)).rejects.toThrow(/permission denied/);
    expect(await as(TEAM, `SELECT id FROM prod_orders`)).toHaveLength(1);
    expect(await as(NOBODY, `SELECT id FROM prod_orders`)).toHaveLength(0);
    await expect(as(MANAGER, `SELECT prod__write_items(gen_random_uuid(), '{}'::jsonb)`)).rejects.toThrow(/permission denied/);
  });

  it('previews can never be marked production-ready', async () => {
    await expect(
      db.query(`INSERT INTO prod_artwork_previews (hash, kind, storage_path, production_ready) VALUES ('h','artwork','p', true)`),
    ).rejects.toThrow(/check constraint/);
  });

  it('method change needs a reason and is logged; edits blocked after approval', async () => {
    const id = await orderId('1002714');
    const d = (await db.query<{ id: string }>(
      `SELECT d.id FROM prod_item_decorations d JOIN prod_order_items i ON i.id=d.item_id WHERE i.order_id=$1 AND d.method_inksoft='Embroidery' LIMIT 1`, [id])).rows[0];
    await expect(as(MANAGER, `SELECT prod_update_decoration($1, '{"method_production":"dtf"}')`, [d.id])).rejects.toThrow(/reason/);
    await expect(as(TEAM, `SELECT prod_update_decoration($1, '{"location":"x"}')`, [d.id])).rejects.toThrow(/manager/);
    await as(MANAGER, `SELECT prod_update_decoration($1, '{"method_production":"dtf","override_reason":"test"}')`, [d.id]);
    await as(MANAGER, `SELECT prod_update_decoration($1, '{"method_production":"embroidery","override_reason":"undo test"}')`, [d.id]);
    const ev = await db.query(`SELECT action FROM prod_events WHERE order_id=$1 AND action='edit_decoration'`, [id]);
    expect(ev.rows).toHaveLength(2);
    const inksoft = await db.query<{ method_inksoft: string }>(`SELECT method_inksoft FROM prod_item_decorations WHERE id=$1`, [d.id]);
    expect(inksoft.rows[0].method_inksoft).toBe('Embroidery');
  });

  it('approval checks the revision and is idempotent', async () => {
    const id = await orderId('1002714');
    await expect(as(MANAGER, `SELECT prod_approve_order($1, 99)`, [id])).rejects.toThrow(/changed while you were reviewing/);
    await expect(as(TEAM, `SELECT prod_approve_order($1, 1)`, [id])).rejects.toThrow(/manager/);
    expect((await one<{ r: { ok: boolean } }>(MANAGER, `SELECT prod_approve_order($1, 1) AS r`, [id])).r.ok).toBe(true);
    expect((await one<{ r: { already: boolean } }>(MANAGER, `SELECT prod_approve_order($1, 1) AS r`, [id])).r.already).toBe(true);
    const s = (await db.query<{ id: string }>(`SELECT s.id FROM prod_item_sizes s JOIN prod_order_items i ON i.id=s.item_id WHERE i.order_id=$1 LIMIT 1`, [id])).rows[0];
    await expect(as(MANAGER, `SELECT prod_update_size($1, 3)`, [s.id])).rejects.toThrow(/reopen it/);
  });

  it('a changed copy of an approved order waits for a manager instead of changing it', async () => {
    const { results } = await importFixture('workorder-1002714', 'sha-A3', undefined, (p) => {
      p.orders[0].items[0].sizes[0].quantity = 2;
      p.orders[0].content_sha256 = 'changed';
    });
    expect(results?.[0].outcome).toBe('pending');
    const id = await orderId('1002714');
    expect(await counts(['1002714'])).toEqual({ garments: 5, tasks: 6 }); // untouched
    const o = (await db.query<{ status: string; pending_revision: number }>(`SELECT status, pending_revision FROM prod_orders WHERE id=$1`, [id])).rows[0];
    expect(o).toEqual({ status: 'approved', pending_revision: 2 });
    await as(MANAGER, `SELECT prod_apply_revision($1)`, [id]);
    expect(await counts(['1002714'])).toEqual({ garments: 6, tasks: 7 });
    const o2 = (await db.query<{ status: string; current_revision: number }>(`SELECT status, current_revision FROM prod_orders WHERE id=$1`, [id])).rows[0];
    expect(o2).toEqual({ status: 'review', current_revision: 2 });
  });

  it('Test B: 5 orders, 10 garments, 15 tasks; the 3-order file then changes nothing', async () => {
    const b = await importFixture('workorders-5', 'sha-B');
    expect(b.results?.map((r) => r.outcome)).toEqual(['new', 'new', 'new', 'new', 'new']);
    const nums = ['1002747', '1002748', '1002750', '1002751', '1002752'];
    expect(await counts(nums)).toEqual({ garments: 10, tasks: 15 });
    const c = await importFixture('workorders-3', 'sha-C');
    expect(c.results?.map((r) => r.outcome)).toEqual(['unchanged', 'unchanged', 'unchanged']);
    expect(await counts(nums)).toEqual({ garments: 10, tasks: 15 });
  });

  it('CSV adds pickup location and approved checkout fields only', async () => {
    const csv = [
      '"Order ID","First Name","Last Name","Email","Store / Company","Quantity of Items","Order Total","Checkout Option 3","Checkout Input 3","Checkout Option 4","Checkout Input 4","Checkout Option 5","Checkout Input 5","Shipping Method / Pickup Location","Address Phone","Address Street 1"',
      '"1002748","Test","Person","test@example.com","Tri-State","3","$127.85","Department","Float Receptionist","Department Number","630100","EE#","3324","INTERNAL-PickUp Tri-State ","555-0100","1 Main St"',
    ].join('\r\n');
    const batch = (await db.query<{ id: string }>(`SELECT id FROM prod_import_batches WHERE file_sha256='sha-B'`)).rows[0].id;
    const orders = parseInkSoftOrdersCsv(csv).orders.map((c) => ({
      order_number: c.orderNumber, fulfillment: c.fulfillment, pickup_location: c.pickupLocation,
      shipping_method: c.shippingMethod, email: c.email, checkout_fields: c.checkoutFields, item_count: c.itemCount,
    }));
    const r = await one<{ r: { matched: number } }>(MANAGER, `SELECT prod_apply_csv($1,'o.csv','csv/x.csv','sha-csv',$2::jsonb) AS r`, [batch, JSON.stringify(orders)]);
    expect(r.r.matched).toBe(1);
    const o = (await db.query(`SELECT fulfillment, pickup_location, customer_email, checkout_fields, csv_item_count FROM prod_orders WHERE order_number='1002748'`)).rows[0];
    expect(o).toEqual({
      fulfillment: 'pickup', pickup_location: 'Tri-State', customer_email: 'test@example.com',
      checkout_fields: [{ label: 'Department', value: 'Float Receptionist' }, { label: 'Department Number', value: '630100' }],
      csv_item_count: 3,
    });
    expect(JSON.stringify(o)).not.toMatch(/3324|555-0100|Main St|127/);
  });

  it('DTF transfer list for Test B matches the hand count', async () => {
    for (const n of ['1002747', '1002748', '1002750', '1002751', '1002752']) {
      const id = await orderId(n);
      const r = await one<{ r: { ok: boolean; blockers?: string[] } }>(MANAGER, `SELECT prod_approve_order($1, 1) AS r`, [id]);
      expect(r.r).toEqual({ ok: true });
    }
    const rows = await as<TransferSourceDecoration>(TEAM, `
      SELECT d.id AS decoration_id, o.order_number, o.store_name, i.mfg_sku, i.color, i.design_id, i.design_name,
             d.colorway, d.location, d.method_inksoft, d.artwork_hash, d.transfer_printed_at::text,
             (SELECT jsonb_agg(jsonb_build_object('size', s.size, 'quantity', s.quantity) ORDER BY s.seq) FROM prod_item_sizes s WHERE s.item_id = i.id) AS sizes
      FROM prod_item_decorations d JOIN prod_order_items i ON i.id = d.item_id JOIN prod_orders o ON o.id = i.order_id
      WHERE o.status = 'approved' AND d.method_production = 'dtf' AND o.order_number <> '1002714'`);
    const list = buildTransferList(rows);
    expect(list.map((l) => [l.design_name, l.colorway, l.location, l.quantity])).toEqual([
      ['Green and Black', 'Colorway 1', 'Front - Front', 1],
      ['Green and Black', 'Colorway 3', 'Front - Front', 1],
      ['Maggie no black', 'Original Art', 'Back - Full', 4],
      ['Maggie no black', 'Original Art', 'Front - Left Chest', 4],
      ['MAin Logo White', 'Original Art', 'Back - Back', 1],
      ['MAin Logo White', 'Original Art', 'Front - Front', 1],
    ]);
    expect(list.reduce((a, l) => a + l.quantity, 0)).toBe(12);
    const maggie = list.find((l) => l.location === 'Front - Left Chest')!;
    expect(maggie.orders).toEqual([{ order_number: '1002747', quantity: 3 }, { order_number: '1002750', quantity: 1 }]);
    expect(maggie.garments).toEqual([
      { label: 'PC78H Jet Black S', quantity: 1 }, { label: 'PC78H Jet Black M', quantity: 1 }, { label: 'PC78H Jet Black L', quantity: 2 },
    ]);
    // any staff can tick a line; ticking twice changes nothing the second time
    expect((await one<{ n: number }>(TEAM, `SELECT prod_set_transfers_printed($1::uuid[], true) AS n`, [maggie.decoration_ids])).n).toBe(2);
    expect((await one<{ n: number }>(TEAM, `SELECT prod_set_transfers_printed($1::uuid[], true) AS n`, [maggie.decoration_ids])).n).toBe(0);
    await expect(as(NOBODY, `SELECT prod_set_transfers_printed($1::uuid[], true)`, [maggie.decoration_ids])).rejects.toThrow(/Not allowed/);
  });

  it('rollback removes every prod_ object and leaves the rest alone', async () => {
    await db.exec(rollback);
    const left = await db.query(`SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relname LIKE 'prod\\_%'`);
    expect(left.rows).toEqual([]);
    const fns = await db.query(`SELECT proname FROM pg_proc WHERE proname LIKE 'prod\\_%'`);
    expect(fns.rows).toEqual([]);
    expect((await db.query(`SELECT * FROM user_roles`)).rows).toHaveLength(2);
  });
});
