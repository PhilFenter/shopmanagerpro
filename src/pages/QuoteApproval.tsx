import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, CreditCard, Loader2, FileText, AlertTriangle, Clock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  quote_line_items: LineItem[];
}

const SERVICE_FRIENDLY: Record<string, string> = {
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF Transfer',
  leather_patch: 'Custom Hats',
  custom_hats: 'Custom Hats',
  laser_engraving: 'Laser Engraving',
  other: 'Custom Apparel',
};

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

  // If payment was successful, auto-approve
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Quote Not Found</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quote) return null;

  const sortedItems = [...(quote.quote_line_items || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-sky-700 tracking-tight">Hat Creek Designs</h1>
          <p className="text-sm text-muted-foreground">Custom Apparel & Embroidery</p>
        </div>

        {/* Success Banner */}
        {(approved || paymentStatus === 'success') && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6 flex items-center gap-4">
              <CheckCircle className="h-10 w-10 text-green-600 shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-green-800">Quote Approved!</h3>
                <p className="text-sm text-green-700">
                  {paymentStatus === 'success'
                    ? 'Payment received — thank you! We\'ll get started on your order right away.'
                    : 'Thank you for approving. We\'ll reach out with next steps soon.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Details Card */}
        <Card className="overflow-hidden">
          <div className="bg-sky-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-white" />
              <span className="text-white font-semibold text-lg">
                Quote {quote.quote_number || ''}
              </span>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                'text-xs font-medium',
                approved ? 'bg-green-100 text-green-800' : 'bg-sky-100 text-sky-800'
              )}
            >
              {approved ? 'Approved' : quote.status === 'sent' ? 'Awaiting Approval' : quote.status}
            </Badge>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Prepared for</span>
                <p className="font-semibold">{quote.customer_name}</p>
                {quote.company && <p className="text-muted-foreground">{quote.company}</p>}
              </div>
              {quote.requested_date && (
                <div className="text-right">
                  <span className="text-muted-foreground">Requested Date</span>
                  <p className="font-semibold flex items-center justify-end gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(quote.requested_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Line Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Order Details
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium">Item</th>
                      <th className="text-center px-4 py-2.5 font-medium">Qty</th>
                      <th className="text-right px-4 py-2.5 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            {item.image_url && (
                              <img
                                src={item.image_url}
                                alt=""
                                className="w-10 h-10 rounded object-cover shrink-0 mt-0.5"
                              />
                            )}
                            <div>
                              <p className="font-medium">
                                {item.description || SERVICE_FRIENDLY[item.service_type] || item.service_type}
                              </p>
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                {item.style_number && <p>Style: {item.style_number}</p>}
                                {item.color && <p>Color: {item.color}</p>}
                                {item.placement && <p>Placement: {item.placement}</p>}
                                {SERVICE_FRIENDLY[item.service_type] && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1">
                                    {SERVICE_FRIENDLY[item.service_type]}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-center px-4 py-3 font-medium">{item.quantity}</td>
                        <td className="text-right px-4 py-3 font-medium">
                          ${(item.line_total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sales Tax ({quote.tax_rate}%)</span>
                  <span className="font-medium">${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-sky-600">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <>
                <Separator />
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
                </div>
              </>
            )}

            {/* Action Buttons */}
            {!approved && (
              <div className="space-y-3 pt-4">
                <Button
                  size="lg"
                  className="w-full text-lg py-6 bg-green-600 hover:bg-green-700"
                  onClick={handlePayAndApprove}
                  disabled={checkingOut || approving}
                >
                  {checkingOut ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing checkout...</>
                  ) : (
                    <><CreditCard className="mr-2 h-5 w-5" /> Pay & Approve — ${grandTotal.toFixed(2)}</>
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
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Approving...</>
                  ) : (
                    <><CheckCircle className="mr-2 h-4 w-4" /> Approve Without Payment</>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By approving, you authorize Hat Creek Designs to begin work on this order.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pb-8">
          <p>Hat Creek Designs · Custom Apparel & Embroidery</p>
          <p className="mt-1">Questions? Email us or give us a call.</p>
        </div>
      </div>
    </div>
  );
}
