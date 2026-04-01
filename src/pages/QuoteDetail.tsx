import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ALL_SIZES } from '@/components/quotes/SizeColumnManager';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useQuoteImprints, DECORATION_TYPES } from '@/hooks/useQuoteImprints';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { QUOTE_STATUS_CONFIG } from '@/hooks/useQuotes';
import { cn } from '@/lib/utils';
import { ImprintCard } from '@/components/quotes/ImprintCard';
import { SizeColumnManager, DEFAULT_VISIBLE_SIZES } from '@/components/quotes/SizeColumnManager';
import {
  ArrowLeft, Save, Trash2, Plus, Mail, Loader2, FileText, Stamp, RefreshCw, Image,
} from 'lucide-react';

const SERVICE_OPTIONS = [
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'screen_print', label: 'Screen Print' },
  { value: 'dtf', label: 'DTF' },
  { value: 'leather_patch', label: 'Leather Patch' },
  { value: 'custom_hats', label: 'Custom Hats' },
  { value: 'other', label: 'Other' },
];

const DELIVERY_OPTIONS = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'ship', label: 'Ship' },
];

const PAYMENT_TERMS_OPTIONS = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: '50_50', label: '50/50 Split' },
  { value: 'prepaid', label: 'Prepaid' },
];

interface LineItem {
  id: string;
  service_type: string;
  style_number: string | null;
  color: string | null;
  description: string | null;
  placement: string | null;
  sizes: Record<string, number>;
  size_costs: Record<string, number>;
  quantity: number;
  garment_cost: number;
  garment_markup_pct: number;
  decoration_cost: number;
  line_total: number;
  sort_order: number;
  notes: string | null;
  image_url: string | null;
  imprint_id: string | null;
  _dirty?: boolean;
  _new?: boolean;
}

interface QuoteData {
  id: string;
  quote_number: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  company: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  total_price: number | null;
  notes: string | null;
  requested_date: string | null;
  delivery_method: string | null;
  payment_terms: string | null;
  po_number: string | null;
  is_nonprofit: boolean;
  apply_sales_tax: boolean;
  tax_rate: number;
  follow_up_enabled: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  converted_job_id: string | null;
  customer_id: string | null;
}

