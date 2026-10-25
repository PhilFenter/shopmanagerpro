// Reads the InkSoft "Orders" CSV export. Only a short allow-list of columns is kept:
// prices, profit, addresses, phone numbers, transaction ids and employee numbers are dropped here,
// before anything is stored.

export interface CsvOrder {
  orderNumber: string;
  customerName: string | null;
  email: string | null;
  store: string | null;
  itemCount: number | null;
  fulfillment: 'pickup' | 'ship' | 'unknown';
  pickupLocation: string | null;
  shippingMethod: string | null;
  /** approved checkout fields only (Department, Department Number) */
  checkoutFields: { label: string; value: string }[];
}

/** Checkout fields HCD approved storing (Oct 25 2026). Everything else (EE#, names repeated, etc.) is ignored. */
export const ALLOWED_CHECKOUT_FIELDS = ['department', 'department number'];

/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const clean = (v: string | undefined) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

export interface CsvParseResult {
  orders: CsvOrder[];
  error: string | null;
}

export function parseInkSoftOrdersCsv(text: string): CsvParseResult {
  const rows = parseCsv(text);
  if (rows.length < 1) return { orders: [], error: 'The CSV file is empty' };
  const head = rows[0].map((h) => h.trim());
  const col = (name: string) => head.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const iId = col('Order ID');
  if (iId < 0) return { orders: [], error: 'This doesn’t look like an InkSoft Orders CSV (no "Order ID" column)' };
  const iFirst = col('First Name');
  const iLast = col('Last Name');
  const iEmail = col('Email');
  const iStore = col('Store / Company');
  const iQty = col('Quantity of Items');
  const iShip = col('Shipping Method / Pickup Location');
  const checkout: [number, number][] = [];
  for (let n = 1; n <= 10; n++) {
    const o = col(`Checkout Option ${n}`);
    const v = col(`Checkout Input ${n}`);
    if (o >= 0 && v >= 0) checkout.push([o, v]);
  }

  const orders: CsvOrder[] = [];
  for (const r of rows.slice(1)) {
    const id = clean(r[iId]);
    if (!id) continue;
    const ship = iShip >= 0 ? clean(r[iShip]) : null;
    let fulfillment: CsvOrder['fulfillment'] = 'unknown';
    let pickupLocation: string | null = null;
    let shippingMethod: string | null = null;
    if (ship) {
      const m = ship.match(/^INTERNAL-?\s*Pick\s*Up\s*(.*)$/i);
      if (m) {
        fulfillment = 'pickup';
        pickupLocation = m[1].trim() || null;
      } else {
        fulfillment = 'ship';
        shippingMethod = ship;
      }
    }
    const name = [iFirst >= 0 ? clean(r[iFirst]) : null, iLast >= 0 ? clean(r[iLast]) : null].filter(Boolean).join(' ');
    const qtyRaw = iQty >= 0 ? clean(r[iQty]) : null;
    const checkoutFields: CsvOrder['checkoutFields'] = [];
    for (const [o, v] of checkout) {
      const label = clean(r[o]);
      const value = clean(r[v]);
      if (label && value && ALLOWED_CHECKOUT_FIELDS.includes(label.toLowerCase())) checkoutFields.push({ label, value });
    }
    orders.push({
      orderNumber: id,
      customerName: name || null,
      email: iEmail >= 0 ? clean(r[iEmail]) : null,
      store: iStore >= 0 ? clean(r[iStore]) : null,
      itemCount: qtyRaw && /^\d+$/.test(qtyRaw) ? Number(qtyRaw) : null,
      fulfillment,
      pickupLocation,
      shippingMethod,
      checkoutFields,
    });
  }
  return { orders, error: null };
}
