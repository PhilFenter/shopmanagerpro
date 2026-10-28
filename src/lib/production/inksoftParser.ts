// Rule-based parser for InkSoft "Work Order" PDFs (BulkPrintWorkOrder layout).
// Pure function over positioned text (see pdfExtract.ts). Never fills in missing data:
// anything absent or unclear is left null and raised as a flag for employee review.
import type { PageData, PageImage, PdfData, TextItem } from './pdfTypes';

export const PARSER_VERSION = 'inksoft-wo-1';

export type FlagLevel = 'block' | 'check';
export interface Flag {
  level: FlagLevel; // block = must be fixed before approval; check = look at it
  code: string;
  message: string;
}

export interface ImageRef {
  page: number;
  hash: string;
  pw: number;
  ph: number;
  objId?: string;
}

export interface ParsedDecoration {
  location: string | null;
  methodInksoft: string | null;
  colorway: string | null;
  colorCount: string | null;
  heightIn: number | null;
  widthIn: number | null;
  colors: string[];
  artwork: ImageRef | null;
  mockup: ImageRef | null;
  flags: Flag[];
}

export interface ParsedSize {
  size: string;
  qty: number | null;
}

export interface ParsedItem {
  index: number | null; // "Item N of M"
  of: number | null;
  page: number;
  mfgSku: string | null;
  inksoftSku: string | null;
  color: string | null;
  productName: string | null;
  designName: string | null;
  designId: string | null;
  truncated: string[]; // fields InkSoft cut off with "…"
  sizes: ParsedSize[];
  total: number | null;
  decorations: ParsedDecoration[];
  flags: Flag[];
}

export interface ParsedOrder {
  orderNumber: string;
  pages: number[];
  customerName: string | null;
  storeName: string | null;
  orderDate: string | null; // ISO yyyy-mm-dd
  shipDate: string | null;
  printedAt: string | null; // as printed, e.g. "25 Oct 2026 at 7:32 AM"
  items: ParsedItem[];
  flags: Flag[];
}

export interface ParsedBatch {
  parserVersion: string;
  printedAt: string | null;
  orders: ParsedOrder[];
  flags: Flag[];
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

export function parseInkSoftDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2}) ([A-Za-z]{3})[A-Za-z]* (\d{4})$/);
  if (!m) return null;
  const mm = MONTHS[m[2].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
}

function parseInches(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*in$/i);
  return m ? Number(m[1]) : null;
}

const isTruncated = (s: string | null) => !!s && /(…|\.\.\.)$/.test(s);

/** The value printed directly under a label, in the same column. */
function below(items: TextItem[], label: TextItem | undefined, maxDy = 22, xTol = 5): string | null {
  if (!label) return null;
  let best: TextItem | null = null;
  for (const s of items) {
    if (s === label) continue;
    const dy = s.y - label.y;
    if (dy <= 2 || dy > maxDy) continue;
    if (Math.abs(s.x - label.x) > xTol) continue;
    if (!best || s.y < best.y) best = s;
  }
  return best ? best.t : null;
}

const find = (items: TextItem[], t: string) => items.find((s) => s.t === t);

interface PageHeader {
  orderNumber: string | null;
  pageNo: number | null;
  pageOf: number | null;
  printedAt: string | null;
  customer: string | null;
  store: string | null;
  orderDate: string | null;
  shipDate: string | null;
}

