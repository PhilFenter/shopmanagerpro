import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Build Stripe line items
    const lineItems = (quote.quote_line_items || [])
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((item: any) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.description || item.service_type || "Custom Item",
            ...(item.style_number ? { description: `Style: ${item.style_number}${item.color ? ` | Color: ${item.color}` : ""}` } : {}),
          },
          unit_amount: Math.round((item.line_total || 0) * 100 / (item.quantity || 1)),
        },
        quantity: item.quantity || 1,
      }));

    // Add tax if applicable
    const taxRate = quote.apply_sales_tax ? (quote.tax_rate || 6) : 0;

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

    // Add automatic tax or manual tax line
    if (taxRate > 0) {
      // Add tax as a line item
      const subtotal = quote.total_price || 0;
      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100);
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Sales Tax (${taxRate}%)`,
          },
          unit_amount: taxAmount,
        },
        quantity: 1,
      });
      sessionParams.line_items = lineItems;
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
