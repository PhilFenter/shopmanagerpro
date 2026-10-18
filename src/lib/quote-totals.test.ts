import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeQuoteTotals, getEffectiveTaxRate } from "./quote-totals";

const taxed = { apply_sales_tax: true, is_nonprofit: false, tax_rate: 6 };

describe("computeQuoteTotals", () => {
  it("adds tax once on top of the line items", () => {
    expect(computeQuoteTotals([{ line_total: 600 }, { line_total: 400 }], taxed)).toEqual({
      subtotal: 1000,
      taxRate: 6,
      taxAmount: 60,
      grandTotal: 1060,
    });
  });

  it("charges nonprofits no tax", () => {
    const totals = computeQuoteTotals([{ line_total: 1000 }], { ...taxed, is_nonprofit: true });
    expect(totals.taxAmount).toBe(0);
    expect(totals.grandTotal).toBe(1000);
  });

  it("charges no tax when sales tax is off", () => {
    const totals = computeQuoteTotals([{ line_total: 1000 }], { ...taxed, apply_sales_tax: false });
    expect(totals.grandTotal).toBe(1000);
  });

  it("respects an explicit 0% rate instead of falling back to 6%", () => {
    expect(computeQuoteTotals([{ line_total: 1000 }], { ...taxed, tax_rate: 0 }).taxAmount).toBe(0);
    expect(computeQuoteTotals([{ line_total: 1000 }], { ...taxed, tax_rate: null }).taxAmount).toBe(0);
  });

  it("rounds to whole cents so the parts always add up to the total", () => {
    // 1999 + 10 + 20 = 2029 cents; 6.5% of 2029 = 131.885, which rounds to 132 cents.
    const totals = computeQuoteTotals([{ line_total: 19.99 }, { line_total: 0.1 }, { line_total: 0.2 }], {
      ...taxed,
      tax_rate: 6.5,
    });
    expect(totals.subtotal).toBe(20.29);
    expect(totals.taxAmount).toBe(1.32);
    expect(totals.grandTotal).toBe(21.61);
  });

  it("treats missing or non-numeric line totals as zero", () => {
    expect(computeQuoteTotals([{ line_total: null }, {}, { line_total: "abc" }, { line_total: "25.50" }], taxed).subtotal).toBe(25.5);
    expect(computeQuoteTotals(null, taxed).grandTotal).toBe(0);
  });

  it("accepts tax rates stored as numeric strings", () => {
    expect(getEffectiveTaxRate({ ...taxed, tax_rate: "6.0" })).toBe(6);
  });
});

describe("edge function copies", () => {
  const extractBlock = (source: string) => {
    const match = source.match(/\/\/ BEGIN quote-totals[\s\S]*?\/\/ END quote-totals/);
    return match?.[0];
  };
  // Normalize line endings: git may check files out with CRLF on Windows.
  const read = (relativePath: string) =>
    readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8").replace(/\r\n/g, "\n");

  const canonical = extractBlock(read("./quote-totals.ts"));

  it.each([
    "../../supabase/functions/send-quote-email/index.ts",
    "../../supabase/functions/create-quote-checkout/index.ts",
  ])("%s matches src/lib/quote-totals.ts exactly", (path) => {
    expect(canonical).toBeDefined();
    expect(extractBlock(read(path))).toBe(canonical);
  });
});