function readHeader(p: PageData): PageHeader {
  const top = p.items.filter((s) => s.y < 70);
  const orderNumber = top.find((s) => /^\d{6,8}$/.test(s.t) && s.x > p.width * 0.6)?.t ?? null;
  // "Page" "1" "of" "3" arrive as separate items on one baseline
  let pageNo: number | null = null;
  let pageOf: number | null = null;
  const pageLbl = top.find((s) => s.t === 'Page' || /^Page \d+ of \d+$/.test(s.t));
  if (pageLbl) {
    const row = top
      .filter((s) => Math.abs(s.y - pageLbl.y) < 2 && s.x >= pageLbl.x && (!orderNumber || s.t !== orderNumber))
      .sort((a, b) => a.x - b.x)
      .map((s) => s.t)
      .join(' ');
    const m = row.match(/Page (\d+) of (\d+)/);
    if (m) {
      pageNo = Number(m[1]);
      pageOf = Number(m[2]);
    }
  }
  const printed = top.find((s) => s.t.startsWith('Printed '));
  const hdr = p.items.filter((s) => s.y < 110);
  return {
    orderNumber,
    pageNo,
    pageOf,
    printedAt: printed ? printed.t.replace(/^Printed\s+/, '') : null,
    customer: below(hdr, find(hdr, 'CUSTOMER NAME')),
    store: below(hdr, find(hdr, 'STORE/ORGANIZATION')),
    orderDate: below(hdr, find(hdr, 'ORDER DATE')),
    shipDate: below(hdr, find(hdr, 'SHIP DATE')),
  };
}

const MOCKUP_MIN_PW = 300;
const inside = (a: PageImage, b: PageImage) =>
  a !== b && a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;

function pageImages(p: PageData) {
  const visible = p.images.filter((im) => im.w >= 5 && im.h >= 5 && im.y < p.height && im.y + im.h > 0);
  const mockups = visible.filter((im) => im.pw >= MOCKUP_MIN_PW);
  // artwork thumbnails are the free-standing small images; copies drawn on top of a mockup are ignored
  const artwork = visible.filter((im) => im.pw < MOCKUP_MIN_PW && !mockups.some((m) => inside(im, m)));
  return { mockups, artwork };
}

const toRef = (page: number, im: PageImage | undefined): ImageRef | null =>
  im ? { page, hash: im.hash, pw: im.pw, ph: im.ph, objId: im.objId } : null;

