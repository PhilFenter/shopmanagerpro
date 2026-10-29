// Blank-garment purchase order for an import batch: how many of each style / color / size to buy.
// A list only. It doesn't place orders with SanMar or any other vendor.
import { sizeRank } from './transfers';

export interface PoSourceItem {
  order_number: string;
  mfg_sku: string | null;
  color: string | null;
  product_name: string | null;
  sizes: { size: string; quantity: number | null }[];
}

export interface PoLine {
  key: string;
  mfg_sku: string | null;
  color: string | null;
  product_name: string | null;
  bySize: Record<string, number>;
  total: number;
  orders: string[];
  /** Missing style number or color: someone has to check before ordering. */
  needsCheck: boolean;
}

export interface PurchaseOrder {
  lines: PoLine[];
  sizes: string[];
  total: number;
}

export function sortSizes(sizes: string[]) {
  return [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b));
}

export function buildPurchaseOrder(items: PoSourceItem[]): PurchaseOrder {
  const map = new Map<string, PoLine>();
  const allSizes = new Set<string>();
  for (const it of items) {
    const qty = it.sizes.reduce((a, s) => a + (s.quantity ?? 0), 0);
    if (qty === 0) continue;
    const key = `${(it.mfg_sku ?? '').trim().toUpperCase()}|${(it.color ?? '').trim().toLowerCase()}`;
    let line = map.get(key);
    if (!line) {
      line = {
        key, mfg_sku: it.mfg_sku, color: it.color, product_name: it.product_name,
        bySize: {}, total: 0, orders: [], needsCheck: !it.mfg_sku?.trim() || !it.color?.trim(),
      };
      map.set(key, line);
    }
    if (!line.product_name && it.product_name) line.product_name = it.product_name;
    for (const s of it.sizes) {
      if (!s.quantity) continue;
      allSizes.add(s.size);
      line.bySize[s.size] = (line.bySize[s.size] ?? 0) + s.quantity;
      line.total += s.quantity;
    }
    if (!line.orders.includes(it.order_number)) line.orders.push(it.order_number);
  }
  const lines = [...map.values()].sort(
    (a, b) => (a.mfg_sku ?? '').localeCompare(b.mfg_sku ?? '') || (a.color ?? '').localeCompare(b.color ?? ''),
  );
  for (const l of lines) l.orders.sort();
  return { lines, sizes: sortSizes([...allSizes]), total: lines.reduce((a, l) => a + l.total, 0) };
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per style / color / size. */
export function purchaseOrderCsv(po: PurchaseOrder) {
  const rows = [['Style', 'Color', 'Size', 'Quantity', 'Description', 'Orders']];
  for (const l of po.lines)
    for (const size of sortSizes(Object.keys(l.bySize)))
      rows.push([l.mfg_sku ?? '', l.color ?? '', size, String(l.bySize[size]), l.product_name ?? '', l.orders.join(' ')]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const VENDORS = [
  { key: 'sanmar', label: 'SanMar' },
  { key: 'ss_activewear', label: 'S&S Activewear' },
] as const;

export const vendorLabel = (key: string | null | undefined) =>
  VENDORS.find((v) => v.key === key)?.label ?? key ?? '';

/** Suggest the next PO number: one more than the highest all-digit PO number so far. Blank if there isn't one. */
export function nextPoNumber(existing: (string | null)[]) {
  const nums = existing.filter((n): n is string => !!n && /^\d+$/.test(n.trim())).map((n) => n.trim());
  if (nums.length === 0) return '';
  const max = nums.reduce((a, b) => (BigInt(b) > BigInt(a) ? b : a));
  return (BigInt(max) + 1n).toString().padStart(max.length, '0');
}

/** Marker in purchase_orders.notes that ties a PO to the import batch it came from. */
export const batchTag = (batchId: string) => `[import:${batchId}]`;

/** po_line_items rows: one per style / color / size. */
export function poLineRows(po: PurchaseOrder, poId: string) {
  return po.lines.flatMap((l) =>
    sortSizes(Object.keys(l.bySize)).map((size) => ({
      po_id: poId,
      style_number: l.mfg_sku?.trim() || 'MISSING',
      color: l.color,
      size,
      quantity: l.bySize[size],
      unit_cost: null,
      total_cost: null,
      brand: null,
      description: l.product_name,
      source: 'inksoft',
      source_order_id: null,
      source_order_name: l.orders.join(' '),
      job_id: null,
    })),
  );
}
