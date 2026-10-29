// Phase 2 data: garments (one per physical piece), their decoration tasks, table spots, and scans.
import { useQuery } from '@tanstack/react-query';
import { prodDb } from '@/lib/production/db';

export interface ProdTask {
  id: string;
  garment_id: string;
  location: string;
  method: string;
  status: 'open' | 'done' | 'voided';
  done_at: string | null;
  done_station: string | null;
}

export interface ProdGarment {
  id: string;
  order_id: string;
  seq: number;
  token: string;
  item_index: number | null;
  size: string;
  mfg_sku: string | null;
  color: string | null;
  product_name: string | null;
  label_printed_at: string | null;
  assembled_at: string | null;
  assembled_spot: number | null;
  voided_at: string | null;
  void_reason: string | null;
  prod_tasks: ProdTask[];
}

export interface FloorOrder {
  id: string;
  order_number: string;
  store_name: string | null;
  customer_name: string | null;
  fulfillment: 'pickup' | 'ship' | 'unknown';
  pickup_location: string | null;
  shipping_method: string | null;
  checkout_fields: { label: string; value: string }[];
  due_date: string | null;
  status: string;
  pickup_token: string | null;
  check_passed_at: string | null;
  packed_at: string | null;
  shipped_at: string | null;
}

export interface FloorOrderFull extends FloorOrder {
  garments: ProdGarment[];
  spots: number[];
}

const ORDER_COLS =
  'id, order_number, store_name, customer_name, fulfillment, pickup_location, shipping_method, checkout_fields, due_date, status, pickup_token, check_passed_at, packed_at, shipped_at';
const NONE = ['00000000-0000-0000-0000-000000000000'];

export const shortCode = (orderNumber: string, seq: number) => `${orderNumber}-${String(seq).padStart(2, '0')}`;
export const liveGarments = (gs: ProdGarment[]) => gs.filter((g) => !g.voided_at);
export const liveTasks = (g: ProdGarment) => g.prod_tasks.filter((t) => t.status !== 'voided');

export const METHOD_LABEL: Record<string, string> = {
  dtf: 'DTF', embroidery: 'EMB', screen_print: 'SCREEN', laser: 'LASER', leather_patch: 'PATCH', other: 'OTHER',
};

async function loadFull(orders: FloorOrder[]): Promise<FloorOrderFull[]> {
  const ids = orders.map((o) => o.id);
  const [{ data: gs, error: e1 }, { data: spots, error: e2 }] = await Promise.all([
    prodDb.from('prod_garments').select('*, prod_tasks(*)').in('order_id', ids.length ? ids : NONE),
    prodDb.from('prod_spot_assignments').select('order_id, spot, assigned_at').is('released_at', null).in('order_id', ids.length ? ids : NONE),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  return orders.map((o) => {
    const garments = ((gs ?? []) as ProdGarment[]).filter((g) => g.order_id === o.id).sort((a, b) => a.seq - b.seq);
    for (const g of garments) g.prod_tasks.sort((a, b) => a.location.localeCompare(b.location));
    const sp = ((spots ?? []) as { order_id: string; spot: number; assigned_at: string }[])
      .filter((s) => s.order_id === o.id)
      .sort((a, b) => a.assigned_at.localeCompare(b.assigned_at))
      .map((s) => s.spot);
    return { ...o, checkout_fields: o.checkout_fields ?? [], garments, spots: sp };
  });
}

/** Approved orders on the floor. done = packed/shipped in the last 14 days. */
export function useFloorOrders(view: 'active' | 'done') {
  return useQuery({
    queryKey: ['prod', 'floor', view],
    refetchInterval: 15_000,
    queryFn: async () => {
      let q = prodDb.from('prod_orders').select(ORDER_COLS).eq('status', 'approved');
      if (view === 'active') q = q.is('packed_at', null).is('shipped_at', null);
      else {
        const since = new Date(Date.now() - 14 * 864e5).toISOString();
        q = q.or(`packed_at.gte.${since},shipped_at.gte.${since}`);
      }
      const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false }).limit(200);
      if (error) throw new Error(error.message);
      return loadFull((data ?? []) as FloorOrder[]);
    },
  });
}

export function useFloorOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['prod', 'floor-order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await prodDb.from('prod_orders').select(ORDER_COLS).eq('id', orderId).single();
      if (error) throw new Error(error.message);
      return (await loadFull([data as FloorOrder]))[0];
    },
  });
}