function parseItem(p: PageData, seg: TextItem[], label: TextItem, y1: number, imgs: ReturnType<typeof pageImages>): ParsedItem {
  const flags: Flag[] = [];
  const m = label.t.match(/^Item (\d+) of (\d+)$/);
  const L = (t: string) => find(seg, t);
  const v = (t: string) => below(seg, L(t));
  const item: ParsedItem = {
    index: m ? Number(m[1]) : null,
    of: m ? Number(m[2]) : null,
    page: p.page,
    mfgSku: v('MFG SKU'),
    inksoftSku: v('SKU'),
    color: v('COLOR/STYLE'),
    productName: v('PRODUCT NAME'),
    designName: v('DESIGN NAME'),
    designId: v('DESIGN ID'),
    truncated: [],
    sizes: [],
    total: null,
    decorations: [],
    flags,
  };
  for (const k of ['mfgSku', 'inksoftSku', 'color', 'productName', 'designName'] as const) {
    if (isTruncated(item[k])) item.truncated.push(k);
  }
  if (!item.mfgSku) flags.push({ level: 'block', code: 'missing_mfg_sku', message: 'Manufacturer SKU not found' });
  if (!item.color) flags.push({ level: 'block', code: 'missing_color', message: 'Garment color not found' });
  if (!item.designId) flags.push({ level: 'check', code: 'missing_design_id', message: 'Design ID not found' });
  // InkSoft shortens long text with "…" in the PDF. The InkSoft SKU, product name and design name aren't
  // needed for production (the design ID is always whole), so only the manufacturer SKU and color are flagged.
  if (item.truncated.includes('mfgSku'))
    flags.push({ level: 'check', code: 'truncated_mfg_sku', message: 'Manufacturer SKU is shortened in the PDF. Check it' });
  if (item.truncated.includes('color'))
    flags.push({ level: 'check', code: 'truncated_color', message: 'Color is shortened in the PDF. Check it' });

  // size grid: rows in the SIZE column between the SIZE header and TOTAL; quantities in the QTY column
  const sz = L('SIZE');
  const qty = L('QTY');
  const tot = L('TOTAL');
  if (!sz || !qty || !tot) {
    flags.push({ level: 'block', code: 'no_size_grid', message: 'Size/quantity table not found' });
  } else {
    const inQtyCol = (s: TextItem) => s.x > qty.x - 8 && s.x < qty.x + 40;
    const rows = seg.filter((s) => s.y > sz.y + 5 && s.y < tot.y - 2 && s.x < sz.x + 20);
    for (const r of rows) {
      const q = seg.find((s) => Math.abs(s.y - r.y) < 4 && inQtyCol(s) && s !== r);
      const n = q && /^\d+$/.test(q.t) ? Number(q.t) : null;
      item.sizes.push({ size: r.t, qty: n });
      if (n === null) flags.push({ level: 'block', code: 'missing_qty', message: `No quantity for size ${r.t}` });
    }
    const tq = seg.find((s) => Math.abs(s.y - tot.y) < 4 && inQtyCol(s));
    item.total = tq && /^\d+$/.test(tq.t) ? Number(tq.t) : null;
    const sum = item.sizes.reduce((a, s) => a + (s.qty ?? 0), 0);
    if (item.sizes.length === 0) flags.push({ level: 'block', code: 'no_sizes', message: 'No sizes found' });
    if (item.total === null) flags.push({ level: 'block', code: 'missing_total', message: 'TOTAL quantity not found' });
    else if (sum !== item.total)
      flags.push({ level: 'block', code: 'total_mismatch', message: `Sizes add up to ${sum} but TOTAL says ${item.total}` });
  }

  // decorations: one block per PRINT LOCATION label
  const locs = seg.filter((s) => s.t === 'PRINT LOCATION').sort((a, b) => a.y - b.y);
  if (locs.length === 0) flags.push({ level: 'block', code: 'no_decorations', message: 'No decoration found for this product' });
  const usedArt = new Set<PageImage>();
  const usedMock = new Set<PageImage>();
  locs.forEach((pl, j) => {
    const dy0 = pl.y;
    const dy1 = j + 1 < locs.length ? locs[j + 1].y : y1;
    const ds = seg.filter((s) => s.y >= dy0 && s.y < dy1 && s.x > pl.x - 6);
    const D = (t: string) => find(ds, t);
    const dflags: Flag[] = [];
    const d: ParsedDecoration = {
      location: below(ds, pl),
      methodInksoft: below(ds, D('DECORATION METHOD')),
      colorway: below(ds, D('COLORWAY')),
      colorCount: below(ds, D('COLOR COUNT'), 22, 6),
      heightIn: null,
      widthIn: null,
      colors: [],
      artwork: null,
      mockup: null,
      flags: dflags,
    };
    const hRaw = below(ds, D('HEIGHT'));
    const wRaw = below(ds, D('WIDTH'));
    d.heightIn = parseInches(hRaw);
    d.widthIn = parseInches(wRaw);
    if ((hRaw && d.heightIn === null) || (wRaw && d.widthIn === null))
      dflags.push({ level: 'check', code: 'bad_dimension', message: `Couldn't read dimensions "${hRaw ?? ''} × ${wRaw ?? ''}"` });
    // numbered color rows: "1." then one or more cells on the same baseline
    for (const n of ds.filter((s) => /^\d+\.$/.test(s.t)).sort((a, b) => a.y - b.y)) {
      const row = ds
        .filter((s) => Math.abs(s.y - n.y) < 4 && s.x > n.x + 3)
        .sort((a, b) => a.x - b.x)
        .map((s) => s.t);
      if (row.length) d.colors.push(row.join(' | '));
    }
    if (!d.location) dflags.push({ level: 'block', code: 'missing_location', message: 'Print location not found' });
    if (!d.methodInksoft) dflags.push({ level: 'block', code: 'missing_method', message: 'Decoration method not found' });
    const isEmb = /embroider/i.test(d.methodInksoft ?? '');
    if (isEmb && (d.heightIn === null || d.widthIn === null))
      dflags.push({ level: 'check', code: 'missing_dimensions', message: 'Embroidery size not given' });
    if (isEmb && d.colors.length === 0)
      dflags.push({ level: 'check', code: 'missing_threads', message: 'No thread colors listed' });

    // images whose top edge falls in this decoration's band (a little above the label is allowed)
    const top = dy0 - 15;
    const bottom = j + 1 < locs.length ? locs[j + 1].y - 15 : y1 - 15;
    const art = imgs.artwork.find((im) => !usedArt.has(im) && im.y >= top && im.y < bottom);
    const mock = imgs.mockups.find((im) => !usedMock.has(im) && im.y >= top && im.y < bottom);
    if (art) usedArt.add(art);
    if (mock) usedMock.add(mock);
    d.artwork = toRef(p.page, art);
    d.mockup = toRef(p.page, mock);
    if (!d.artwork) dflags.push({ level: 'check', code: 'no_artwork_preview', message: 'No artwork preview found' });
    item.decorations.push(d);
  });
  return item;
}

