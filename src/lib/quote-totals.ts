/**
 * Single source of truth for quote money math.
 *
 * `quotes.total_price` stores the GRAND TOTAL (line items + sales tax).
 * Never treat it as a pre-tax subtotal. Derive subtotal and tax from the
 * line items with `computeQuoteTotals`.
 *
 * Edge functions can't import from `src/`, so the block between the
 * BEGIN/END markers is copied verbatim into:
 *   - supabase/functions/send-quote-email/index.ts
 *   - supabase/functions/create-quote-checkout/index.ts
 * `quote-totals.test.ts` fails if any copy drifts from this file.
 */

// BEGIN quote-totals (keep in sync, see src/lib/quote-totals.ts)
export interface QuoteTaxSettings {
  apply_sales_tax: boolean | null | undefined;
  is_nonprofit: boolean | null | undefined;
  tax_rate: number | string | null | undefined;
}

export interface QuoteTotals {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
}

/** Sales tax percentage that actually applies to a quote. Nonprofits pay no tax. */
export function getEffectiveTaxRate(settings: QuoteTaxSettings): number {
  if (!settings.apply_sales_tax || settings.is_nonprofit) return 0;
  const rate = Number(settings.tax_rate);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/** Totals in dollars, computed in whole cents so every consumer agrees to the penny. */
export function computeQuoteTotals(
  lineItems: ReadonlyArray<{ line_total?: number | string | null }> | null | undefined,
  settings: QuoteTaxSettings,
): QuoteTotals {
  const subtotalCents = (lineItems ?? []).reduce(
    (sum, item) => sum + Math.round((Number(item.line_total) || 0) * 100),
    0,
  );
  const taxRate = getEffectiveTaxRate(settings);
  const taxCents = Math.round((subtotalCents * taxRate) / 100);
  return {
    subtotal: subtotalCents / 100,
    taxRate,
    taxAmount: taxCents / 100,
    grandTotal: (subtotalCents + taxCents) / 100,
  };
}
// END quote-totals
