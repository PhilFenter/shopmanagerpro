import { describe, it, expect } from "vitest";
import { priceLine, newLine, chosen, lineTotal, type CounterLine } from "./counterQuote";

// Fake DB with an empty product_catalog → pricing falls back to the SanMar list in
// hcd-pricing.ts, which is what the printed Front Counter Pricing Guide uses.
const db = {
  from: () => {
    const q: any = { select: () => q, eq: () => q, gt: () => q, limit: async () => ({ data: [] }) };
    return q;
  },
};

const line = (patch: Partial<CounterLine>): CounterLine => ({ ...newLine(patch.item ?? "tee"), ...patch });

describe("counter quote pricing matches the email engine + counter guide", () => {
  it("48 mid-grade tees, 1-color front = $11.34 each + $20 screen", async () => {
    const l = line({ qty: 48, method: "screen_print", colors: 1, placements: ["Front"], tier: "better" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(11.34);
    expect(p.fees).toEqual([{ label: "Screen setup (1 screen, one-time)", amount: 20 }]);
    expect(lineTotal(l, p)).toBeCloseTo(564.32, 2);
    expect(p.nextBreak).toEqual({ qty: 72, unit: 10.47 });
  });

  it("front + back adds a 1-color print and a second screen", async () => {
    const l = line({ qty: 48, method: "screen_print", colors: 1, placements: ["Front", "Back"], tier: "better" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(13.34);
    expect(lineTotal(l, p)).toBeCloseTo(680.32, 2);
  });

  it("144 value tees, 2-color: screens waived", async () => {
    const l = line({ qty: 144, method: "screen_print", colors: 2, placements: ["Front"], tier: "good" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(8.45);
    expect(p.fees).toEqual([]);
  });

  it("screen print below minimum blocks and offers DTF", async () => {
    const p = await priceLine(db, line({ qty: 30, method: "screen_print", colors: 2, placements: ["Front"] }));
    expect(p.blocker).toMatch(/36/);
    expect(p.suggestDtf).toBe(true);
  });

  it("8 value hoodies, DTF 11x14 = $40.61 + $30 small order", async () => {
    const l = line({ item: "hoodie", qty: 8, method: "dtf", dtfSize: 2, placements: ["Front"], tier: "good" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(40.61);
    expect(lineTotal(l, p)).toBeCloseTo(354.88, 2);
  });

  it("12 mid-grade polos, left-chest embroidery = $39.08", async () => {
    const l = line({ item: "polo", qty: 12, method: "embroidery", placements: ["Left chest"], tier: "better" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(39.08);
  });

  it("hats: 12 x 112PT patch = $29, under 12 bills at 12, embroidery adds digitizing", async () => {
    const pt = line({ item: "hat", qty: 12, method: "patch", hatStyle: "112PT", placements: ["Front"] });
    expect(chosen(pt, await priceLine(db, pt))!.unit_price).toBe(29);
    const few = line({ item: "hat", qty: 8, method: "hat_embroidery", hatStyle: "112", placements: ["Front"] });
    const p = await priceLine(db, few);
    expect(p.billedQty).toBe(12);
    expect(p.fees[0].amount).toBe(45);
  });

  it("700+ is a custom quote", async () => {
    const p = await priceLine(db, line({ qty: 700 }));
    expect(p.blocker).toMatch(/custom/);
  });
});
