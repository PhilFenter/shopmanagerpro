import { useJobGarments } from '@/hooks/useJobGarments';
import { useJobGarmentMutations } from '@/hooks/useJobGarmentMutations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shirt, Trash2, DollarSign } from 'lucide-react';

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

export function JobGarmentsList({ jobId, compact = false }: JobGarmentsListProps) {
  const { garments, isLoading } = useJobGarments(jobId);
  const { deleteGarment } = useJobGarmentMutations(jobId);

  if (isLoading || garments.length === 0) return null;

  const allHats = garments.every(isHatItem);
  const label = allHats ? 'Hats' : 'Garments';

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

  return (
    <div className="space-y-2">
      {garments.map((g) => {
        const sizeEntries = Object.entries(g.sizes || {});
        const gAny = g as any;
        const hasDecoration = gAny.decoration_type && gAny.decoration_type !== 'other';
        const hasPlacement = !!gAny.placement;
        const unitSell = gAny.unit_sell_price;
        const decoCost = gAny.decoration_cost;

        return (
          <div
            key={g.id}
            className="rounded-lg border bg-muted/30 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {g.style || g.description || 'Unknown garment'}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {g.item_number && <span>#{g.item_number}</span>}
                  {g.color && <span>Color: {g.color}</span>}
                  {gAny.vendor && (
                    <Badge variant="outline" className="text-xs py-0 h-4">
                      {gAny.vendor === 'sanmar' ? 'SanMar' : gAny.vendor === 'ss_activewear' ? 'S&S' : gAny.vendor}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium whitespace-nowrap">
                  ×{g.quantity}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteGarment.mutate(g.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Decoration & Placement badges */}
            {(hasDecoration || hasPlacement) && (
              <div className="flex flex-wrap gap-1">
                {hasDecoration && (
                  <Badge variant="secondary" className="text-xs">
                    {DECORATION_LABELS[gAny.decoration_type] || gAny.decoration_type}
                  </Badge>
                )}
                {hasPlacement && (
                  <Badge variant="outline" className="text-xs">
                    {gAny.placement}
                  </Badge>
                )}
              </div>
            )}

            {sizeEntries.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sizeEntries.map(([size, qty]) => (
                  <Badge key={size} variant="secondary" className="text-xs font-normal">
                    {size}: {String(qty)}
                  </Badge>
                ))}
              </div>
            )}

            {/* Pricing row */}
            {(g.unit_cost || unitSell) && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                <DollarSign className="h-3 w-3" />
                {g.unit_cost != null && g.unit_cost > 0 && (
                  <span>Cost: <span className="font-mono">${Number(g.unit_cost).toFixed(2)}</span></span>
                )}
                {decoCost != null && decoCost > 0 && (
                  <span>Deco: <span className="font-mono">${Number(decoCost).toFixed(2)}</span></span>
                )}
                {unitSell != null && unitSell > 0 && (
                  <span className="font-medium text-foreground">
                    Sell: <span className="font-mono">${Number(unitSell).toFixed(2)}</span>
                  </span>
                )}
                {g.total_cost != null && g.total_cost > 0 && (
                  <span className="ml-auto">
                    Total: <span className="font-mono font-medium">${Number(g.total_cost).toFixed(2)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