function calculateLineTotal(item: LineItem): number {
  // Per-size-tier pricing: Σ(size_qty × tier_cost × markup) + (total_qty × decoration)
  const hasSizeCosts = Object.keys(item.size_costs).length > 0;
  
  if (hasSizeCosts) {
    let garmentTotal = 0;
    for (const [size, qty] of Object.entries(item.sizes)) {
      if (!qty) continue;
      const tierCost = item.size_costs[size] ?? item.garment_cost;
      garmentTotal += qty * tierCost * (1 + item.garment_markup_pct / 100);
    }
    const decorTotal = item.quantity * item.decoration_cost;
    return Number((garmentTotal + decorTotal).toFixed(2));
  }
  
  // Fallback: flat garment cost
  const garmentSell = item.garment_cost * (1 + item.garment_markup_pct / 100);
  return Number(((garmentSell + item.decoration_cost) * item.quantity).toFixed(2));
}

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isNew = id === 'new';

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [visibleSizes, setVisibleSizes] = useState<string[]>(DEFAULT_VISIBLE_SIZES);

  // Imprints hook — only for saved quotes
  const actualQuoteId = !isNew && id ? id : undefined;
  const { imprints, createImprint, updateImprint, deleteImprint } = useQuoteImprints(actualQuoteId);

  // Fetch existing quote
  const { data: fetchedQuote, isLoading } = useQuery({
    queryKey: ['quote-detail', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_line_items(*)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew && !!id,
  });

  // Initialize state for new quote
  useEffect(() => {
    if (isNew) {
      setQuote({
        id: '',
        quote_number: null,
        customer_name: '',
        customer_email: null,
        customer_phone: null,
        company: null,
        address_line1: null,
        address_line2: null,
        city: null,
        state: 'ID',
        zip: null,
        status: 'draft',
        total_price: 0,
        notes: null,
        requested_date: null,
        delivery_method: 'pickup',
        payment_terms: 'due_on_receipt',
        po_number: null,
        is_nonprofit: false,
        apply_sales_tax: true,
        tax_rate: 6.0,
        follow_up_enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: null,
        converted_job_id: null,
        customer_id: null,
      });
      setLineItems([createEmptyLineItem(0)]);
    }
  }, [isNew]);

  // Sync fetched data
  useEffect(() => {
    if (fetchedQuote && !dirty) {
      const { quote_line_items, ...rest } = fetchedQuote;
      setQuote(rest as any);
      const items = (quote_line_items || [])
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((li: any) => ({
          id: li.id,
          service_type: li.service_type || 'other',
          style_number: li.style_number,
          color: li.color,
          description: li.description,
          placement: li.placement,
          sizes: li.sizes || {},
          size_costs: li.size_costs || {},
          quantity: li.quantity || 0,
          garment_cost: li.garment_cost || 0,
          garment_markup_pct: li.garment_markup_pct ?? 200,
          decoration_cost: li.decoration_cost || 0,
          line_total: li.line_total || 0,
          sort_order: li.sort_order || 0,
          notes: li.notes,
          image_url: li.image_url,
          imprint_id: li.imprint_id || null,
        }));
      setLineItems(items.length > 0 ? items : [createEmptyLineItem(0)]);
      
      // Detect which sizes are in use and expand visible columns
      const usedSizes = new Set<string>();
      items.forEach((li: LineItem) => {
        Object.keys(li.sizes).forEach(s => { if (li.sizes[s]) usedSizes.add(s); });
      });
      if (usedSizes.size > 0) {
        const combined = [...new Set([...DEFAULT_VISIBLE_SIZES, ...usedSizes])];
        setVisibleSizes(ALL_SIZES.filter((s: string) => combined.includes(s)));
      }
    }
  }, [fetchedQuote]);

  function createEmptyLineItem(sortOrder: number): LineItem {
    return {
      id: crypto.randomUUID(),
      service_type: 'other',
      style_number: null,
      color: null,
      description: null,
      placement: null,
      sizes: {},
      size_costs: {},
      quantity: 0,
      garment_cost: 0,
      garment_markup_pct: 200,
      decoration_cost: 0,
      line_total: 0,
      sort_order: sortOrder,
      notes: null,
      image_url: null,
      imprint_id: null,
      _new: true,
      _dirty: true,
    };
  }

  const updateQuoteField = (field: keyof QuoteData, value: any) => {
    setQuote(prev => prev ? { ...prev, [field]: value } : prev);
    setDirty(true);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value, _dirty: true };

      // Recalculate quantity from sizes
      if (field === 'sizes') {
        const sizes = value as Record<string, number>;
        updated[index].quantity = Object.values(sizes).reduce((s: number, v: number) => s + (v || 0), 0);
      }

      // Recalculate line total with per-size-tier pricing
      updated[index].line_total = calculateLineTotal(updated[index]);

      return updated;
    });
    setDirty(true);
  };

  const updateSizeQty = (itemIndex: number, size: string, qty: number) => {
    const item = lineItems[itemIndex];
    const newSizes = { ...item.sizes, [size]: qty || 0 };
    if (!qty) delete newSizes[size];
    updateLineItem(itemIndex, 'sizes', newSizes);
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, createEmptyLineItem(prev.length)]);
    setDirty(true);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const addImprint = async () => {
    if (!actualQuoteId) {
      toast.error('Save the quote first before adding imprints');
      return;
    }
    await createImprint.mutateAsync({
      quote_id: actualQuoteId,
      decoration_type: 'screen_print',
      sort_order: imprints.length,
    });
  };

  // Calculate totals
  const subtotal = lineItems.reduce((s, li) => s + (li.line_total || 0), 0);
  const taxRate = quote?.apply_sales_tax && !quote?.is_nonprofit ? (quote?.tax_rate || 0) : 0;
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  const handleSave = async () => {
    if (!quote) return;
    if (!quote.customer_name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setSaving(true);
    try {
      const quotePayload = {
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        customer_phone: quote.customer_phone,
        company: quote.company,
        address_line1: quote.address_line1,
        address_line2: quote.address_line2,
        city: quote.city,
        state: quote.state,
        zip: quote.zip,
        status: quote.status,
        total_price: grandTotal,
        notes: quote.notes,
        requested_date: quote.requested_date,
        delivery_method: quote.delivery_method,
        payment_terms: quote.payment_terms,
        po_number: quote.po_number,
        is_nonprofit: quote.is_nonprofit,
        apply_sales_tax: quote.apply_sales_tax,
        tax_rate: quote.tax_rate,
        follow_up_enabled: quote.follow_up_enabled,
        customer_id: quote.customer_id,
      };

      let quoteId = quote.id;

      if (isNew) {
        const { data, error } = await supabase
          .from('quotes')
          .insert({ ...quotePayload, created_by: user?.id } as any)
          .select('id')
          .single();
        if (error) throw error;
        quoteId = data.id;
      } else {
        const { error } = await supabase
          .from('quotes')
          .update(quotePayload as any)
          .eq('id', quoteId);
        if (error) throw error;
      }

      // Save line items — delete all and re-insert
      if (!isNew) {
        await supabase.from('quote_line_items').delete().eq('quote_id', quoteId);
      }

      const lineItemPayloads = lineItems
        .filter(li => li.style_number || li.description || li.quantity > 0)
        .map((li, i) => ({
          quote_id: quoteId,
          service_type: li.service_type,
          style_number: li.style_number,
          color: li.color,
          description: li.description,
          placement: li.placement,
          sizes: li.sizes,
          size_costs: li.size_costs,
          quantity: li.quantity,
          garment_cost: li.garment_cost,
          garment_markup_pct: li.garment_markup_pct,
          decoration_cost: li.decoration_cost,
          line_total: li.line_total,
          sort_order: i,
          notes: li.notes,
          image_url: li.image_url,
          imprint_id: li.imprint_id,
        }));

      if (lineItemPayloads.length > 0) {
        const { error } = await supabase.from('quote_line_items').insert(lineItemPayloads as any);
        if (error) throw error;
      }

      toast.success(isNew ? 'Quote created' : 'Quote saved');
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] });

      if (isNew) {
        navigate(`/quotes/${quoteId}`, { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const sendQuoteEmail = async () => {
    if (!quote?.customer_email) {
      toast.error('No customer email');
      return;
    }
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: { quoteId: quote.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Quote sent to ${quote.customer_email}`);
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail', quote.id] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSendingEmail(false);
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quote) return null;

  const statusConfig = QUOTE_STATUS_CONFIG[quote.status] || QUOTE_STATUS_CONFIG.draft;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/quotes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isNew ? 'New Quote' : `Quote ${quote.quote_number || ''}`}
            </h1>
            {!isNew && (
              <p className="text-xs text-muted-foreground">
                Created {format(new Date(quote.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>
          <Badge className={cn('text-xs ml-2', statusConfig.color)} variant="secondary">
            {statusConfig.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && quote.customer_email && (
            <Button variant="outline" size="sm" onClick={sendQuoteEmail} disabled={sendingEmail}>
              {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {/* Customer & Quote Info */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Customer Name *</Label>
                <Input
                  value={quote.customer_name}
                  onChange={e => updateQuoteField('customer_name', e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div>
                <Label className="text-xs">Company</Label>
                <Input
                  value={quote.company || ''}
                  onChange={e => updateQuoteField('company', e.target.value || null)}
                  placeholder="Company"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={quote.customer_email || ''}
                  onChange={e => updateQuoteField('customer_email', e.target.value || null)}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  value={quote.customer_phone || ''}
                  onChange={e => updateQuoteField('customer_phone', e.target.value || null)}
                  placeholder="(555) 555-5555"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Address</Label>
              <Input
                value={quote.address_line1 || ''}
                onChange={e => updateQuoteField('address_line1', e.target.value || null)}
                placeholder="Street address"
                className="mb-2"
              />
              <div className="grid gap-2 grid-cols-3">
                <Input
                  value={quote.city || ''}
                  onChange={e => updateQuoteField('city', e.target.value || null)}
                  placeholder="City"
                />
                <Input
                  value={quote.state || ''}
                  onChange={e => updateQuoteField('state', e.target.value || null)}
                  placeholder="State"
                />
                <Input
                  value={quote.zip || ''}
                  onChange={e => updateQuoteField('zip', e.target.value || null)}
                  placeholder="ZIP"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quote Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quote Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={quote.status} onValueChange={v => updateQuoteField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">PO Number</Label>
                <Input
                  value={quote.po_number || ''}
                  onChange={e => updateQuoteField('po_number', e.target.value || null)}
                  placeholder="PO #"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Requested Date</Label>
                <Input
                  type="date"
                  value={quote.requested_date ? format(new Date(quote.requested_date), 'yyyy-MM-dd') : ''}
                  onChange={e => updateQuoteField('requested_date', e.target.value ? new Date(e.target.value).toISOString() : null)}
                />
              </div>
              <div>
                <Label className="text-xs">Payment Terms</Label>
                <Select value={quote.payment_terms || 'due_on_receipt'} onValueChange={v => updateQuoteField('payment_terms', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Delivery Method</Label>
                <Select value={quote.delivery_method || 'pickup'} onValueChange={v => updateQuoteField('delivery_method', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERY_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-4 pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={quote.apply_sales_tax}
                    onCheckedChange={v => updateQuoteField('apply_sales_tax', v)}
                  />
                  <Label className="text-xs">Sales Tax</Label>
                </div>
                {quote.apply_sales_tax && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={quote.tax_rate}
                      onChange={e => updateQuoteField('tax_rate', parseFloat(e.target.value) || 0)}
                      className="w-16 h-8 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={quote.is_nonprofit}
                    onCheckedChange={v => updateQuoteField('is_nonprofit', v)}
                  />
                  <Label className="text-xs">Nonprofit</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <SizeColumnManager
              visibleSizes={visibleSizes}
              onVisibleSizesChange={setVisibleSizes}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead className="w-[100px]">Item #</TableHead>
                  <TableHead className="w-[80px]">Color</TableHead>
                  <TableHead className="min-w-[140px]">Description</TableHead>
                  {visibleSizes.map(s => (
                    <TableHead key={s} className="w-[48px] text-center text-xs">{s}</TableHead>
                  ))}
                  <TableHead className="w-[56px] text-center">Qty</TableHead>
                  <TableHead className="w-[80px] text-right">Garment $</TableHead>
                  <TableHead className="w-[64px] text-right">Markup %</TableHead>
                  <TableHead className="w-[80px] text-right">Decor $</TableHead>
                  <TableHead className="w-[90px] text-right">Total</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li, idx) => (
                  <TableRow key={li.id}>
                    <TableCell className="p-1">
                      <Select value={li.service_type} onValueChange={v => updateLineItem(idx, 'service_type', v)}>
                        <SelectTrigger className="h-8 text-xs border-0 bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        value={li.style_number || ''}
                        onChange={e => updateLineItem(idx, 'style_number', e.target.value || null)}
                        className="h-8 text-xs border-0 bg-transparent px-1"
                        placeholder="PC54"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        value={li.color || ''}
                        onChange={e => updateLineItem(idx, 'color', e.target.value || null)}
                        className="h-8 text-xs border-0 bg-transparent px-1"
                        placeholder="Black"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        value={li.description || ''}
                        onChange={e => updateLineItem(idx, 'description', e.target.value || null)}
                        className="h-8 text-xs border-0 bg-transparent px-1"
                        placeholder="Port & Co Tee"
                      />
                    </TableCell>
                    {visibleSizes.map(size => (
                      <TableCell key={size} className="p-1">
                        <Input
                          type="number"
                          min={0}
                          value={li.sizes[size] || ''}
                          onChange={e => updateSizeQty(idx, size, parseInt(e.target.value) || 0)}
                          className="h-8 w-11 text-xs text-center border-0 bg-transparent px-0"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="p-1 text-center text-xs font-medium">
                      {li.quantity || 0}
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={li.garment_cost || ''}
                        onChange={e => updateLineItem(idx, 'garment_cost', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-right border-0 bg-transparent px-1 w-[72px]"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        type="number"
                        step="1"
                        min={0}
                        value={li.garment_markup_pct}
                        onChange={e => updateLineItem(idx, 'garment_markup_pct', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-right border-0 bg-transparent px-1 w-[56px]"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={li.decoration_cost || ''}
                        onChange={e => updateLineItem(idx, 'decoration_cost', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-right border-0 bg-transparent px-1 w-[72px]"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="p-1 text-right text-xs font-semibold pr-3">
                      ${li.line_total.toFixed(2)}
                    </TableCell>
                    <TableCell className="p-1">
                      {lineItems.length > 1 && (
                        <button
                          onClick={() => removeLineItem(idx)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Action Bar — Printavo-style */}
          <div className="flex items-center justify-between gap-2 p-3 border-t bg-muted/30">
            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4" /> Line Item
              </Button>
              <Button variant="secondary" size="sm" onClick={addImprint}>
                <Stamp className="h-4 w-4" /> Imprint
              </Button>
              <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => toast.info('Refresh pricing coming soon — will re-pull garment costs from SanMar/S&S')}>
                <RefreshCw className="h-4 w-4" /> Refresh Pricing
              </Button>
            </div>
            {!isNew && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/quotes/${id}/mockup`)}>
                <Image className="h-4 w-4" /> Mockup Creator
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Imprint Cards */}
      {imprints.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {imprints.map((imp, idx) => (
            <ImprintCard
              key={imp.id}
              imprint={imp}
              index={idx}
              onUpdate={(id, updates) => updateImprint.mutate({ id, ...updates })}
              onDelete={(id) => deleteImprint.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Notes & Totals */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={quote.notes || ''}
              onChange={e => updateQuoteField('notes', e.target.value || null)}
              placeholder="Internal notes, special instructions..."
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sales Tax ({taxRate}%)</span>
                <span className="font-medium">${taxAmount.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
