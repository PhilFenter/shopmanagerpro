import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuotes, useQuoteLineItems, Quote, QuoteLineItem } from '@/hooks/useQuotes';
import { usePricingMatrices } from '@/hooks/usePricingMatrices';
import { useProductCatalog } from '@/hooks/useProductCatalog';
import { useGarmentSearch } from '@/hooks/useGarmentSearch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Plus, Trash2, Search, DollarSign, User, Building2,
  MapPin, Mail, Phone, Truck, Calendar, CreditCard, FileText,
  ChevronDown, ChevronUp, Loader2, Shirt,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const PLACEMENTS = [
  'Left Chest', 'Full Front', 'Full Back', 'Back Yoke',
  'Left Sleeve', 'Right Sleeve', 'Custom',
];

const DECORATION_METHODS = [
  { value: 'screen_print', label: 'Screen Print' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'dtf', label: 'DTF Transfer' },
  { value: 'leather_patch', label: 'Leather Patch' },
  { value: 'uv_patch', label: 'UV Patch' },
  { value: 'heat_press_patch', label: 'Heat Press Patch' },
  { value: 'woven_patch', label: 'Woven Patch' },
  { value: 'pvc_patch', label: 'PVC Patch' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_LABELS: Record<string, string> = {
  due_on_receipt: 'Due on Receipt',
  net_15: 'Net 15',
  net_30: 'Net 30',
  '50_50': '50/50 Split',
  prepaid: 'Prepaid',
};

const DELIVERY_LABELS: Record<string, string> = {
  pickup: 'Customer Pickup',
  delivery: 'Local Delivery',
  ship: 'Ship',
};

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

interface Props {
  quoteId: string;
  onBack: () => void;
}

export function QuoteDetail({ quoteId, onBack }: Props) {
  const { quotes, updateQuote } = useQuotes();
  const { lineItems, createLineItem, updateLineItem, deleteLineItem } = useQuoteLineItems(quoteId);
  const { matrices, lookupPrice } = usePricingMatrices();
  const { searchCatalog } = useProductCatalog();
  const { results: garmentResults, isSearching: garmentSearching, search: searchGarments, clearResults } = useGarmentSearch();
  const { role } = useAuth();

  const quote = quotes.find((q) => q.id === quoteId);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [syncingColors, setSyncingColors] = useState(false);

  // New line item state
  const [newItem, setNewItem] = useState({
    style_number: '',
    description: '',
    service_type: 'screen_print',
    quantity: 1,
    garment_cost: 0,
    decoration_cost: 0,
    garment_markup_pct: 200,
    decoration_params: {} as Record<string, any>,
    color: '',
    placement: '',
    sizes: {} as Record<string, number>,
    image_url: '',
  });

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSizes, setShowSizes] = useState(false);
  const [availableColors, setAvailableColors] = useState<string[]>([]);
  const [selectedStyleForPricing, setSelectedStyleForPricing] = useState<string>('');

  if (!quote) return <div>Quote not found</div>;

  const handleStyleSearch = async (value: string) => {
    setNewItem((prev) => ({ ...prev, style_number: value }));
    if (value.length >= 2) {
      // Search local catalog
      try {
        const results = await searchCatalog(value);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      // Also search vendor APIs
      searchGarments(value);
    } else {
      setSearchResults([]);
      clearResults();
    }
  };

  const selectCatalogItem = async (item: any) => {
    const styleNum = item.style_number || item.style || '';
    const source = item.source as string;
    
    // Set initial state immediately
    setSelectedStyleForPricing(styleNum);
    setNewItem((prev) => ({
      ...prev,
      style_number: styleNum,
      description: `${item.brand || ''} ${item.description || ''}`.trim(),
      garment_cost: item.piece_price || item.case_price || 0,
      image_url: item.image_url || '',
      color: '',
    }));
    setSearchResults([]);
    clearResults();

    // If item already has colors from API search results, use them
    if (item.colors && item.colors.length > 0) {
      setAvailableColors(item.colors.sort());
    } else {
      setAvailableColors([]);
    }

    if (!styleNum) return;

    setSyncingColors(true);
    try {
      // First, try to load colors from local catalog (wildcard to match NL6210, 6210M, etc.)
      const { data: localColors } = await supabase
        .from('product_catalog')
        .select('color_group')
        .or(`style_number.ilike.%${styleNum}%,style_number.ilike.${styleNum}%`)
        .not('color_group', 'is', null);
      
      if (localColors && localColors.length > 0) {
        const isReal = (c: string) => !['COLORS', 'HEATHERS', 'BASICS'].includes(c.toUpperCase());
        const colors = [...new Set(localColors.map(d => d.color_group).filter(c => c && isReal(c)) as string[])].sort();
        if (colors.length > 0) setAvailableColors(colors);
      }

      // Then try API sync for fresh data (SanMar first, then S&S)
      if (source !== 'catalog' || (localColors && localColors.length === 0)) {
        try {
          const sanmarResp = await supabase.functions.invoke('sanmar-api', {
            body: { action: 'syncProduct', styleNumber: styleNum.toUpperCase().trim() },
          });
          
          if (sanmarResp.data?.success && sanmarResp.data?.upserted > 0) {
            const { data: catalogColors } = await supabase
              .from('product_catalog')
              .select('color_group')
              .ilike('style_number', styleNum)
              .not('color_group', 'is', null);
            if (catalogColors && catalogColors.length > 0) {
              const colors = [...new Set(catalogColors.map(d => d.color_group).filter(Boolean) as string[])].sort();
              setAvailableColors(colors);
            }
          } else {
            const ssResp = await supabase.functions.invoke('ss-activewear-api', {
              body: { action: 'syncProduct', styleNumber: styleNum.toUpperCase().trim() },
            });
            if (ssResp.data?.success && ssResp.data?.upserted > 0) {
              const { data: catalogColors } = await supabase
                .from('product_catalog')
                .select('color_group')
                .ilike('style_number', styleNum)
                .not('color_group', 'is', null);
              if (catalogColors && catalogColors.length > 0) {
                const colors = [...new Set(catalogColors.map(d => d.color_group).filter(Boolean) as string[])].sort();
                setAvailableColors(colors);
              }
            }
          }
        } catch (e) {
          console.log('API sync for colors failed, using local data:', e);
        }
      }
    } catch (e) {
      console.log('Color loading failed:', e);
    } finally {
      setSyncingColors(false);
    }
  };

  const handleColorChange = async (color: string) => {
    setNewItem((p) => ({ ...p, color }));
    // Try to look up price for this specific color/style combo from catalog
    if (selectedStyleForPricing) {
      try {
        const { data } = await supabase
          .from('product_catalog')
          .select('piece_price, case_price')
          .ilike('style_number', selectedStyleForPricing)
          .ilike('color_group', `%${color}%`)
          .limit(1)
          .maybeSingle();
        if (data) {
          const price = data.piece_price || data.case_price || 0;
          if (price > 0) {
            setNewItem((p) => ({ ...p, garment_cost: price }));
          }
        }
      } catch { /* keep existing price */ }
    }
  };

  const getDecorationPrice = () => {
    const matrix = matrices.find((m) => m.service_type === newItem.service_type);
    if (!matrix) return null;
    const colIndex = newItem.decoration_params.column_index ?? 0;
    return lookupPrice(matrix, newItem.quantity, colIndex);
  };

  const calcLineTotal = (item: typeof newItem) => {
    const garmentTotal = item.garment_cost * (item.garment_markup_pct / 100) * item.quantity;
    const decoTotal = item.decoration_cost * item.quantity;
    return garmentTotal + decoTotal;
  };

  const handleAddItem = async () => {
    const priceInfo = getDecorationPrice();
    const decorationCost = priceInfo?.decorationCost ?? newItem.decoration_cost;
    const markup = priceInfo?.markup ?? newItem.garment_markup_pct;

    const finalItem = {
      ...newItem,
      decoration_cost: decorationCost,
      garment_markup_pct: markup,
    };

    const sizeTotal = Object.values(finalItem.sizes).reduce((s, v) => s + v, 0);

    await createLineItem.mutateAsync({
      quote_id: quoteId,
      style_number: finalItem.style_number || null,
      description: finalItem.description || null,
      service_type: finalItem.service_type,
      quantity: sizeTotal > 0 ? sizeTotal : finalItem.quantity,
      garment_cost: finalItem.garment_cost,
      garment_markup_pct: finalItem.garment_markup_pct,
      decoration_cost: finalItem.decoration_cost,
      decoration_params: finalItem.decoration_params,
      line_total: calcLineTotal({ ...finalItem, quantity: sizeTotal > 0 ? sizeTotal : finalItem.quantity }),
      color: finalItem.color || null,
      placement: finalItem.placement || null,
      sizes: sizeTotal > 0 ? finalItem.sizes : {},
      image_url: finalItem.image_url || null,
    } as any);

    // Reset
    setNewItem({
      style_number: '', description: '', service_type: 'screen_print', quantity: 1,
      garment_cost: 0, decoration_cost: 0, garment_markup_pct: 200, decoration_params: {},
      color: '', placement: '', sizes: {}, image_url: '',
    });
    setShowSizes(false);
    setAvailableColors([]);
    setSelectedStyleForPricing('');

    // Update quote total
    const sizeQty = sizeTotal > 0 ? sizeTotal : newItem.quantity;
    const newTotal = lineItems.reduce((sum, li) => sum + (li.line_total || 0), 0) + calcLineTotal({ ...newItem, quantity: sizeQty });
    updateQuote.mutate({ id: quoteId, total_price: newTotal });
  };

  const selectedMatrix = matrices.find((m) => m.service_type === newItem.service_type);
  const quoteSubtotal = lineItems.reduce((sum, li) => sum + (li.line_total || 0), 0);
  const taxAmount = quote.apply_sales_tax ? quoteSubtotal * (quote.tax_rate / 100) : 0;
  const quoteTotal = quoteSubtotal + taxAmount;

  // Combine local + API search results
  const allSearchResults = [
    ...searchResults.map(r => ({ ...r, source: 'catalog' })),
    ...garmentResults.filter(r => !searchResults.some(sr => sr.style_number === r.style_number)),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{quote.quote_number}</h2>
            <Badge>{quote.status}</Badge>
            {quote.is_nonprofit && <Badge variant="secondary">Nonprofit</Badge>}
          </div>
          <p className="text-muted-foreground">{quote.customer_name}</p>
        </div>
        {quote.po_number && (
          <Badge variant="outline">PO: {quote.po_number}</Badge>
        )}
      </div>

      {/* Customer Info Card - Collapsible */}
      <Collapsible open={customerOpen} onOpenChange={setCustomerOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Details
                </span>
                {customerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Contact</p>
                  <p className="font-medium">{quote.customer_name}</p>
                </div>
                {quote.company && (
                  <div>
                    <p className="text-muted-foreground text-xs flex items-center gap-1"><Building2 className="h-3 w-3" /> Company</p>
                    <p className="font-medium">{quote.company}</p>
                  </div>
                )}
                {quote.customer_email && (
                  <div>
                    <p className="text-muted-foreground text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
                    <a href={`mailto:${quote.customer_email}`} className="text-primary hover:underline">{quote.customer_email}</a>
                  </div>
                )}
                {quote.customer_phone && (
                  <div>
                    <p className="text-muted-foreground text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</p>
                    <a href={`tel:${quote.customer_phone}`} className="text-primary hover:underline">{quote.customer_phone}</a>
                  </div>
                )}
                {quote.address_line1 && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</p>
                    <p>{quote.address_line1}</p>
                    {quote.address_line2 && <p>{quote.address_line2}</p>}
                    <p>{[quote.city, quote.state, quote.zip].filter(Boolean).join(', ')}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1"><Truck className="h-3 w-3" /> Delivery</p>
                  <p>{DELIVERY_LABELS[quote.delivery_method || 'pickup'] || quote.delivery_method}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1"><CreditCard className="h-3 w-3" /> Terms</p>
                  <p>{PAYMENT_LABELS[quote.payment_terms || 'due_on_receipt'] || quote.payment_terms}</p>
                </div>
                {quote.requested_date && (
                  <div>
                    <p className="text-muted-foreground text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Requested</p>
                    <p>{new Date(quote.requested_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 text-xs">
                {quote.is_nonprofit && <Badge variant="secondary">Tax Exempt (Nonprofit)</Badge>}
                {quote.apply_sales_tax && (
                  <Badge variant="outline">Sales Tax: {quote.tax_rate}%</Badge>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Raw email preview */}
      {quote.raw_email && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Customer Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap text-muted-foreground bg-muted/50 p-3 rounded-md max-h-48 overflow-auto">
              {quote.raw_email}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shirt className="h-5 w-5" />
            Line Items
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {lineItems.length > 0 && (
            <div className="space-y-3">
              {lineItems.map((li) => {
                const sizeEntries = Object.entries(li.sizes || {}).filter(([, v]) => v > 0);
                return (
                  <div key={li.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{li.style_number || 'Custom Item'}</span>
                          <Badge variant="outline" className="text-xs">
                            {DECORATION_METHODS.find(d => d.value === li.service_type)?.label || li.service_type}
                          </Badge>
                          {li.color && <Badge variant="secondary" className="text-xs">{li.color}</Badge>}
                          {li.placement && <Badge variant="secondary" className="text-xs">{li.placement}</Badge>}
                        </div>
                        {li.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{li.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">×{li.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => deleteLineItem.mutate({ id: li.id, quoteId })}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {sizeEntries.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sizeEntries.map(([size, qty]) => (
                          <Badge key={size} variant="secondary" className="text-xs font-normal">
                            {size}: {String(qty)}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {hasFinancialAccess(role) && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                        <DollarSign className="h-3 w-3" />
                        <span>Garment: <span className="font-mono">${li.garment_cost?.toFixed(2)}</span> × {li.garment_markup_pct}%</span>
                        {li.decoration_cost > 0 && (
                          <span>Deco: <span className="font-mono">${li.decoration_cost?.toFixed(2)}</span>/pc</span>
                        )}
                        <span className="ml-auto font-medium text-foreground">
                          <span className="font-mono">${li.line_total?.toFixed(2)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Totals */}
          {hasFinancialAccess(role) && lineItems.length > 0 && (
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex gap-8">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">${quoteSubtotal.toFixed(2)}</span>
              </div>
              {quote.apply_sales_tax && (
                <div className="flex gap-8">
                  <span className="text-muted-foreground">Tax ({quote.tax_rate}%)</span>
                  <span className="font-mono">${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <Separator className="w-48 my-1" />
              <div className="flex gap-8 text-lg font-bold">
                <span>Total</span>
                <span className="font-mono">${quoteTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Add new line item */}
          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Line Item
            </h4>

            {/* Garment Search */}
            <div className="relative">
              <Label>Garment / Style Number</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={newItem.style_number}
                  onChange={(e) => handleStyleSearch(e.target.value)}
                  placeholder="Search SKU (e.g. PC78H, 5000, ST350)..."
                />
                {garmentSearching && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {allSearchResults.length > 0 && newItem.style_number.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
                  {allSearchResults.map((r, i) => (
                    <button
                      key={`${r.style_number}-${r.source}-${i}`}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                      onClick={() => selectCatalogItem(r)}
                    >
                      <div>
                        <span className="font-medium">{r.style_number}</span>
                        <span className="text-muted-foreground ml-2">
                          {r.brand} {r.description && `— ${r.description.slice(0, 40)}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{r.source === 'catalog' ? 'Local' : r.source === 'sanmar' ? 'SanMar' : 'S&S'}</Badge>
                        {(r.piece_price || r.case_price) && (
                          <span className="font-mono text-xs">${(r.piece_price || r.case_price || 0).toFixed(2)}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label>Description</Label>
                <Input
                  value={newItem.description}
                  onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <Label>Color</Label>
                {syncingColors ? (
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading colors from API...
                  </div>
                ) : availableColors.length > 0 ? (
                  <Select value={newItem.color} onValueChange={handleColorChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {availableColors.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={newItem.color}
                    onChange={(e) => setNewItem((p) => ({ ...p, color: e.target.value }))}
                    placeholder="e.g. Navy, Athletic Heather"
                  />
                )}
              </div>
              <div>
                <Label>Decoration Method</Label>
                <Select
                  value={newItem.service_type}
                  onValueChange={(v) => setNewItem((p) => ({ ...p, service_type: v, decoration_params: {} }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DECORATION_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Placement</Label>
                <Select value={newItem.placement} onValueChange={(v) => setNewItem((p) => ({ ...p, placement: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACEMENTS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Total Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={newItem.quantity}
                  onChange={(e) => setNewItem((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label>Garment Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItem.garment_cost}
                  onChange={(e) => setNewItem((p) => ({ ...p, garment_cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              {selectedMatrix && selectedMatrix.column_headers.length > 1 && (
                <div>
                  <Label>{selectedMatrix.name} Option</Label>
                  <Select
                    value={String(newItem.decoration_params.column_index ?? 0)}
                    onValueChange={(v) =>
                      setNewItem((p) => ({
                        ...p,
                        decoration_params: { ...p.decoration_params, column_index: parseInt(v) },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedMatrix.column_headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Size Breakdown */}
            <Collapsible open={showSizes} onOpenChange={setShowSizes}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                  {showSizes ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  Size Breakdown
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-5 md:grid-cols-9 gap-2 mt-2">
                  {SIZE_OPTIONS.map(size => (
                    <div key={size} className="text-center">
                      <Label className="text-[10px]">{size}</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-center text-sm px-1"
                        value={newItem.sizes[size] || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setNewItem(p => ({
                            ...p,
                            sizes: { ...p.sizes, [size]: val },
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
                {Object.values(newItem.sizes).some(v => v > 0) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Size total: {Object.values(newItem.sizes).reduce((s, v) => s + v, 0)} pcs
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Deco cost + preview */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Deco Cost/pc</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={getDecorationPrice()?.decorationCost ?? newItem.decoration_cost}
                  onChange={(e) => setNewItem((p) => ({ ...p, decoration_cost: parseFloat(e.target.value) || 0 }))}
                />
                {getDecorationPrice() && (
                  <p className="text-xs text-primary mt-1">Auto from pricing matrix</p>
                )}
              </div>
              {hasFinancialAccess(role) && (
                <div className="flex items-end">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Line preview: <span className="font-mono font-medium text-foreground">${calcLineTotal(newItem).toFixed(2)}</span>
                    </p>
                    <Button onClick={handleAddItem} disabled={createLineItem.isPending} size="sm">
                      {createLineItem.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Adding...</>
                      ) : (
                        <><Plus className="h-4 w-4 mr-1" /> Add Item</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
