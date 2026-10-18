import { describe, it, expect } from "vitest";
import { priceLine, newLine, chosen, lineTotal, describeLine, type CounterLine } from "./counterQuote";
import { suggestTiers, dtfColForPlacement, assumptionsFor } from "../../supabase/functions/_shared/hcd-pricing.ts";

// Fake DB with an empty product_catalog → pricing uses the SanMar list price table
// in hcd-pricing.ts, which is what the printed Front Counter Pricing Guide uses.
const db = {
  from: () => {
    const q: any = { select: () => q, eq: () => q, gt: () => q, in: () => q, gte: () => q, limit: async () => ({ data: [] }) };
    return q;
  },
};

const line = (patch: Partial<CounterLine>): CounterLine => ({ ...newLine(patch.item ?? "tee"), ...patch });

describe("counter quote pricing matches the email engine + counter guide", () => {
  it("48 mid-grade tees, 1-color front = $11.34 each + $20 screen", async () => {
    const l = line({ qty: 48, method: "screen_print", colors: 1, placements: ["Front"], tier: "better" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(11.34); // 5.19 × 1.80 + 2.00
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
    expect(chosen(l, p)!.unit_price).toBe(8.45); // 4.00 × 1.60 + 2.05
    expect(p.fees).toEqual([]);
  });

  it("screen print below minimum blocks and offers DTF", async () => {
    const p = await priceLine(db, line({ qty: 30, method: "screen_print", colors: 2, placements: ["Front"] }));
    expect(p.blocker).toMatch(/36/);
    expect(p.suggestDtf).toBe(true);
  });

  it("8 value hoodies, DTF 11x14 = $42.21 + $30 small order", async () => {
    const l = line({ item: "hoodie", qty: 8, method: "dtf", dtfFront: 2, placements: ["Front"], tier: "good" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(42.21); // 14.41 × 2.00 + 11.79 + 1.60 press
    expect(lineTotal(l, p)).toBeCloseTo(367.68, 2);
  });

  it("12 mid-grade polos, left-chest embroidery = $39.08 + $45 digitizing", async () => {
    const l = line({ item: "polo", qty: 12, method: "embroidery", placements: ["Left chest"], tier: "better" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(39.08); // 12.04 × 2.00 + 15
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

  it("patch hats: Good/Better/Best = leatherette -$2 / sewn leather / full-color UV +$2", async () => {
    const h = line({ item: "hat", qty: 12, method: "patch", hatStyle: "112", placements: ["Front"] });
    const p = await priceLine(db, h);
    expect(p.tiers.map((t) => [t.tier, t.unit_price])).toEqual([["good", 25], ["better", 27], ["best", 29]]);
    expect(chosen(h, p)!.unit_price).toBe(27); // sewn leather is the default
    expect(chosen({ ...h, tier: "good" }, p)!.unit_price).toBe(25);
    const big = await priceLine(db, line({ item: "hat", qty: 500, method: "patch", hatStyle: "112", placements: ["Front"], tier: "good" }));
    expect(big.tiers.map((t) => t.unit_price)).toEqual([17, 19, 21]); // matches the 500-hat leatherette job at $17
    const emb = await priceLine(db, line({ item: "hat", qty: 12, method: "hat_embroidery", hatStyle: "112", placements: ["Front"] }));
    expect(emb.tiers.map((t) => t.unit_price)).toEqual([27]); // embroidery stays one price
  });

  it("700+ is a custom quote", async () => {
    const p = await priceLine(db, line({ qty: 700 }));
    expect(p.blocker).toMatch(/custom/);
  });

  it("DTF left chest is priced at 4x4", async () => {
    const l = line({ qty: 12, method: "dtf", placements: ["Left chest"], tier: "better" });
    expect(chosen(l, await priceLine(db, l))!.unit_price).toBe(13.99); // 10.38 + 2.01 + 1.60 press
  });

  it("DTF left chest + 11x14 back", async () => {
    const l = line({ qty: 24, method: "dtf", placements: ["Left chest", "Back"], dtfBack: 2, tier: "better" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.unit_price).toBe(22.69); // 9.86 + (2.01 + 1.60) + (7.62 + 1.60)
    expect(describeLine(l, chosen(l, p))).toContain("Left chest 4 x 4 + Back 11 x 14");
  });

  it("DTF 12x22 back: Supacolor 100+ $9.52 + $1.60 press = $11.12 at 144+ (Phil 2026-10-15)", async () => {
    const l = line({ qty: 200, method: "dtf", placements: ["Back"], dtfBack: 3, tier: "better" });
    const p = await priceLine(db, l);
    expect(chosen(l, p)!.decoration_cost).toBe(11.12);
    expect(describeLine(l, chosen(l, p))).toContain("Back 12 x 22");
    const s = line({ qty: 6, method: "dtf", placements: ["Front"], dtfFront: 3, tier: "better" });
    expect(chosen(s, await priceLine(db, s))!.decoration_cost).toBe(17.37); // 15.77 + 1.60
  });

  it("DTF 11x5 front + 11x5 back", async () => {
    const l = line({ qty: 12, method: "dtf", placements: ["Front", "Back"], dtfFront: 1, dtfBack: 1, tier: "better" });
    expect(chosen(l, await priceLine(db, l))!.unit_price).toBe(22.24); // 10.38 + (4.33 + 1.60) × 2
  });

  it("intake with no locations keeps the old default (11x5 + 4x4 extras)", async () => {
    const t = await suggestTiers(db, "tee", "dtf", 12, { locations: 2 });
    expect(t.find((x) => x.tier === "better")!.unit_price).toBe(19.92); // 10.38 + (4.33 + 1.60) + (2.01 + 1.60)
  });

  it("email/website: placements map chest/sleeve → 4x4, back → 11x14, front → 11x5", async () => {
    expect(["Left Chest", "left chest", "Pocket", "Right sleeve"].map(dtfColForPlacement)).toEqual([0, 0, 0, 0]);
    expect(["Full Back", "back", "Upper back"].map(dtfColForPlacement)).toEqual([2, 2, 2]);
    expect(["Front", "Full Front", "center front", "back of neck"].map(dtfColForPlacement)).toEqual([1, 1, 1, 0]);
    const t = await suggestTiers(db, "tee", "dtf", 12, { locations: 2, placements: ["left chest", "full back"] });
    expect(t.find((x) => x.tier === "better")!.unit_price).toBe(23.21); // 10.38 + (2.01 + 1.60) + (7.62 + 1.60)
    expect(assumptionsFor("dtf", null, ["left chest", "full back"])).toContain("full back 11x14");
  });

  // Fake catalog with one SanMar style the customer picked off the wall.
  const catalog: Record<string, { brand: string; description: string; piece_price: number; size_range: string; updated_at: string }[]> = {
    PC450: [
      { brand: "Port & Company", description: "Fan Favorite Tee", piece_price: 4.98, size_range: "LIST S-XL", updated_at: new Date().toISOString() },
      { brand: "Port & Company", description: "Fan Favorite Tee", piece_price: 6.98, size_range: "LIST 2XL", updated_at: new Date().toISOString() },
    ],
  };
  const catDb = {
    from: () => {
      let style = "";
      const q: any = {
        select: () => q, gt: () => q, in: () => q, gte: () => q,
        eq: (_c: string, v: string) => { style = v; return q; },
        limit: async () => ({ data: catalog[style] ?? [] }),
      };
      return q;
    },
  };

  it("customer's pick (PC450) is priced from the catalog with the same markup", async () => {
    const l = line({ qty: 24, method: "screen_print", colors: 1, placements: ["Front"], style: "pc450", usePick: true });
    const p = await priceLine(catDb, l);
    const s = chosen(l, p)!;
    expect(s.style).toBe("PC450");
    expect(s.name).toBe("Port & Company PC450 Fan Favorite Tee");
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
        if (fn !== "sanmar-api" || body.styleNumber !== "PC450") return { data: { success: false } };
        if (body.action === "getProductInfo") return { data: { success: true, items: [{ brandName: "Port & Company", title: "Fan Favorite Tee" }] } };
        return {
          data: {
            success: true,
            pricing: [
              { size: "S", piecePrice: 2.59 }, { size: "M", piecePrice: 2.89 }, { size: "XL", piecePrice: 2.89 },
              { size: "2XL", piecePrice: 4.34 }, { size: "2XL", piecePrice: 4.92 }, { size: "3XL", piecePrice: 6.46 },
            ],
          },
        };
      },
    },
  };

  it("prices PC450 from SanMar list price (higher color price), with a 2XL upcharge", async () => {
    const l = line({ qty: 24, method: "screen_print", colors: 1, placements: ["Front"], style: "PC450" });
    const p = await priceLine(sanmarDb, l);
    expect(p.requestedMissing).toBe(false);
    expect(p.requested!.garment_cost).toBe(2.89);
    expect(p.requested!.name).toBe("Port & Company PC450 Fan Favorite Tee");
    expect(p.requested!.upcharge_2xl).toBeGreaterThan(0);
  });

  it("asks SanMar once per style, then reuses it", async () => {
    calls.length = 0;
    await priceLine(sanmarDb, line({ qty: 48, style: "PC450" }));
    expect(calls.filter((c) => c.includes("PC450"))).toEqual([]);
  });

  it("not found anywhere → requestedMissing, house options still shown", async () => {
    const p = await priceLine(sanmarDb, line({ qty: 24, method: "screen_print", colors: 1, placements: ["Front"], style: "ZZZ999" }));
    expect(p.requestedMissing).toBe(true);
    expect(p.tiers.length).toBe(3);
  });
});

describe("screen print — different designs front and back", () => {
  const twoDesigns = (qty: number) =>
    line({ qty, method: "screen_print", colors: 1, colorsBy: { Front: 1, Back: 3 }, placements: ["Front", "Back"], tier: "better" });

  it("prices each location at its own color count, 4 screens", async () => {
    const one = await priceLine(db, line({ qty: 72, method: "screen_print", colors: 1, placements: ["Front"], tier: "better" }));
    const p = await priceLine(db, twoDesigns(72));
    const s = chosen(twoDesigns(72), p)!;
    // 72 row: 1-color $1.65 + 3-color $3.45
    expect(s.decoration_cost).toBe(5.1);
    expect(s.unit_price - chosen(line({ qty: 72, method: "screen_print", colors: 1, placements: ["Front"], tier: "better" }), one)!.unit_price).toBeCloseTo(3.45, 2);
    expect(p.fees[0].amount).toBe(80);
    expect(p.notes[0]).toContain("1-color Front + 3-color Back");
    expect(p.blocker).toBeNull();
    expect(p.approval).toBeNull();
  });

  it("minimum counts total colors (1 + 3 = 4 → 60); 48–59 needs a manager's OK", async () => {
    const p = await priceLine(db, twoDesigns(50));
    expect(p.blocker).toBeNull();
    expect(p.approval).toContain("60-piece minimum for 4 total colors");
    expect(lineTotal(twoDesigns(50), p)).toBeGreaterThan(0);
  });

  it("below the busiest design's own minimum is still a hard stop", async () => {
    const p = await priceLine(db, twoDesigns(40)); // 3-color back alone needs 48
    expect(p.blocker).toContain("48 pieces for 3 colors");
    expect(p.suggestDtf).toBe(true);
  });

  it("describes both designs for Printavo", () => {
    expect(describeLine(twoDesigns(72))).toContain("1-color Front + 3-color Back");
  });
});

describe("garment cost = SanMar list price (Phil 2026-10-14)", () => {
  it("PC78H at 12 with left chest + full back = $38.89; PC850 on the same list basis", async () => {
    const mk = (style: string) => line({ item: "hoodie", qty: 12, method: "dtf", placements: ["Left chest", "Back"], style, usePick: true });
    const a = chosen(mk("PC78H"), await priceLine(db, mk("PC78H")))!; // no SanMar in tests → list table
    const b = chosen(mk("PC850"), await priceLine(db, mk("PC850")))!;
    expect(a.garment_cost).toBe(14.63);
    expect(b.garment_cost).toBe(12.51);
    expect(a.unit_price).toBe(42.09); // 14.63 × 2.00 + (2.01 + 1.60) + (7.62 + 1.60)
    expect(b.unit_price).toBe(37.85); // 12.51 × 2.00 + (2.01 + 1.60) + (7.62 + 1.60)
  });

  it("old catalog rows (own price / stale) don't override the list table", async () => {
    const stale = {
      from: () => {
        const q: any = { select: () => q, eq: () => q, gt: () => q, in: () => q,
          gte: () => q,
          limit: async () => ({ data: [{ piece_price: 9.75, size_range: "(X)S-(X)L", updated_at: new Date().toISOString() }] }) };
        return q;
      },
    };
    const l = line({ item: "hoodie", qty: 12, method: "dtf", placements: ["Back"], style: "PC78H", usePick: true });
    expect(chosen(l, await priceLine(stale, l))!.garment_cost).toBe(14.63);
  });

  it("long sleeve tees use the long-sleeve picks", async () => {
    const p = await priceLine(db, line({ qty: 48, method: "screen_print", colors: 1, placements: ["Front"], sleeve: "long" }));
    expect(p.tiers.map((t) => t.style)).toEqual(["PC54LS", "NL6211", "BC3513"]);
    expect(p.tiers[1].unit_price).toBe(17.23); // 8.46 × 1.80 + 2.00
  });
});

describe("hat 3D puff", () => {
  it("adds $3 a hat to embroidered hats only", async () => {
    const base = { ...newLine("hat"), method: "hat_embroidery" as const, hatStyle: "112PFP", qty: 72 };
    expect((await priceLine(db, { ...base, puff: false })).tiers[0].unit_price).toBe(22.5);
    expect((await priceLine(db, { ...base, puff: true })).tiers[0].unit_price).toBe(25.5);
    // Patch hats ignore the puff flag
    const patch = { ...base, method: "patch" as const, puff: true };
    expect((await priceLine(db, patch)).tiers.find((t) => t.tier === "better")!.unit_price).toBe(22.5);
  });
});

describe("hat stitch tiers", () => {
  const base = { ...newLine("hat"), method: "hat_embroidery" as const, hatStyle: "112PFP", qty: 80 };
  it("adds $0 / $1 / $2 and stacks with puff", async () => {
    expect((await priceLine(db, { ...base, stitchTier: 0, puff: true })).tiers[0].unit_price).toBe(25.5);
    expect((await priceLine(db, { ...base, stitchTier: 1 })).tiers[0].unit_price).toBe(23.5);
    expect((await priceLine(db, { ...base, stitchTier: 2, puff: true })).tiers[0].unit_price).toBe(27.5);
  });
  it("over 16k is a quote per job", async () => {
    const p = await priceLine(db, { ...base, stitchTier: 3 });
    expect(p.blocker).toMatch(/16,000/);
  });
  it("patch hats ignore stitch tier", async () => {
    const p = await priceLine(db, { ...base, method: "patch", stitchTier: 2 });
    expect(p.tiers.find((t) => t.tier === "better")!.unit_price).toBe(22.5);
  });
});