export function parseWorkOrders(pdf: PdfData): ParsedBatch {
  const batchFlags: Flag[] = [];
  const orders: ParsedOrder[] = [];
  let current: ParsedOrder | null = null;
  const seenOrders = new Map<string, ParsedOrder>();
  let printedAt: string | null = null;
  const pageCounts = new Map<ParsedOrder, { of: number | null; seen: Set<number> }>();

  for (const p of pdf.pages) {
    const h = readHeader(p);
    printedAt = printedAt ?? h.printedAt;
    let order: ParsedOrder | null;
    if (!h.orderNumber) {
      // A page without an order number continues the previous order, but it's flagged.
      order = current;
      if (!order) {
        batchFlags.push({ level: 'block', code: 'page_without_order', message: `Page ${p.page}: no order number found` });
        continue;
      }
      order.flags.push({ level: 'block', code: 'page_without_order', message: `Page ${p.page} has no order number; assumed to continue this order` });
    } else if (current && current.orderNumber === h.orderNumber) {
      order = current;
    } else if (seenOrders.has(h.orderNumber)) {
      order = seenOrders.get(h.orderNumber)!;
      order.flags.push({ level: 'block', code: 'order_repeated_in_file', message: `Order appears again on page ${p.page}, separated from its other pages` });
    } else {
      order = {
        orderNumber: h.orderNumber,
        pages: [],
        customerName: h.customer,
        storeName: h.store,
        orderDate: parseInkSoftDate(h.orderDate),
        shipDate: parseInkSoftDate(h.shipDate),
        printedAt: h.printedAt,
        items: [],
        flags: [],
      };
      if (h.orderDate && !order.orderDate) order.flags.push({ level: 'check', code: 'bad_date', message: `Couldn't read order date "${h.orderDate}"` });
      if (h.shipDate && !order.shipDate) order.flags.push({ level: 'check', code: 'bad_date', message: `Couldn't read ship date "${h.shipDate}"` });
      seenOrders.set(h.orderNumber, order);
      orders.push(order);
      pageCounts.set(order, { of: h.pageOf, seen: new Set() });
    }
    current = order;
    order.pages.push(p.page);
    const pc = pageCounts.get(order)!;
    if (h.pageNo !== null) {
      if (pc.seen.has(h.pageNo)) order.flags.push({ level: 'block', code: 'page_repeated', message: `Page ${h.pageNo} of this order appears twice` });
      pc.seen.add(h.pageNo);
    }
    if (h.pageOf !== null && pc.of !== null && h.pageOf !== pc.of)
      order.flags.push({ level: 'block', code: 'page_count_mismatch', message: `Pages disagree on page count (${pc.of} vs ${h.pageOf})` });

    // header fields must agree across pages
    const cmp: [keyof ParsedOrder, string | null][] = [
      ['customerName', h.customer],
      ['storeName', h.store],
    ];
    for (const [k, val] of cmp) {
      if (val && order[k] && order[k] !== val)
        order.flags.push({ level: 'block', code: 'header_mismatch', message: `${k === 'customerName' ? 'Customer' : 'Store'} differs on page ${p.page}` });
      if (val && !order[k]) (order as unknown as Record<string, unknown>)[k] = val;
    }

    const imgs = pageImages(p);
    const labels = p.items.filter((s) => /^Item \d+ of \d+$/.test(s.t)).sort((a, b) => a.y - b.y);
    const firstY = labels.length ? labels[0].y : p.height;
    if (p.items.some((s) => s.t === 'PRINT LOCATION' && s.y < firstY))
      order.flags.push({ level: 'block', code: 'orphan_decoration', message: `Page ${p.page}: decoration rows above the first product (product may continue from the previous page)` });
    labels.forEach((lab, i) => {
      const y1 = i + 1 < labels.length ? labels[i + 1].y : p.height + 1;
      const seg = p.items.filter((s) => s.y >= lab.y && s.y < y1);
      order!.items.push(parseItem(p, seg, lab, y1, imgs));
    });
  }

  // completeness checks per order
  for (const o of orders) {
    const pc = pageCounts.get(o)!;
    if (pc.of !== null) {
      const missing: number[] = [];
      for (let i = 1; i <= pc.of; i++) if (!pc.seen.has(i)) missing.push(i);
      if (missing.length)
        o.flags.push({ level: 'block', code: 'missing_pages', message: `Missing page ${missing.join(', ')} of ${pc.of}` });
    } else {
      o.flags.push({ level: 'check', code: 'no_page_numbers', message: 'Page numbers not found; can’t confirm all pages are present' });
    }
    const of = o.items.find((it) => it.of !== null)?.of ?? null;
    if (of !== null) {
      const have = new Set(o.items.map((it) => it.index));
      const missing: number[] = [];
      for (let i = 1; i <= of; i++) if (!have.has(i)) missing.push(i);
      if (missing.length) o.flags.push({ level: 'block', code: 'missing_items', message: `Missing product ${missing.join(', ')} of ${of}` });
      if (o.items.some((it) => it.of !== null && it.of !== of))
        o.flags.push({ level: 'block', code: 'item_count_mismatch', message: 'Products disagree on the item count' });
    }
    if (o.items.length === 0) o.flags.push({ level: 'block', code: 'no_items', message: 'No products found' });
    if (!o.customerName) o.flags.push({ level: 'check', code: 'missing_customer', message: 'Customer name not found' });
    if (!o.storeName) o.flags.push({ level: 'check', code: 'missing_store', message: 'Store not found' });
    if (!o.shipDate) o.flags.push({ level: 'check', code: 'missing_ship_date', message: 'Ship date not found' });
  }
  if (orders.length === 0) batchFlags.push({ level: 'block', code: 'no_orders', message: 'No InkSoft work orders found in this file' });

  return { parserVersion: PARSER_VERSION, printedAt, orders, flags: batchFlags };
}

