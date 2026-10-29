import { describe, expect, it } from 'vitest';
import { buildPurchaseOrder, purchaseOrderCsv } from './purchaseOrder';

describe('buildPurchaseOrder', () => {
  const po = buildPurchaseOrder([
    { order_number: '1002752', mfg_sku: 'PC78H', color: 'Jet Black', product_name: 'Port & Co Core Fleece', sizes: [{ size: 'L', quantity: 1 }, { size: 'S', quantity: 2 }] },
    { order_number: '1002751', mfg_sku: 'pc78h', color: 'jet black', product_name: null, sizes: [{ size: 'L', quantity: 3 }, { size: '2XL', quantity: 1 }] },
    { order_number: '1002753', mfg_sku: 'DT6154', color: 'Black', product_name: 'District V.I.T.', sizes: [{ size: 'M', quantity: 0 }] },
    { order_number: '1002754', mfg_sku: null, color: 'Black', product_name: 'Mystery', sizes: [{ size: 'XL', quantity: 1 }] },
  ]);

  it('combines the same style and color across orders', () => {
    const l = po.lines.find((x) => x.mfg_sku === 'PC78H')!;
    expect(l.bySize).toEqual({ L: 4, S: 2, '2XL': 1 });
    expect(l.total).toBe(7);
    expect(l.orders).toEqual(['1002751', '1002752']);
  });
  it('skips zero quantities, flags missing style, and sorts sizes', () => {
    expect(po.lines.some((l) => l.mfg_sku === 'DT6154')).toBe(false);
    expect(po.lines.find((l) => !l.mfg_sku)!.needsCheck).toBe(true);
    expect(po.sizes).toEqual(['S', 'L', 'XL', '2XL']);
    expect(po.total).toBe(8);
  });
  it('writes one CSV row per size', () => {
    const csv = purchaseOrderCsv(po).trim().split('\r\n');
    expect(csv[0]).toBe('Style,Color,Size,Quantity,Description,Orders');
    expect(csv).toContain('PC78H,Jet Black,S,2,Port & Co Core Fleece,1002751 1002752');
    expect(csv.length).toBe(1 + 4);
  });
});

import { nextPoNumber } from './purchaseOrder';
describe('nextPoNumber', () => {
  it('adds one to the highest numeric PO and keeps leading zeros', () => {
    expect(nextPoNumber(['1001', null, 'SM-55', '1009'])).toBe('1010');
    expect(nextPoNumber(['0099'])).toBe('0100');
    expect(nextPoNumber([null, 'ABC'])).toBe('');
  });
});
