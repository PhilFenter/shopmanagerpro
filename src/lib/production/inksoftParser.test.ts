import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allOrderFlags, countBatch, countOrder, hasBlocking, parseInkSoftDate, parseWorkOrders } from './inksoftParser';
import { parseInkSoftOrdersCsv } from './inksoftCsv';
import { proposeMethod, DEFAULT_METHOD_RULES } from './methods';
import { buildImportPayload } from './importPayload';
import type { PdfData } from './pdfTypes';

const fixture = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', `${n}.json`), 'utf8')) as PdfData;
const A = () => parseWorkOrders(fixture('workorder-1002714'));
const B = () => parseWorkOrders(fixture('workorders-5'));
const C = () => parseWorkOrders(fixture('workorders-3'));

describe('InkSoft work-order parser: Test A (order 1002714)', () => {
  const b = A();
  const o = b.orders[0];
  it('counts', () => {
    expect(countBatch(b)).toEqual({ orders: 1, garments: 5, tasks: 6, labels: 5 });
    expect(o.pages).toEqual([1, 2, 3]);
  });
  it('header', () => {
    expect(o).toMatchObject({
      orderNumber: '1002714', customerName: 'Customer A', storeName: 'Tri-State Employee Store',
      orderDate: '2026-10-01', shipDate: '2026-10-21', printedAt: '25 Oct 2026 at 8:16 AM',
    });
  });
  it('products, sizes, colors (answer key)', () => {
    expect(o.items.map((i) => [i.index, i.of, i.mfgSku, i.color, i.sizes.map((s) => `${s.size}:${s.qty}`).join(','), i.total])).toEqual([
      [1, 5, 'LPC450', 'Light Blue', 'L:1', 1],
      [2, 5, 'NL9087', 'StnwshDnm', 'XL:1', 1],
      [3, 5, '3413', 'Aqua TB', 'L:1', 1],
      [4, 5, 'BC3513', 'DenimTB', 'L:1', 1],
      [5, 5, '18000', 'Heliconia', 'L:1', 1],
    ]);
  });
  it('decorations keep InkSoft wording, dimensions, and both thread variants', () => {
    const d = o.items.map((i) => i.decorations.map((x) => [x.location, x.methodInksoft, x.colorway, x.heightIn, x.widthIn, x.colors.join(';')]));
    expect(d[0]).toEqual([['Front - Left Chest', 'Embroidery', 'Colorway 1', 0.69, 4.02, '1800 Madeira Poly Emerald Black']]);
    expect(d[2]).toEqual([['Front - Left Chest', 'Embroidery', 'Original Art', 0.69, 4.02, '1801 Madeira Poly Super White']]);
    expect(d[4]).toEqual([
      ['Front - Front', 'DigitalPrint', 'Original Art', null, null, 'White | PMS 663 C | RGB 255 255 255'],
      ['Back - Back', 'DigitalPrint', 'Original Art', null, null, 'White | PMS 663 C | RGB 255 255 255'],
    ]);
  });
  it('crewneck front and back have different artwork previews', () => {
    const [f, bk] = o.items[4].decorations;
    expect(f.artwork?.hash).toBeTruthy();
    expect(bk.artwork?.hash).toBeTruthy();
    expect(f.artwork?.hash).not.toBe(bk.artwork?.hash);
  });
  it('a shortened InkSoft SKU is noted on the item but not flagged; nothing blocks', () => {
    const flags = allOrderFlags(o);
    expect(hasBlocking(flags)).toBe(false);
    expect(flags).toEqual([]);
    expect(o.items.some((i) => i.truncated.includes('inksoftSku'))).toBe(true);
  });
});