export function useSpotCount() {
  return useQuery({
    queryKey: ['prod', 'settings'],
    queryFn: async () => {
      const { data, error } = await prodDb.from('prod_settings').select('spot_count').single();
      if (error) throw new Error(error.message);
      return (data as { spot_count: number }).spot_count;
    },
  });
}

/** What a scan returns (see prod_scan in the Phase 2 migration). */
export interface ScanResult {
  ok: boolean;
  kind: 'done' | 'already' | 'not_here' | 'not_finished' | 'assembled' | 'no_spot' | 'packed' | 'not_checked'
    | 'voided' | 'on_hold' | 'unknown' | 'wrong_label' | 'info';
  message?: string;
  spot?: number;
  repeat?: boolean;
  complete?: boolean;
  done?: string[];
  still_open?: string[];
  progress?: { garments: number; assembled: number; spots: number[] };
  order?: { id: string; order_number: string; customer_name: string | null; store_name: string | null; fulfillment: string };
  garment?: {
    id: string; seq: number; code: string; size: string; mfg_sku: string | null; color: string | null;
    tasks: { id: string; location: string; method: string; status: string; done_station: string | null }[];
  };
}

/** Where an order is on the floor, for the board and the order page. */
export function orderStage(o: FloorOrderFull) {
  const g = liveGarments(o.garments);
  const tasks = g.flatMap(liveTasks);
  const done = tasks.filter((t) => t.status === 'done').length;
  const printed = g.filter((x) => x.label_printed_at).length;
  const inSpot = g.filter((x) => x.assembled_at).length;
  let stage: string;
  if (o.shipped_at) stage = 'Shipped';
  else if (o.packed_at) stage = 'Packed';
  else if (o.check_passed_at) stage = o.fulfillment === 'ship' ? 'Ready to ship' : 'Ready to pack';
  else if (g.length > 0 && inSpot === g.length) stage = 'Final check';
  else if (inSpot > 0) stage = 'Assembling';
  else if (done > 0) stage = 'Decorating';
  else if (printed < g.length) stage = 'Print labels';
  else stage = 'Labeled';
  return { pieces: g.length, tasks: tasks.length, done, printed, inSpot, stage };
}

export interface WorkDecoration {
  id: string;
  seq: number;
  location: string | null;
  method_inksoft: string | null;
  method_production: string | null;
  colorway: string | null;
  color_count: string | null;
  width_in: number | null;
  height_in: number | null;
  thread_colors: string[];
  artwork_hash: string | null;
  mockup_hash: string | null;
}
export interface GarmentWork {
  item: {
    id: string; mfg_sku: string | null; color: string | null; product_name: string | null;
    design_name: string | null; design_id: string | null; mockup_hash: string | null;
    prod_item_decorations: WorkDecoration[];
  } | null;
  tasks: { id: string; decoration_id: string | null; location: string; method: string; status: string }[];
}

/** What goes on one scanned piece: its product line, decorations (with preview images) and task status. */
export function useGarmentWork(garmentId: string | undefined) {
  return useQuery({
    queryKey: ['prod', 'garment-work', garmentId],
    enabled: !!garmentId,
    queryFn: async (): Promise<GarmentWork> => {
      const { data: g, error: e1 } = await prodDb.from('prod_garments').select('item_id').eq('id', garmentId).single();
      if (e1) throw new Error(e1.message);
      const itemId = (g as { item_id: string | null }).item_id;
      const [{ data: item, error: e2 }, { data: tasks, error: e3 }] = await Promise.all([
        itemId
          ? prodDb.from('prod_order_items')
            .select('id, mfg_sku, color, product_name, design_name, design_id, mockup_hash, prod_item_decorations(id, seq, location, method_inksoft, method_production, colorway, color_count, width_in, height_in, thread_colors, artwork_hash, mockup_hash)')
            .eq('id', itemId).single()
          : Promise.resolve({ data: null, error: null }),
        prodDb.from('prod_tasks').select('id, decoration_id, location, method, status').eq('garment_id', garmentId).neq('status', 'voided'),
      ]);
      if (e2) throw new Error(e2.message);
      if (e3) throw new Error(e3.message);
      const it = item as GarmentWork['item'];
      if (it) it.prod_item_decorations.sort((a, b) => a.seq - b.seq);
      return { item: it, tasks: (tasks ?? []) as GarmentWork['tasks'] };
    },
  });
}
