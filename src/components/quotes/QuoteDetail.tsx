import { useState } from 'react';
import { useQuotes, useQuoteLineItems, Quote, QuoteLineItem } from '@/hooks/useQuotes';
import { usePricingMatrices } from '@/hooks/usePricingMatrices';
import { useProductCatalog } from '@/hooks/useProductCatalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Search, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { hasFinancialAccess } from '@/hooks/useJobs';

interface Props {
  quoteId: string;
  onBack: () => void;
}

export function QuoteDetail({ quoteId, onBack }: Props) {
  const { quotes, updateQuote } = useQuotes();
  const { lineItems, createLineItem, updateLineItem, deleteLineItem } = useQuoteLineItems(quoteId);
  const { matrices, lookupPrice } = usePricingMatrices();
  const { searchCatalog } = useProductCatalog();
  const { role } = useAuth();

  const quote = quotes.find((q) => q.id === quoteId);

  const [newItem, setNewItem] = useState({
    style_number: '',
    description: '',
    service_type: 'screen_print',
    quantity: 1,
    garment_cost: 0,
    decoration_cost: 0,
    garment_markup_pct: 200,
    decoration_params: {} as Record<string, any>,
  });

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  if (!quote) return <div>Quote not found</div>;

  const handleStyleSearch = async (value: string) => {
    setNewItem((prev) => ({ ...prev, style_number: value }));
    if (value.length >= 2) {
      setSearching(true);
      try {
        const results = await searchCatalog(value);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const selectCatalogItem = (item: any) => {
    setNewItem((prev) => ({
      ...prev,
      style_number: item.style_number,
      description: `${item.brand || ''} ${item.description || ''}`.trim(),
      garment_cost: item.piece_price || item.case_price || 0,
    }));
    setSearchResults([]);
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

    await createLineItem.mutateAsync({
      quote_id: quoteId,
      style_number: finalItem.style_number || null,
      description: finalItem.description || null,
      service_type: finalItem.service_type,
      quantity: finalItem.quantity,
      garment_cost: finalItem.garment_cost,
      garment_markup_pct: finalItem.garment_markup_pct,
      decoration_cost: finalItem.decoration_cost,
      decoration_params: finalItem.decoration_params,
      line_total: calcLineTotal(finalItem),
    });

    setNewItem({
      style_number: '',
      description: '',
      service_type: 'screen_print',
      quantity: 1,
      garment_cost: 0,
      decoration_cost: 0,
      garment_markup_pct: 200,
      decoration_params: {},
    });

    // Update quote total
    const newTotal = lineItems.reduce((sum, li) => sum + (li.line_total || 0), 0) + calcLineTotal(finalItem);
    updateQuote.mutate({ id: quoteId, total_price: newTotal });
  };

  const selectedMatrix = matrices.find((m) => m.service_type === newItem.service_type);

  const quoteTotal = lineItems.reduce((sum, li) => sum + (li.line_total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{quote.quote_number}</h2>
          <p className="text-muted-foreground">{quote.customer_name}</p>
        </div>
        <Badge className="ml-auto">{quote.status}</Badge>
      </div>

      {/* Raw email preview */}
      {quote.raw_email && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Customer Email</CardTitle>
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
            <DollarSign className="h-5 w-5" />
            Line Items
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {lineItems.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    {hasFinancialAccess(role) && (
                      <>
                        <TableHead className="text-right">Garment</TableHead>
                        <TableHead className="text-right">Deco/pc</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                      </>
                    )}
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((li) => (
                    <TableRow key={li.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{li.style_number || 'Custom'}</span>
                          {li.description && (
                            <p className="text-xs text-muted-foreground">{li.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {li.service_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{li.quantity}</TableCell>
                      {hasFinancialAccess(role) && (
                        <>
                          <TableCell className="text-right">
                            ${li.garment_cost?.toFixed(2)} × {li.garment_markup_pct}%
                          </TableCell>
                          <TableCell className="text-right">${li.decoration_cost?.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${li.line_total?.toFixed(2)}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteLineItem.mutate({ id: li.id, quoteId })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {hasFinancialAccess(role) && lineItems.length > 0 && (
            <div className="flex justify-end">
              <div className="text-lg font-bold">
                Total: ${quoteTotal.toFixed(2)}
              </div>
            </div>
          )}

          {/* Add new line item */}
          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium text-sm">Add Line Item</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Label>Style Number</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={newItem.style_number}
                    onChange={(e) => handleStyleSearch(e.target.value)}
                    placeholder="Search catalog..."
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                        onClick={() => selectCatalogItem(r)}
                      >
                        <span className="font-medium">{r.style_number}</span>
                        <span className="text-muted-foreground ml-2">
                          {r.brand} — ${r.piece_price?.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={newItem.description}
                  onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div>
                <Label>Service Type</Label>
                <Select
                  value={newItem.service_type}
                  onValueChange={(v) => setNewItem((p) => ({ ...p, service_type: v, decoration_params: {} }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="screen_print">Screen Print</SelectItem>
                    <SelectItem value="embroidery">Embroidery</SelectItem>
                    <SelectItem value="dtf">DTF Transfer</SelectItem>
                    <SelectItem value="leather_patch">Leather Patch</SelectItem>
                    <SelectItem value="heat_press_patch">Heat Press Patch</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Quantity</Label>
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
                        <SelectItem key={i} value={String(i)}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Deco Cost/pc</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={getDecorationPrice()?.decorationCost ?? newItem.decoration_cost}
                  onChange={(e) => setNewItem((p) => ({ ...p, decoration_cost: parseFloat(e.target.value) || 0 }))}
                  className={getDecorationPrice() ? 'border-green-500' : ''}
                />
                {getDecorationPrice() && (
                  <p className="text-xs text-green-600 mt-1">Auto from matrix</p>
                )}
              </div>
            </div>

            {hasFinancialAccess(role) && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Preview: ${calcLineTotal(newItem).toFixed(2)}
                </span>
                <Button onClick={handleAddItem} disabled={createLineItem.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
