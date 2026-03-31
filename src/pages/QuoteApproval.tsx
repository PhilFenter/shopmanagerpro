import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, CreditCard, Loader2, AlertTriangle } from 'lucide-react';

interface LineItem {
  id: string;
  service_type: string;
  description: string | null;
  style_number: string | null;
  quantity: number;
  color: string | null;
  placement: string | null;
  line_total: number | null;
  sizes: any;
  sort_order: number | null;
  image_url: string | null;
}

interface PublicQuote {
  id: string;
  quote_number: string | null;
  customer_name: string;
  company: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  status: string;
  total_price: number | null;
  notes: string | null;
  requested_date: string | null;
  approved_at: string | null;
  converted_job_id: string | null;
  apply_sales_tax: boolean;
  tax_rate: number;
  is_nonprofit: boolean;
  delivery_method: string | null;
  payment_terms: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at: string;
  quote_line_items: LineItem[];
}

const SERVICE_FRIENDLY: Record<string, string> = {
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF Transfers',
  leather_patch: 'Custom Hats',
  custom_hats: 'Custom Hats',
  laser_engraving: 'Laser Engraving',
  other: 'Custom Apparel',
};

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  due_on_receipt: 'Payment due when order is placed',
  net_15: 'Net 15',
  net_30: 'Net 30',
  '50_50': '50% deposit, 50% on completion',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSizesFromItem(sizes: any): Record<string, number> {
  if (!sizes || typeof sizes !== 'object') return {};
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(sizes)) {
    if (typeof val === 'number' && val > 0) {
      result[key.toUpperCase()] = val;
    }
  }
  return result;
}

