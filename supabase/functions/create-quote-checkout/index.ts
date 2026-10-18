import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface CheckoutLineItem {
  price_data: {
    currency: string;
    product_data: { name: string; description?: string };
    unit_amount: number;
  };
  quantity: number;
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Fetch quote
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*, quote_line_items(*)")
      .eq("approval_token", token)
      .single();

    if (qErr || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (quote.approved_at) {
      return new Response(JSON.stringify({ error: "Quote already approved" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sortedItems = [...(quote.quote_line_items || [])].sort(
      (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0),
    );

    // Same math the approval page and quote email use. total_price already
    // includes tax, so it must never be used as the taxable subtotal.
    const { taxRate, taxAmount, grandTotal } = computeQuoteTotals(sortedItems, quote);

    if (grandTotal <= 0) {
      return jsonResponse({ error: "This quote has no billable items yet. Please contact us to finalize it." }, 400);
    }

    // Charge each line's exact total in cents so the Stripe total matches the
    // quote to the penny. Use a per-unit price only when it divides evenly.
    const lineItems: CheckoutLineItem[] = [];
    for (const item of sortedItems) {
      const lineCents = Math.round((Number(item.line_total) || 0) * 100);
      if (lineCents < 0) {
        return jsonResponse({ error: "This quote includes a discount line and can't be paid online. Please contact us." }, 400);
      }
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const splitsEvenly = lineCents % quantity === 0;
      const name = item.description || item.service_type || "Custom Item";
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: splitsEvenly || quantity === 1 ? name : `${name} (${quantity} pcs)`,
            ...(item.style_number ? { description: `Style: ${item.style_number}${item.color ? ` | Color: ${item.color}` : ""}` } : {}),
          },
          unit_amount: splitsEvenly ? lineCents / quantity : lineCents,
        },
        quantity: splitsEvenly ? quantity : 1,
      });
    }

    const appUrl = "https://shopmanagerpro.lovable.app";
    const sessionParams: any = {
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      success_url: `${appUrl}/quote/approve/${token}?payment=success`,
      cancel_url: `${appUrl}/quote/approve/${token}?payment=cancelled`,
      customer_email: quote.customer_email || undefined,
      metadata: {
        quote_id: quote.id,
        quote_number: quote.quote_number || "",
      },
    };

    // Add sales tax as its own line
    if (taxAmount > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Sales Tax (${taxRate}%)`,
          },
          unit_amount: Math.round(taxAmount * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Save checkout session ID
    await supabase
      .from("quotes")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", quote.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
