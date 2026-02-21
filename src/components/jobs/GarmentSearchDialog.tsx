import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Plus, Package, DollarSign, TrendingUp, Minus } from 'lucide-react';
import { useGarmentSearch, GarmentSearchResult } from '@/hooks/useGarmentSearch';
import { useJobGarmentMutations, CreateGarmentInput } from '@/hooks/useJobGarmentMutations';
import { usePricingMatrices } from '@/hooks/usePricingMatrices';
import { ServiceType } from '@/hooks/useJobs';

const DECORATION_METHODS: { value: string; label: string }[] = [
  { value: 'screen_print', label: 'Screen Print' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'dtf', label: 'DTF' },
  { value: 'leather_patch', label: 'Leather Patch' },
  { value: 'uv_patch', label: 'UV Patch' },
  { value: 'heat_press_patch', label: 'Heat Press Patch' },
  { value: 'woven_patch', label: 'Woven Patch' },
  { value: 'pvc_patch', label: 'PVC Patch' },
  { value: 'other', label: 'Other' },
];

const PLACEMENTS = [
  'Left Chest', 'Full Front', 'Full Back', 'Back Yoke',
  'Left Sleeve', 'Right Sleeve', 'Custom',
];

const SOURCE_LABELS: Record<string, string> = {
  catalog: 'Local Catalog',
  sanmar: 'SanMar',
  ss_activewear: 'S&S Activewear',
};

interface GarmentSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobQuantity: number;
  jobServiceType: ServiceType;
}