// ---- Counts ---------------------------------------------------------------

export interface OrderCounts {
  garments: number;
  tasks: number;
  labels: number;
}

export function countOrder(o: Pick<ParsedOrder, 'items'>): OrderCounts {
  let garments = 0;
  let tasks = 0;
  for (const it of o.items) {
    const n = it.sizes.reduce((a, s) => a + (s.qty ?? 0), 0);
    garments += n;
    tasks += n * it.decorations.length;
  }
  return { garments, tasks, labels: garments };
}

export function countBatch(b: Pick<ParsedBatch, 'orders'>): OrderCounts & { orders: number } {
  const c = { orders: b.orders.length, garments: 0, tasks: 0, labels: 0 };
  for (const o of b.orders) {
    const oc = countOrder(o);
    c.garments += oc.garments;
    c.tasks += oc.tasks;
    c.labels += oc.labels;
  }
  return c;
}

/** All flags for an order, including product and decoration flags. */
export function allOrderFlags(o: ParsedOrder): Flag[] {
  const out = [...o.flags];
  for (const it of o.items) {
    const prefix = `Item ${it.index ?? '?'} (${it.mfgSku ?? '?'} ${it.color ?? ''})`.trim();
    for (const f of it.flags) out.push({ ...f, message: `${prefix}: ${f.message}` });
    for (const d of it.decorations)
      for (const f of d.flags) out.push({ ...f, message: `${prefix}, ${d.location ?? 'decoration'}: ${f.message}` });
  }
  return out;
}

export const hasBlocking = (flags: Flag[]) => flags.some((f) => f.level === 'block');
