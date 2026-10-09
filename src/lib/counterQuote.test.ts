import { describe, it, expect } from "vitest";
import { priceLine, newLine, chosen, lineTotal, describeLine, type CounterLine } from "./counterQuote";
import { suggestTiers, dtfColForPlacement, assumptionsFor } from "../../supabase/functions/_shared/hcd-pricing.ts";

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
    const l = line({ item: "hoodie", qty: 8, method: "dtf", dtfFront: 2, placements: ["Front"], tier: "good" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(40.61);
    expect(lineTotal(l, p)).toBeCloseTo(354.88, 2);
  });

  it("12 mid-grade polos, left-chest embroidery = $39.08 + $45 digitizing", async () => {
    const l = line({ item: "polo", qty: 12, method: "embroidery", placements: ["Left chest"], tier: "better" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(39.08);
    expect(p.fees).toEqual([{ label: "Digitizing (one-time, to set up your logo)", amount: 45 }]);
    expect(lineTotal(l, p)).toBeCloseTo(513.96, 2);
  });

  it("apparel digitizing: with small-order fee under 12, waived at 50+", async () => {
    const few = await priceLine(db, line({ item: "hoodie", qty: 8, method: "embroidery", placements: ["Left chest"] }));
    expect(few.fees.map((f) => f.amount)).toEqual([30, 45]);
    const many = await priceLine(db, line({ item: "hoodie", qty: 50, method: "embroidery", placements: ["Left chest"] }));
    expect(many.fees).toEqual([]);
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

  it("DTF left chest is priced at 4x4", async () => {
    const l = line({ qty: 12, method: "dtf", placements: ["Left chest"], tier: "better" });
    expect(chosen(l, await priceLine(db, l))!.unit_price).toBe(12.39); // 10.38 + 2.01
  });

  it("DTF left chest + 11x14 back", async () => {
    const l = line({ qty: 24, method: "dtf", placements: ["Left chest", "Back"], dtfBack: 2, tier: "better" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(19.49); // 9.86 + 2.01 + 7.62
    expect(describeLine(l, chosen(l, p))).toContain("Left chest 4 x 4 + Back 11 x 14");
  });

  it("DTF 11x5 front + 11x5 back", async () => {
    const l = line({ qty: 12, method: "dtf", placements: ["Front", "Back"], dtfFront: 1, dtfBack: 1, tier: "better" });
    expect(chosen(l, await priceLine(db, l))!.unit_price).toBe(19.04); // 10.38 + 4.33 + 4.33
  });

  it("intake with no locations keeps the old default (11x5 + 4x4 extras)", async () => {
    const t = await suggestTiers(db, "tee", "dtf", 12, { locations: 2 });
    expect(t.find((x) => x.tier === "better")!.unit_price).toBe(16.72); // 10.38 + 4.33 + 2.01
  });

  it("email/website: placements map chest/sleeve → 4x4, back → 11x14, front → 11x5", async () => {
    expect(["Left Chest", "left chest", "Pocket", "Right sleeve"].map(dtfColForPlacement)).toEqual([0, 0, 0, 0]);
    expect(["Full Back", "back", "Upper back"].map(dtfColForPlacement)).toEqual([2, 2, 2]);
    expect(["Front", "Full Front", "center front", "back of neck"].map(dtfColForPlacement)).toEqual([1, 1, 1, 0]);
    const t = await suggestTiers(db, "tee", "dtf", 12, { locations: 2, placements: ["left chest", "full back"] });
    expect(t.find((x) => x.tier === "better")!.unit_price).toBe(20.01); // 10.38 + 2.01 + 7.62
    expect(assumptionsFor("dtf", null, ["left chest", "full back"])).toContain("full back 11x14");
  });

  // Fake catalog with one SanMar style the customer picked off the wall.
  const catalog: Record<string, { brand: string; description: string; piece_price: number; size_range: string }[]> = {
    PC55: [
      { brand: "Port & Company", description: "Core Blend Tee", piece_price: 4.98, size_range: "S-XL" },
      { brand: "Port & Company", description: "Core Blend Tee", piece_price: 6.98, size_range: "2XL" },
    ],
  };
  const catDb = {
    from: () => {
      let style = "";
      const q: any = {
        select: () => q, gt: () => q,
        eq: (_c: string, v: string) => { style = v; return q; },
        limit: async () => ({ data: catalog[style] ?? [] }),
      };
      return q;
    },
  };

  it("customer's pick (PC55) is priced from the catalog with the same markup", async () => {
    const l = line({ qty: 24, method: "screen_print", colors: 1, placements: ["Front"], style: "pc55", usePick: true });
    const p = await priceLine(catDb, l);
    const s = chosen(l, p)!;
    expect(s.style).toBe("PC55");
    expect(s.name).toBe("Port & Company PC55 Core Blend Tee");
    expect(s.unit_price).toBe(11.96); // 4.98 × 1.90 + 2.50
    expect(s.upcharge_2xl).toBe(3.8); // (6.98 − 4.98) × 1.90
    expect(p.nextBreak).toEqual({ qty: 48, unit: 10.96 }); // 4.98 × 1.80 + 2.00
    // tapping a house tier switches away from their pick
    expect(chosen({ ...l, usePick: false }, p)!.style).toBe("NL6210");
  });

  it("unknown style falls back to house tier and flags it", async () => {
    const l = line({ qty: 24, method: "screen_print", colors: 1, placements: ["Front"], style: "ZZ999", usePick: true });
    const p = await priceLine(catDb, l);
    expect(p.requestedMissing).toBe(true);
    expect(chosen(l, p)!.style).toBe("NL6210");
  });
});

describe("customer's pick — live SanMar lookup when the catalog doesn't have it", () => {
  const calls: string[] = [];
  const sanmarDb = {
    ...db,
    functions: {
      invoke: async (fn: string, { body }: { body: { action: string; styleNumber: string } }) => {
        calls.push(`${fn}:${body.action}:${body.styleNumber}`);
        if (fn !== "sanmar-api" || body.styleNumber !== "PC55") return { data: { success: false } };
        if (body.action === "getProductInfo") return { data: { success: true, items: [{ brandName: "Port & Company", title: "Core Blend Tee" }] } };
        return {
          data: {
            success: true,
            pricing: [
              { size: "S", myPrice: 2.59 }, { size: "M", myPrice: 2.89 }, { size: "XL", myPrice: 2.89 },
              { size: "2XL", myPrice: 4.34 }, { size: "2XL", myPrice: 4.92 }, { size: "3XL", myPrice: 6.46 },
            ],
          },
        };
      },
    },
  };

  it("prices PC55 from SanMar cost (higher color price), with a 2XL upcharge", async () => {
    const l = line({ qty: 24, method: "screen_print", colors: 1, placements: ["Front"], style: "PC55" });
    const p = await priceLine(sanmarDb, l);
    expect(p.requestedMissing).toBe(false);
    expect(p.requested!.garment_cost).toBe(2.89);
    expect(p.requested!.name).toBe("Port & Company PC55 Core Blend Tee");
    expect(p.requested!.upcharge_2xl).toBeGreaterThan(0);
  });

  it("asks SanMar once per style, then reuses it", async () => {
    calls.length = 0;
    await priceLine(sanmarDb, line({ qty: 48, style: "PC55" }));
    expect(calls.filter((c) => c.includes("PC55"))).toEqual([]);
  });

  it("not found anywhere → requestedMissing, house options still shown", async () => {
    const p = await priceLine(sanmarDb, line({ qty: 24, method: "screen_print", colors: 1, placements: ["Front"], style: "ZZZ999" }));
    expect(p.requestedMissing).toBe(true);
    expect(p.tiers.length).toBe(3);
  });
});