export default function QuoteApproval() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const paymentStatus = searchParams.get('payment');

  useEffect(() => {
    if (!token) return;
    fetchQuote();
  }, [token]);

  useEffect(() => {
    if (paymentStatus === 'success' && quote && !quote.approved_at && !approved) {
      handleApprove();
    }
  }, [paymentStatus, quote]);

  const fetchQuote = async () => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('quote-public-view', {
        body: { token },
      });
      if (fnErr || data?.error) {
        setError(data?.error || 'Quote not found');
      } else {
        setQuote(data.quote);
        if (data.quote.approved_at) setApproved(true);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('approve-quote', {
        body: { token },
      });
      if (fnErr || data?.error) {
        setError(data?.error || 'Failed to approve');
      } else {
        setApproved(true);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApproving(false);
    }
  };

  const handlePayAndApprove = async () => {
    setCheckingOut(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('create-quote-checkout', {
        body: { token },
      });
      if (fnErr || data?.error) {
        setError(data?.error || 'Failed to create checkout');
        setCheckingOut(false);
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      setError(e.message);
      setCheckingOut(false);
    }
  };

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    if (!quote) return { subtotal: 0, taxAmount: 0, grandTotal: 0 };
    const sub = quote.total_price || 0;
    const rate = quote.apply_sales_tax ? (quote.tax_rate || 6) : 0;
    const tax = sub * (rate / 100);
    return { subtotal: sub, taxAmount: tax, grandTotal: sub + tax };
  }, [quote]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white rounded-lg shadow-sm border max-w-md w-full p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Quote Not Found</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  const sortedItems = [...(quote.quote_line_items || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  // Check if any items have size breakdowns
  const hasSizes = sortedItems.some((item) => {
    const s = getSizesFromItem(item.sizes);
    return Object.keys(s).length > 0;
  });

  const customerAddress = [
    quote.address_line1,
    quote.address_line2,
    [quote.city, quote.state].filter(Boolean).join(', '),
    quote.zip,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto">
        {/* Success Banner */}
        {(approved || paymentStatus === 'success') && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
            <div>
              <h3 className="font-bold text-green-800">Quote Approved!</h3>
              <p className="text-sm text-green-700">
                {paymentStatus === 'success'
                  ? "Payment received — thank you! We'll get started on your order right away."
                  : "Thank you for approving. We'll reach out with next steps soon."}
              </p>
            </div>
          </div>
        )}

        {/* Main Invoice Card */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 bg-sky-500" />

          {/* Header: Business Info + Quote Details */}
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between gap-6">
              {/* Business Info */}
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Hell's Canyon Designs
                </h1>
                <p className="text-sm text-gray-600">904 D Street</p>
                <p className="text-sm text-gray-600">Lewiston, Idaho 83501</p>
                <p className="text-sm text-gray-600">+1 (208) 553-9624</p>
                <a
                  href="https://hellscanyondesigns.com"
                  className="text-sm text-sky-600 hover:underline block"
                >
                  hellscanyondesigns.com
                </a>
                <a
                  href="mailto:phil@hellscanyondesigns.com"
                  className="text-sm text-sky-600 hover:underline block"
                >
                  phil@hellscanyondesigns.com
                </a>
              </div>

              {/* Quote Details Panel */}
              <div className="border rounded-lg overflow-hidden text-sm min-w-[280px]">
                <table className="w-full">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-semibold text-right text-gray-700 bg-gray-50 whitespace-nowrap">
                        Quote #
                      </td>
                      <td className="px-4 py-2">{quote.quote_number || '—'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-semibold text-right text-gray-700 bg-gray-50 whitespace-nowrap">
                        Created
                      </td>
                      <td className="px-4 py-2">{formatDate(quote.created_at)}</td>
                    </tr>
                    {quote.requested_date && (
                      <tr className="border-b">
                        <td className="px-4 py-2 font-semibold text-right text-gray-700 bg-gray-50 whitespace-nowrap">
                          Requested Date
                        </td>
                        <td className="px-4 py-2">{formatDate(quote.requested_date)}</td>
                      </tr>
                    )}
                    <tr className="border-b">
                      <td className="px-4 py-2 font-semibold text-right text-gray-700 bg-gray-50 whitespace-nowrap">
                        Terms
                      </td>
                      <td className="px-4 py-2">
                        {PAYMENT_TERMS_LABELS[quote.payment_terms || 'due_on_receipt'] ||
                          quote.payment_terms ||
                          'Due on receipt'}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-semibold text-right text-gray-700 bg-gray-50 whitespace-nowrap">
                        Status
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="secondary"
                          className={
                            approved
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-sky-100 text-sky-800 border-sky-200'
                          }
                        >
                          {approved ? 'Approved' : quote.status === 'sent' ? 'Awaiting Approval' : quote.status}
                        </Badge>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-semibold text-right text-gray-700 bg-gray-50 whitespace-nowrap">
                        Total
                      </td>
                      <td className="px-4 py-2 font-bold text-lg">${grandTotal.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="px-6 md:px-8 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Customer
                </h3>
                {quote.company && (
                  <p className="text-sm font-semibold text-gray-900">{quote.company}</p>
                )}
                <p className="text-sm text-gray-700">{quote.customer_name}</p>
                {customerAddress.length > 0 &&
                  customerAddress.map((line, i) => (
                    <p key={i} className="text-sm text-gray-600">
                      {line}
                    </p>
                  ))}
                {quote.customer_email && (
                  <a
                    href={`mailto:${quote.customer_email}`}
                    className="text-sm text-sky-600 hover:underline block mt-1"
                  >
                    {quote.customer_email}
                  </a>
                )}
                {quote.customer_phone && (
                  <p className="text-sm text-gray-600">{quote.customer_phone}</p>
                )}
              </div>
              {quote.delivery_method && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Delivery
                  </h3>
                  <p className="text-sm text-gray-700 capitalize">
                    {quote.delivery_method === 'pickup'
                      ? 'Customer Pickup'
                      : quote.delivery_method === 'delivery'
                      ? 'Local Delivery'
                      : quote.delivery_method === 'ship'
                      ? 'Ship to Customer'
                      : quote.delivery_method}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="px-6 md:px-8 pb-6">
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700">Category</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700">Item #</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700">Color</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700">Description</th>
                    {hasSizes &&
                      SIZE_ORDER.map((s) => (
                        <th
                          key={s}
                          className="text-center px-2 py-2.5 font-semibold text-gray-700 min-w-[36px]"
                        >
                          {s}
                        </th>
                      ))}
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-700">Qty</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => {
                    const itemSizes = getSizesFromItem(item.sizes);
                    return (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="px-3 py-3 text-gray-700">
                          {SERVICE_FRIENDLY[item.service_type] || item.service_type}
                        </td>
                        <td className="px-3 py-3 text-gray-700 font-mono text-xs">
                          {item.style_number || '—'}
                        </td>
                        <td className="px-3 py-3 text-gray-700">{item.color || '—'}</td>
                        <td className="px-3 py-3 text-gray-900">
                          <div className="flex items-start gap-2">
                            {item.image_url && (
                              <img
                                src={item.image_url}
                                alt=""
                                className="w-10 h-10 rounded object-cover shrink-0"
                              />
                            )}
                            <div>
                              <p>{item.description || '—'}</p>
                              {item.placement && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Placement: {item.placement}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        {hasSizes &&
                          SIZE_ORDER.map((s) => (
                            <td key={s} className="text-center px-2 py-3 text-gray-600 tabular-nums">
                              {itemSizes[s] || ''}
                            </td>
                          ))}
                        <td className="text-center px-3 py-3 font-medium text-gray-900 tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="text-right px-3 py-3 font-medium text-gray-900 tabular-nums">
                          ${(item.line_total || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="px-6 md:px-8 pb-6">
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between text-sm py-1">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium tabular-nums">${subtotal.toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm py-1">
                    <span className="text-gray-500">Sales Tax ({quote.tax_rate}%)</span>
                    <span className="font-medium tabular-nums">${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold py-2 border-t border-gray-300 mt-1">
                  <span>Total</span>
                  <span className="tabular-nums">${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="px-6 md:px-8 pb-6">
              <div className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Notes
                </p>
                <p className="text-sm whitespace-pre-wrap text-gray-700">{quote.notes}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!approved && (
            <div className="px-6 md:px-8 pb-8">
              <div className="border-t pt-6 space-y-3 max-w-md mx-auto">
                <Button
                  size="lg"
                  className="w-full text-base py-5 bg-green-600 hover:bg-green-700"
                  onClick={handlePayAndApprove}
                  disabled={checkingOut || approving}
                >
                  {checkingOut ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing checkout...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" /> Pay & Approve — ${grandTotal.toFixed(2)}
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={handleApprove}
                  disabled={approving || checkingOut}
                >
                  {approving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" /> Approve Without Payment
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-gray-400">
                  By approving, you authorize Hell's Canyon Designs to begin work on this order.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-6">
          <p>Hell's Canyon Designs · Custom Apparel & Embroidery</p>
          <p className="mt-1">Questions? Email us or give us a call.</p>
        </div>
      </div>
    </div>
  );
}
