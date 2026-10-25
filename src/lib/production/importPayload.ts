// Turns parser output (+ optional CSV) into the payload saved by prod_save_extraction.
import type { CsvOrder } from './inksoftCsv';
import { countBatch, type ParsedBatch, type ParsedOrder } from './inksoftParser';
import { proposeMethod, type MethodRule } from './methods';

export interface PayloadDecoration {
  location: string | null;
  method_inksoft: string | null;
  method_production: string | null;
  method_source: 'rule' | null;
  colorway: string | null;
  color_count: string | null;
  width_in: number | null;
  height_in: number | null;
  thread_colors: string[];
  artwork_hash: string | null;
  mockup_hash: string | null;
  flags: unknown[];
}

export interface PayloadItem {
  item_index: number | null;
  item_of: number | null;
  page: number;
  mfg_sku: string | null;
  inksoft_sku: string | null;
  color: string | null;
  product_name: string | null;
  design_name: string | null;
  design_id: string | null;
  truncated: string[];
  mockup_hash: string | null;
  flags: unknown[];
  sizes: { size: string; quantity: number | null }[];
  decorations: PayloadDecoration[];
}

export interface PayloadCsv {
  fulfillment: CsvOrder['fulfillment'];
  pickup_location: string | null;
  shipping_method: string | null;
  email: string | null;
  checkout_fields: CsvOrder['checkoutFields'];
  item_count: number | null;
}

export interface PayloadOrder {
  order_number: string;
  customer_name: string | null;
  store_name: string | null;
  order_date: string | null;
  ship_date: string | null;
  printed_at: string | null;
  pages: number[];
  flags: unknown[];
  items: PayloadItem[];
  content_sha256: string;
  csv: PayloadCsv | null;
}

export interface ImportPayload {
  parser_version: string;
  printed_at: string | null;
  flags: unknown[];
  summary: ReturnType<typeof countBatch>;
  orders: PayloadOrder[];
  previews: { hash: string; kind: 'artwork' | 'mockup'; storage_path: string; width_px: number; height_px: number }[];
}

export const csvToPayload = (c: CsvOrder): PayloadCsv => ({
  fulfillment: c.fulfillment,
  pickup_location: c.pickupLocation,
  shipping_method: c.shippingMethod,
  email: c.email,
  checkout_fields: c.checkoutFields,
  item_count: c.itemCount,
});

function orderItems(o: ParsedOrder, rules: MethodRule[]): PayloadItem[] {
  return o.items.map((it) => ({
    item_index: it.index,
    item_of: it.of,
    page: it.page,
    mfg_sku: it.mfgSku,
    inksoft_sku: it.inksoftSku,
    color: it.color,
    product_name: it.productName,
    design_name: it.designName,
    design_id: it.designId,
    truncated: it.truncated,
    mockup_hash: it.decorations.find((d) => d.mockup)?.mockup?.hash ?? null,
    flags: it.flags,
    sizes: it.sizes.map((s) => ({ size: s.size, quantity: s.qty })),
    decorations: it.decorations.map((d) => {
      const p = proposeMethod(d.methodInksoft, o.storeName, rules);
      return {
        location: d.location,
        method_inksoft: d.methodInksoft,
        method_production: p.method,
        method_source: p.source,
        colorway: d.colorway,
        color_count: d.colorCount,
        width_in: d.widthIn,
        height_in: d.heightIn,
        thread_colors: d.colors,
        artwork_hash: d.artwork?.hash ?? null,
        mockup_hash: d.mockup?.hash ?? null,
        flags: d.flags,
      };
    }),
  }));
}

/** Stable JSON (sorted keys) so the same order always hashes the same. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

async function sha256Text(s: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Content fingerprint of an order: everything that matters for production, but not the
 * "Printed …" time, page numbers, or flags. A fresh download of an unchanged order hashes the same.
 */
export async function orderContentHash(order: Omit<PayloadOrder, 'content_sha256' | 'csv'>): Promise<string> {
  const { printed_at: _p, pages: _pg, flags: _f, ...rest } = order;
  const items = rest.items.map(({ flags: _if, page: _ip, ...i }) => ({
    ...i,
    decorations: i.decorations.map(({ flags: _df, method_production: _mp, method_source: _ms, ...d }) => d),
  }));
  return sha256Text(stableStringify({ ...rest, items }));
}

export async function buildImportPayload(
  batch: ParsedBatch,
  rules: MethodRule[],
  csv: CsvOrder[] | null,
  previews: ImportPayload['previews'] = [],
): Promise<ImportPayload> {
  const byNumber = new Map((csv ?? []).map((c) => [c.orderNumber, c]));
  const orders: PayloadOrder[] = [];
  for (const o of batch.orders) {
    const base = {
      order_number: o.orderNumber,
      customer_name: o.customerName,
      store_name: o.storeName,
      order_date: o.orderDate,
      ship_date: o.shipDate,
      printed_at: o.printedAt,
      pages: o.pages,
      flags: o.flags,
      items: orderItems(o, rules),
    };
    const c = byNumber.get(o.orderNumber);
    orders.push({ ...base, content_sha256: await orderContentHash(base), csv: c ? csvToPayload(c) : null });
  }
  return {
    parser_version: batch.parserVersion,
    printed_at: batch.printedAt,
    flags: batch.flags,
    summary: countBatch(batch),
    orders,
    previews,
  };
}
