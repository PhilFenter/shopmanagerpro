import { useState, useEffect } from 'react';
import { useJobGarments } from '@/hooks/useJobGarments';
import { useJobGarmentMutations } from '@/hooks/useJobGarmentMutations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Shirt, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface JobGarmentsListProps {
  jobId: string;
  compact?: boolean;
}

const HAT_KEYWORDS = /\b(hat|cap|beanie|visor|snapback|trucker|flexfit|richardson|r-112|yp classics|yp classic|112|r112)\b/i;

const DECORATION_LABELS: Record<string, string> = {
  screen_print: 'Screen Print',
  embroidery: 'Embroidery',
  dtf: 'DTF',
  leather_patch: 'Leather',
  uv_patch: 'UV Patch',
  heat_press_patch: 'Heat Press',
  woven_patch: 'Woven',
  pvc_patch: 'PVC',
  other: 'Other',
};

function isHatItem(g: { style?: string | null; description?: string | null; item_number?: string | null }) {
  return HAT_KEYWORDS.test(g.style || '') || HAT_KEYWORDS.test(g.description || '') || HAT_KEYWORDS.test(g.item_number || '');
}

// Standard size order for columns
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'OSFA', 'OS', 'ADJ'];

function sortedSizeKeys(garments: Array<{ sizes: Record<string, number> }>): string[] {
  const allSizes = new Set<string>();
  garments.forEach(g => Object.keys(g.sizes || {}).forEach(s => allSizes.add(s)));
  return Array.from(allSizes).sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.toUpperCase());
    const bi = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function JobGarmentsList({ jobId, compact = false }: JobGarmentsListProps) {
  const { garments, isLoading } = useJobGarments(jobId);
  const { deleteGarment } = useJobGarmentMutations(jobId);

  if (isLoading || garments.length === 0) return null;

  const allHats = garments.every(isHatItem);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {garments.slice(0, 3).map((g) => (
          <Badge key={g.id} variant="outline" className="text-xs font-normal gap-1">
            <Shirt className="h-3 w-3" />
            {g.style || g.item_number || 'Item'} 
            {g.color ? ` — ${g.color}` : ''}
            <span className="text-muted-foreground">×{g.quantity}</span>
          </Badge>
        ))}
        {garments.length > 3 && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            +{garments.length - 3} more
          </Badge>
        )}
      </div>
    );
  }

  // Printavo-style table view
  const sizeColumns = sortedSizeKeys(garments);
  const hasPricing = garments.some(g => (g.unit_cost && g.unit_cost > 0) || (g as any).unit_sell_price);
  const totalQty = garments.reduce((sum, g) => sum + g.quantity, 0);
  const totalCost = garments.reduce((sum, g) => sum + (g.total_cost || 0), 0);

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-[52px] px-2"></TableHead>
            <TableHead className="min-w-[140px]">Item</TableHead>
            <TableHead>Color</TableHead>
            {sizeColumns.map(size => (
              <TableHead key={size} className="text-center w-[48px] px-1 font-semibold">
                {size}
              </TableHead>
            ))}
            <TableHead className="text-center w-[52px]">Qty</TableHead>
            {hasPricing && (
              <>
                <TableHead className="text-right w-[72px]">Cost</TableHead>
                <TableHead className="text-right w-[72px]">Price</TableHead>
                <TableHead className="text-right w-[80px]">Total</TableHead>
              </>
            )}
            <TableHead className="w-[36px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {garments.map((g) => {
            const gAny = g as any;
            const hasDecoration = gAny.decoration_type && gAny.decoration_type !== 'other';

            return (
              <TableRow key={g.id} className="group">
                {/* Thumbnail */}
                <TableCell className="px-2 py-1.5">
                  {g.image_url ? (
                    <div className="h-10 w-10 rounded border overflow-hidden bg-muted/20 flex-shrink-0">
                      <GarmentThumbnail imageUrl={g.image_url} alt={g.style || 'Garment'} />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded border bg-muted/20 flex items-center justify-center flex-shrink-0">
                      <Shirt className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>

                {/* Item info */}
                <TableCell className="py-1.5">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-tight">
                      {g.style || g.description || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {g.item_number && (
                        <span className="text-xs text-muted-foreground">#{g.item_number}</span>
                      )}
                      {hasDecoration && (
                        <Badge variant="secondary" className="text-[10px] py-0 h-4">
                          {DECORATION_LABELS[gAny.decoration_type] || gAny.decoration_type}
                        </Badge>
                      )}
                      {gAny.placement && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {gAny.placement}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Color */}
                <TableCell className="py-1.5">
                  <span className="text-sm">{g.color || '—'}</span>
                </TableCell>

                {/* Size columns */}
                {sizeColumns.map(size => {
                  const qty = (g.sizes || {})[size];
                  return (
                    <TableCell key={size} className="text-center py-1.5 px-1 tabular-nums">
                      <span className={cn("text-sm", qty ? "font-medium" : "text-muted-foreground/40")}>
                        {qty || '—'}
                      </span>
                    </TableCell>
                  );
                })}

                {/* Total qty */}
                <TableCell className="text-center py-1.5 font-semibold tabular-nums">
                  {g.quantity}
                </TableCell>

                {/* Pricing */}
                {hasPricing && (
                  <>
                    <TableCell className="text-right py-1.5 tabular-nums text-sm text-muted-foreground">
                      {g.unit_cost != null && g.unit_cost > 0 ? `$${Number(g.unit_cost).toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right py-1.5 tabular-nums text-sm font-medium">
                      {gAny.unit_sell_price != null && gAny.unit_sell_price > 0 
                        ? `$${Number(gAny.unit_sell_price).toFixed(2)}` 
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right py-1.5 tabular-nums text-sm font-semibold">
                      {g.total_cost != null && g.total_cost > 0 ? `$${Number(g.total_cost).toFixed(2)}` : '—'}
                    </TableCell>
                  </>
                )}

                {/* Delete */}
                <TableCell className="py-1.5 px-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() => deleteGarment.mutate(g.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        {(garments.length > 1) && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3 + sizeColumns.length} className="text-right text-sm font-medium">
                Totals
              </TableCell>
              <TableCell className="text-center font-bold tabular-nums">{totalQty}</TableCell>
              {hasPricing && (
                <>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-bold tabular-nums">
                    {totalCost > 0 ? `$${totalCost.toFixed(2)}` : '—'}
                  </TableCell>
                </>
              )}
              <TableCell />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

// Garment thumbnail with signed URL support
function GarmentThumbnail({ imageUrl, alt }: { imageUrl: string; alt: string }) {
  const [src, setSrc] = useState(imageUrl.startsWith('http') ? imageUrl : '');
  
  useEffect(() => {
    if (!imageUrl.startsWith('http')) {
      supabase.storage.from('job-photos').createSignedUrl(imageUrl, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setSrc(data.signedUrl);
        });
    } else {
      setSrc(imageUrl);
    }
  }, [imageUrl]);

  if (!src) return <Shirt className="h-4 w-4 text-muted-foreground m-auto" />;
  return <img src={src} alt={alt} className="w-full h-full object-cover" />;
}
