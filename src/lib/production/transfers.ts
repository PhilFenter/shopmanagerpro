// DTF transfer list: groups approved DTF decorations into "print this many of this transfer".
// A list only — it doesn't send anything to Fulfill Engine or any DTF software.

export interface TransferSourceDecoration {
  decoration_id: string;
  order_number: string;
  store_name: string | null;
  mfg_sku: string | null;
  color: string | null;
  design_id: string | null;
  design_name: string | null;
  colorway: string | null;
  location: string | null;
  method_inksoft: string | null;
  artwork_hash: string | null;
  transfer_printed_at: string | null;
  sizes: { size: string; quantity: number | null }[];
  /** Print size from the work order, when it's listed. */
  width_in?: number | null;
  height_in?: number | null;
}

export interface TransferLine {
  key: string;
  store_name: string | null;
  design_id: string | null;
  design_name: string | null;
  colorway: string | null;
  location: string | null;
  artwork_hash: string | null;
  methods_inksoft: string[];
  /** Print sizes listed on the work orders, e.g. "4.02 × 0.69 in". Empty when not listed. */
  print_sizes: string[];
  quantity: number;
  printed_quantity: number;
  orders: { order_number: string; quantity: number }[];
  garments: { label: string; quantity: number }[];
  decoration_ids: string[];
  /** decoration ids still to print */
  open_decoration_ids: string[];
}

export const SIZE_ORDER = ['NB', '6M', '12M', '18M', '24M', '2T', '3T', '4T', '5T', 'YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', '4XL', '5XL', '6XL', 'OSFA'];
export const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(s.toUpperCase());
  return i < 0 ? 100 : i;
};

export function transferKey(d: Pick<TransferSourceDecoration, 'design_id' | 'design_name' | 'colorway' | 'location'>) {
  // Same design at different locations is a different transfer (different size);
  // different colorways of the same design are different transfers.
  return [d.design_id ?? `name:${d.design_name ?? '?'}`, d.colorway ?? '', d.location ?? ''].join('|');
}

export function buildTransferList(rows: TransferSourceDecoration[]): TransferLine[] {
  const map = new Map<string, TransferLine & { _orders: Map<string, number>; _garments: Map<string, number> }>();
  for (const r of rows) {
    const key = transferKey(r);
    let line = map.get(key);
    if (!line) {
      line = {
        key,
        store_name: r.store_name,
        design_id: r.design_id,
        design_name: r.design_name,
        colorway: r.colorway,
        location: r.location,
        artwork_hash: r.artwork_hash,
        methods_inksoft: [],
        print_sizes: [],
        quantity: 0,
        printed_quantity: 0,
        orders: [],
        garments: [],
        decoration_ids: [],
        open_decoration_ids: [],
        _orders: new Map(),
        _garments: new Map(),
      };
      map.set(key, line);
    }
    const qty = r.sizes.reduce((a, s) => a + (s.quantity ?? 0), 0);
    if (qty === 0) continue;
    line.quantity += qty;
    if (r.transfer_printed_at) line.printed_quantity += qty;
    else line.open_decoration_ids.push(r.decoration_id);
    line.decoration_ids.push(r.decoration_id);
    if (r.method_inksoft && !line.methods_inksoft.includes(r.method_inksoft)) line.methods_inksoft.push(r.method_inksoft);
    if (r.width_in && r.height_in) {
      const ps = `${r.width_in} × ${r.height_in} in`;
      if (!line.print_sizes.includes(ps)) line.print_sizes.push(ps);
    }
    if (!line.artwork_hash && r.artwork_hash) line.artwork_hash = r.artwork_hash;
    line._orders.set(r.order_number, (line._orders.get(r.order_number) ?? 0) + qty);
    for (const s of r.sizes) {
      if (!s.quantity) continue;
      const g = `${r.mfg_sku ?? '?'} ${r.color ?? ''} ${s.size}`.replace(/\s+/g, ' ').trim();
      line._garments.set(g, (line._garments.get(g) ?? 0) + s.quantity);
    }
  }
  const out: TransferLine[] = [];
  for (const l of map.values()) {
    if (l.quantity === 0) continue;
    const { _orders, _garments, ...rest } = l;
    rest.orders = [..._orders].map(([order_number, quantity]) => ({ order_number, quantity })).sort((a, b) => a.order_number.localeCompare(b.order_number));
    rest.garments = [..._garments]
      .map(([label, quantity]) => ({ label, quantity }))
      .sort((a, b) => {
        const sa = a.label.split(' ').pop() ?? '';
        const sb = b.label.split(' ').pop() ?? '';
        return a.label.replace(/\S+$/, '').localeCompare(b.label.replace(/\S+$/, '')) || sizeRank(sa) - sizeRank(sb);
      });
    out.push(rest);
  }
  return out.sort(
    (a, b) =>
      (a.store_name ?? '').localeCompare(b.store_name ?? '') ||
      (a.design_name ?? '').localeCompare(b.design_name ?? '') ||
      (a.colorway ?? '').localeCompare(b.colorway ?? '') ||
      (a.location ?? '').localeCompare(b.location ?? ''),
  );
}