describe('InkSoft work-order parser: Test B (5 orders)', () => {
  const b = B();
  it('counts', () => {
    expect(countBatch(b)).toEqual({ orders: 5, garments: 10, tasks: 15, labels: 10 });
    expect(b.orders.map((o) => [o.orderNumber, o.pages, countOrder(o).garments, countOrder(o).tasks])).toEqual([
      ['1002747', [1], 3, 6],
      ['1002748', [2, 3], 3, 4],
      ['1002750', [4], 1, 2],
      ['1002751', [5], 1, 1],
      ['1002752', [6], 2, 2],
    ]);
  });
  it('multiple stores and customers', () => {
    expect(b.orders.map((o) => o.storeName)).toEqual([
      'Maggie Creek Fire', 'Tri-State Employee Store', 'Maggie Creek Fire', 'Tri-State Employee Store', 'Evergreen Estates',
    ]);
    expect(new Set(b.orders.map((o) => o.customerName)).size).toBe(4);
  });
  it('same artwork on left chest and full back (different sizes) and verbatim methods', () => {
    const [lc, back] = b.orders[0].items[0].decorations;
    expect([lc.location, back.location]).toEqual(['Front - Left Chest', 'Back - Full']);
    expect(lc.methodInksoft).toBe('ScreenPrint');
    expect(lc.artwork?.hash).toBe(back.artwork?.hash);
    expect(lc.mockup?.hash).not.toBe(back.mockup?.hash);
    expect(lc.colorCount).toBe('Full Color');
  });
  it('rayon and poly thread sets stay distinct', () => {
    expect(b.orders[1].items[0].decorations[0].colors).toEqual(['1366 Madeira Rayon', '1245 Madeira Rayon', '1133 Madeira Rayon']);
    expect(b.orders[3].items[0].decorations[0].colors).toEqual([
      '1967 Madeira Poly Dark Denim', '1988 Madeira Poly Kelly Green', '1733 Madeira Poly Blue Jay',
    ]);
  });
  it('colorways of the same design are kept apart', () => {
    const d = b.orders[4].items.map((i) => [i.color, i.designId, i.decorations[0].colorway]);
    expect(d).toEqual([['Jet Black', '16655756', 'Colorway 1'], ['True Celadon', '16655756', 'Colorway 3']]);
  });
  it('nothing blocks; names InkSoft shortened are noted, not flagged (SKU and color are whole)', () => {
    for (const o of b.orders) expect(hasBlocking(allOrderFlags(o))).toBe(false);
    const codes = b.orders.flatMap((o) => allOrderFlags(o).map((f) => f.code));
    expect(codes.filter((c) => c.startsWith('truncated'))).toEqual([]);
    const items = b.orders.flatMap((o) => o.items);
    expect(items.filter((i) => i.truncated.includes('designName'))).toHaveLength(2);
    expect(items.filter((i) => i.truncated.includes('mfgSku') || i.truncated.includes('color'))).toHaveLength(0);
  });
});

describe('InkSoft work-order parser: 3-order file and problem files', () => {
  it('3-order file', () => {
    expect(countBatch(C())).toEqual({ orders: 3, garments: 7, tasks: 12, labels: 7 });
  });
  it('a missing page is a blocking problem', () => {
    const pdf = fixture('workorders-5');
    pdf.pages = pdf.pages.filter((p) => p.page !== 3); // 1002748 page 2 of 2
    const o = parseWorkOrders(pdf).orders.find((x) => x.orderNumber === '1002748')!;
    const codes = allOrderFlags(o).filter((f) => f.level === 'block').map((f) => f.code);
    expect(codes).toContain('missing_pages');
    expect(codes).toContain('missing_items');
  });
  it('sizes that don’t add up to TOTAL block approval', () => {
    const pdf = fixture('workorder-1002714');
    const total = pdf.pages[0].items.filter((i) => i.t === '1' && Math.abs(i.x - 106.8) < 1)[1]; // TOTAL qty of item 1
    total.t = '2';
    const flags = allOrderFlags(parseWorkOrders(pdf).orders[0]);
    expect(flags.find((f) => f.code === 'total_mismatch')?.level).toBe('block');
  });
  it('a file with no work orders', () => {
    const b = parseWorkOrders({ title: null, pages: [{ page: 1, width: 612, height: 792, items: [{ t: 'Hello', x: 10, y: 10, w: 10, h: 10 }], images: [] }] });
    expect(b.orders).toHaveLength(0);
    expect(b.flags.map((f) => f.code)).toContain('page_without_order');
  });
  it('dates', () => {
    expect(parseInkSoftDate('5 Nov 2026')).toBe('2026-11-05');
    expect(parseInkSoftDate('soon')).toBeNull();
  });
});

