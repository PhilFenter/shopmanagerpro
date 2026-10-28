// What the review screen shows for an order: blocking problems (must be fixed before approval)
// and things to check. Mirrors prod_order_blockers() in the database, which has the final say.
import type { Flag } from './inksoftParser';

export interface DbSize { id: string; seq: number; size: string; quantity: number | null; source_quantity: number | null; edited_at: string | null }
export interface DbDecoration {
  id: string; seq: number; location: string | null; method_inksoft: string | null; method_production: string | null;
  method_source: 'rule' | 'staff' | null; override_reason: string | null; colorway: string | null; color_count: string | null;
  width_in: number | null; height_in: number | null; thread_colors: string[]; artwork_hash: string | null; mockup_hash: string | null;
  flags: Flag[]; transfer_printed_at: string | null;
}
export interface DbItem {
  id: string; item_index: number | null; item_of: number | null; page: number | null; mfg_sku: string | null; inksoft_sku: string | null;
  color: string | null; product_name: string | null; design_name: string | null; design_id: string | null; truncated: string[];
  mockup_hash: string | null; flags: Flag[]; prod_item_sizes: DbSize[]; prod_item_decorations: DbDecoration[];
}
export interface DbOrder {
  id: string; order_number: string; store_name: string | null; customer_name: string | null; customer_email: string | null;
  fulfillment: 'pickup' | 'ship' | 'unknown'; pickup_location: string | null; shipping_method: string | null;
  checkout_fields: { label: string; value: string }[]; csv_item_count: number | null; order_date: string | null; due_date: string | null;
  status: 'review' | 'approved' | 'on_hold' | 'cancelled'; current_revision: number; pending_revision: number | null;
  approved_at: string | null; flags: Flag[]; flags_ack_at: string | null; flags_ack_reason: string | null;
}

export interface Issue { level: 'block' | 'check'; message: string }

export const itemQty = (it: Pick<DbItem, 'prod_item_sizes'>) => it.prod_item_sizes.reduce((a, s) => a + (s.quantity ?? 0), 0);

export function orderCounts(items: DbItem[]) {
  let garments = 0;
  let tasks = 0;
  for (const it of items) {
    const n = itemQty(it);
    garments += n;
    tasks += n * it.prod_item_decorations.length;
  }
  return { garments, tasks, labels: garments };
}

const label = (it: DbItem) => `Item ${it.item_index ?? '?'} (${[it.mfg_sku, it.color].filter(Boolean).join(' ')})`;

export function reviewIssues(o: DbOrder, items: DbItem[]): Issue[] {
  const out: Issue[] = [];
  if (o.pending_revision) out.push({ level: 'block', message: 'A newer copy of this order was uploaded. Compare and apply it, or dismiss it.' });
  const fileBlocks = o.flags.filter((f) => f.level === 'block');
  for (const f of fileBlocks)
    out.push({ level: o.flags_ack_at ? 'check' : 'block', message: `${f.message}${o.flags_ack_at ? ' (checked by a manager)' : ''}` });
  for (const f of o.flags.filter((x) => x.level === 'check')) out.push({ level: 'check', message: f.message });
  if (items.length === 0) out.push({ level: 'block', message: 'No products' });

  for (const it of items) {
    const p = label(it);
    if (!it.mfg_sku) out.push({ level: 'block', message: `${p}: SKU missing` });
    if (!it.color) out.push({ level: 'block', message: `${p}: color missing` });
    if (it.prod_item_sizes.some((s) => s.quantity === null)) out.push({ level: 'block', message: `${p}: a size has no quantity` });
    if (itemQty(it) === 0) out.push({ level: 'block', message: `${p}: no quantity` });
    if (it.prod_item_decorations.length === 0) out.push({ level: 'block', message: `${p}: no decoration` });
    const sizesEdited = it.prod_item_sizes.some((s) => s.edited_at);
    for (const f of it.flags) {
      if (f.code === 'truncated_sku' || f.code === 'truncated_design') continue; // older imports; not production info
      const sizeFlag = ['total_mismatch', 'missing_total', 'no_size_grid'].includes(f.code);
      const level = f.level === 'block' && sizeFlag && (sizesEdited || o.flags_ack_at) ? 'check' : f.level;
      out.push({ level, message: `${p}: ${f.message}` });
    }
    for (const d of it.prod_item_decorations) {
      const dp = `${p}, ${d.location ?? 'decoration'}`;
      if (!d.location) out.push({ level: 'block', message: `${dp}: location missing` });
      if (!d.method_production) out.push({ level: 'block', message: `${dp}: choose the production method (InkSoft says "${d.method_inksoft ?? '—'}")` });
      for (const f of d.flags) {
        if (f.code === 'missing_dimensions' && d.width_in != null && d.height_in != null) continue;
        if (f.code === 'missing_threads' && d.thread_colors.length) continue;
        out.push({ level: f.level, message: `${dp}: ${f.message}` });
      }
    }
  }

  const { garments } = orderCounts(items);
  if (o.csv_item_count != null && o.csv_item_count !== garments)
    out.push({ level: 'check', message: `Orders CSV says ${o.csv_item_count} items; the work order has ${garments} garments` });
  if (o.fulfillment === 'unknown')
    out.push({ level: 'check', message: 'Pickup or ship isn’t known. Add the InkSoft Orders CSV, or set it here.' });
  return out;
}

export const blocking = (issues: Issue[]) => issues.filter((i) => i.level === 'block');
