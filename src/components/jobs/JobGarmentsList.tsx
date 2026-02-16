import { useJobGarments } from '@/hooks/useJobGarments';
import { Badge } from '@/components/ui/badge';
import { Shirt } from 'lucide-react';

interface JobGarmentsListProps {
  jobId: string;
  compact?: boolean;
}

const HAT_KEYWORDS = /\b(hat|cap|beanie|visor|snapback|trucker|flexfit|richardson|r-112|yp classics|yp classic|112|r112)\b/i;

function isHatItem(g: { style?: string | null; description?: string | null; item_number?: string | null }) {
  return HAT_KEYWORDS.test(g.style || '') || HAT_KEYWORDS.test(g.description || '') || HAT_KEYWORDS.test(g.item_number || '');
}

export function JobGarmentsList({ jobId, compact = false }: JobGarmentsListProps) {
  const { garments, isLoading } = useJobGarments(jobId);

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
      <h4 className="text-sm font-medium flex items-center gap-1.5">
        <Shirt className="h-4 w-4" />
        {label} ({garments.length})
      </h4>
      <div className="space-y-2">
        {garments.map((g) => {
          const sizeEntries = Object.entries(g.sizes || {});
          return (
            <div
              key={g.id}
              className="rounded-lg border bg-muted/30 p-3 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {g.style || g.description || 'Unknown garment'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {g.item_number && <span>#{g.item_number}</span>}
                    {g.color && <span>Color: {g.color}</span>}
                  </div>
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  Qty: {g.quantity}
                </span>
              </div>
              {sizeEntries.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {sizeEntries.map(([size, qty]) => (
                    <Badge
                      key={size}
                      variant="secondary"
                      className="text-xs font-normal"
                    >
                      {size}: {qty}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