describe('method rules', () => {
  it('ScreenPrint is DTF (recorded as an override), DigitalPrint is DTF, embroidery stays', () => {
    expect(proposeMethod('ScreenPrint', 'Maggie Creek Fire', DEFAULT_METHOD_RULES)).toMatchObject({ method: 'dtf', source: 'rule', isOverride: true });
    expect(proposeMethod('DigitalPrint', null, DEFAULT_METHOD_RULES)).toMatchObject({ method: 'dtf', isOverride: false });
    expect(proposeMethod('Embroidery', null, DEFAULT_METHOD_RULES)).toMatchObject({ method: 'embroidery' });
    expect(proposeMethod('Laser', null, DEFAULT_METHOD_RULES)).toMatchObject({ method: null, source: null });
  });
});

describe('InkSoft Orders CSV', () => {
  const csv = [
    '\uFEFF"Order ID","First Name","Last Name","Email","Store / Company","Quantity of Items","Profit","Checkout Option 1","Checkout Input 1","Checkout Option 2","Checkout Input 2","Checkout Option 3","Checkout Input 3","Shipping Method / Pickup Location","Address Phone"',
    '"1002748","A","B","a@example.com","Tri-State Employee Store","3","$10","Department","Float, Front Desk","Department Number","630100","EE#","3324","INTERNAL-PickUp Tri-State ","555"',
    '"1002747","C","D","c@example.com","Maggie Creek Fire","3","","","","","","","","INTERNAL-PickUp Hells Canyon Designs",""',
    '"1002799","E","F","","Store","2","","","","","","","","UPS Ground",""',
  ].join('\r\n');
  const r = parseInkSoftOrdersCsv(csv);
  it('pickup vs ship and pickup location', () => {
    expect(r.orders.map((o) => [o.orderNumber, o.fulfillment, o.pickupLocation, o.shippingMethod])).toEqual([
      ['1002748', 'pickup', 'Tri-State', null],
      ['1002747', 'pickup', 'Hells Canyon Designs', null],
      ['1002799', 'ship', null, 'UPS Ground'],
    ]);
  });
  it('keeps department fields, drops EE#, prices and phone', () => {
    expect(r.orders[0].checkoutFields).toEqual([
      { label: 'Department', value: 'Float, Front Desk' },
      { label: 'Department Number', value: '630100' },
    ]);
    expect(JSON.stringify(r.orders)).not.toMatch(/3324|\$10|"555"/);
    expect(r.orders[0].itemCount).toBe(3);
  });
  it('rejects a file that isn’t an orders export', () => {
    expect(parseInkSoftOrdersCsv('a,b\n1,2').error).toMatch(/Order ID/);
  });
});

describe('import payload', () => {
  it('content hash ignores the printed time, so a fresh download matches', async () => {
    const p1 = await buildImportPayload(B(), DEFAULT_METHOD_RULES, null);
    const p2 = await buildImportPayload(C(), DEFAULT_METHOD_RULES, null);
    expect(p1.orders[0].printed_at).not.toBe(p2.orders[0].printed_at);
    expect(p2.orders.map((o) => o.content_sha256)).toEqual(p1.orders.slice(0, 3).map((o) => o.content_sha256));
  });
  it('a quantity change changes the hash', async () => {
    const b = A();
    const h1 = (await buildImportPayload(b, DEFAULT_METHOD_RULES, null)).orders[0].content_sha256;
    b.orders[0].items[0].sizes[0].qty = 2;
    const h2 = (await buildImportPayload(b, DEFAULT_METHOD_RULES, null)).orders[0].content_sha256;
    expect(h1).not.toBe(h2);
  });
});