export function GarmentSearchDialog({
  open,
  onOpenChange,
  jobId,
  jobQuantity,
  jobServiceType,
}: GarmentSearchDialogProps) {
  const { results, isSearching, search, clearResults } = useGarmentSearch();
  const { createGarment } = useJobGarmentMutations(jobId);
  const { matrices, lookupPrice } = usePricingMatrices();

  const [query, setQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<GarmentSearchResult | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(jobQuantity);
  const [decorationType, setDecorationType] = useState(jobServiceType || 'other');
  const [placement, setPlacement] = useState('');
  const [decorationParam, setDecorationParam] = useState(1); // colors/stitches/etc
  const [overridePrice, setOverridePrice] = useState<number | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => search(query), 400);
    } else {
      clearResults();
    }
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [query, search, clearResults]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedResult(null);
      setSelectedColor('');
      setQuantity(jobQuantity);
      setDecorationType(jobServiceType || 'other');
      setPlacement('');
      setDecorationParam(1);
      setOverridePrice(null);
      clearResults();
    }
  }, [open, jobQuantity, jobServiceType, clearResults]);

  // Pricing calculation
  const garmentCost = selectedResult?.piece_price || 0;
  
  // Find applicable pricing matrix
  const matrix = matrices.find(m => m.service_type === decorationType);
  const matrixLookup = matrix ? lookupPrice(matrix, quantity, Math.max(0, decorationParam - 1)) : null;
  
  const decorationCostPerUnit = matrixLookup?.decorationCost || 0;
  const markupPct = matrixLookup?.markup || 200;
  
  const garmentSellPrice = garmentCost * (markupPct / 100);
  const unitSellPrice = overridePrice ?? (garmentSellPrice + decorationCostPerUnit);
  const totalJobPrice = unitSellPrice * quantity;
  const totalCost = (garmentCost + decorationCostPerUnit) * quantity;
  const profit = totalJobPrice - totalCost;
  const profitMargin = totalJobPrice > 0 ? (profit / totalJobPrice) * 100 : 0;

  // Decoration parameter label
  const getDecoParamLabel = () => {
    switch (decorationType) {
      case 'screen_print': return 'Colors';
      case 'embroidery': return 'Stitch Count (K)';
      case 'dtf': return 'Size Tier';
      default: return 'Option';
    }
  };

  const handleAdd = () => {
    if (!selectedResult) return;

    const input: CreateGarmentInput = {
      job_id: jobId,
      style: selectedResult.style_number,
      item_number: selectedResult.style_number,
      color: selectedColor || undefined,
      description: selectedResult.description || undefined,
      quantity,
      unit_cost: garmentCost,
      total_cost: garmentCost * quantity,
      vendor: selectedResult.source === 'catalog' ? undefined : selectedResult.source,
      decoration_type: decorationType,
      placement: placement || undefined,
      image_url: selectedResult.image_url,
      markup_pct: markupPct,
      decoration_cost: decorationCostPerUnit,
      unit_sell_price: unitSellPrice,
    };

    createGarment.mutate(input, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Garment to Job</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SKU (e.g. PC78H, 5000, ST350)..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedResult(null); }}
            className="pl-9 text-lg"
            autoFocus
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Search Results */}
        {!selectedResult && results.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((result, idx) => (
              <button
                key={`${result.style_number}-${result.source}-${idx}`}
                type="button"
                onClick={() => {
                  setSelectedResult(result);
                  if (result.colors.length === 1) setSelectedColor(result.colors[0]);
                }}
                className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{result.style_number}</span>
                      <Badge variant="outline" className="text-xs">
                        {SOURCE_LABELS[result.source]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {result.brand && `${result.brand} — `}{result.description}
                    </p>
                    {result.colors.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {result.colors.length} color{result.colors.length !== 1 ? 's' : ''} available
                      </p>
                    )}
                  </div>
                  {result.piece_price > 0 && (
                    <span className="font-mono text-sm font-medium whitespace-nowrap">
                      ${result.piece_price.toFixed(2)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {!selectedResult && !isSearching && query.length >= 2 && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No garments found for "{query}"
          </p>
        )}

        {/* Selected Garment Detail */}
        {selectedResult && (
          <div className="space-y-4">
            {/* Product Info */}
            <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{selectedResult.style_number}</span>
                    <Badge variant="outline" className="text-xs">
                      {SOURCE_LABELS[selectedResult.source]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedResult.brand && `${selectedResult.brand} — `}{selectedResult.description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedResult(null); setSelectedColor(''); }}
                >
                  Change
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Wholesale: <span className="font-mono font-medium">${garmentCost.toFixed(2)}</span>
                </span>
              </div>
            </div>

            {/* Color Selection */}
            {selectedResult.colors.length > 0 && (
              <div className="space-y-2">
                <Label>Color</Label>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedResult.colors.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantity</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Decoration Method */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Decoration Method</Label>
                <Select value={decorationType} onValueChange={(v) => setDecorationType(v as ServiceType)}>
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

              <div className="space-y-2">
                <Label>Placement</Label>
                <Select value={placement} onValueChange={setPlacement}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select placement" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACEMENTS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Decoration Parameter (colors/stitches/size) */}
            {matrix && (
              <div className="space-y-2">
                <Label>{getDecoParamLabel()}</Label>
                <Select
                  value={String(decorationParam)}
                  onValueChange={(v) => setDecorationParam(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {matrix.column_headers.map((header, idx) => (
                      <SelectItem key={idx} value={String(idx + 1)}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Pricing Breakdown */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing Breakdown
              </h4>
              <div className="space-y-1.5 text-sm">
                <PriceRow label="Garment cost (wholesale)" value={garmentCost} />
                <PriceRow label={`Garment markup (${markupPct}%)`} value={garmentSellPrice} />
                {decorationCostPerUnit > 0 && (
                  <PriceRow label="Decoration cost" value={decorationCostPerUnit} />
                )}
                <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                  <span>Unit sell price</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">${unitSellPrice.toFixed(2)}</span>
                    {overridePrice === null ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setOverridePrice(unitSellPrice)}
                      >
                        Override
                      </Button>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        value={overridePrice}
                        onChange={(e) => setOverridePrice(parseFloat(e.target.value) || 0)}
                        className="w-24 h-7 text-sm"
                      />
                    )}
                  </div>
                </div>
                <PriceRow label={`Total (×${quantity})`} value={totalJobPrice} bold />
              </div>

              {/* Profit indicator */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className={`h-4 w-4 ${profitMargin >= 0 ? 'text-green-600' : 'text-destructive'}`} />
                  <span className="text-sm font-medium">Profit</span>
                </div>
                <span className={`font-mono text-sm font-medium ${profitMargin >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  ${profit.toFixed(2)} ({profitMargin.toFixed(1)}%)
                </span>
              </div>

              {/* Break-even bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cost</span>
                  <span>Revenue</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${profitMargin >= 30 ? 'bg-green-500' : profitMargin >= 10 ? 'bg-yellow-500' : 'bg-destructive'}`}
                    style={{ width: `${Math.min(100, totalJobPrice > 0 ? (totalCost / totalJobPrice) * 100 : 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedResult || createGarment.isPending}
          >
            {createGarment.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</>
            ) : (
              <><Package className="h-4 w-4 mr-2" /> Add Garment</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PriceRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-medium' : ''}`}>
      <span>{label}</span>
      <span className="font-mono">${value.toFixed(2)}</span>
    </div>
  );
}
