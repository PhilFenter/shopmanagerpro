import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Shirt, Truck, MapPin, FileText, Image } from 'lucide-react';
import { stripLegacyBrandInfoFromText } from './brandDetails';

interface QuoteLineItemsSummaryProps {
  quoteId: string;
  compact?: boolean;
}

interface QuoteLineItem {
  id: string;
  service_type: string;
  description: string | null;
  quantity: number;
  style_number: string | null;
  color: string | null;
  placement: string | null;
  garment_cost: number | null;
  decoration_cost: number | null;
  line_total: number | null;
  sizes: Record<string, number> | null;
  notes: string | null;
  image_url: string | null;
  decoration_params: Record<string, unknown> | null;
}

interface QuoteDetails {
  id: string;
  quote_number: string | null;
  delivery_method: string | null;
  shipping_address: string | null;
  requested_date: string | null;
  notes: string | null;
  is_nonprofit: boolean;
  company: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export function useQuoteDetails(quoteId: string | null) {
  return useQuery({
    queryKey: ['quote-details', quoteId],
    queryFn: async () => {
      if (!quoteId) return null;

      const [quoteRes, lineItemsRes] = await Promise.all([
        supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle(),
        supabase.from('quote_line_items').select('*').eq('quote_id', quoteId).order('sort_order'),
      ]);

      return {
        quote: quoteRes.data as QuoteDetails | null,
        lineItems: (lineItemsRes.data ?? []) as QuoteLineItem[],
      };
    },
    enabled: !!quoteId,
    staleTime: 5 * 60 * 1000,
  });
}

const SERVICE_LABELS: Record<string, string> = {
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF',
  leather_patch: 'Leather Patch',
  uv_patch: 'UV Patch',
  heat_press_patch: 'Heat Press Patch',
  woven_patch: 'Woven Patch',
  pvc_patch: 'PVC Patch',
  other: 'Other',
};

function formatSizes(sizes: Record<string, number> | null): string {
  if (!sizes) return '';
  return Object.entries(sizes)
    .filter(([, qty]) => qty > 0)
    .map(([size, qty]) => `${size}:${qty}`)
    .join(', ');
}

export function QuoteLineItemsSummary({ quoteId, compact = true }: QuoteLineItemsSummaryProps) {
  const { data, isLoading } = useQuoteDetails(quoteId);

  if (isLoading || !data) return null;
  const { quote, lineItems } = data;

  if (compact) {
    const totalQty = lineItems.reduce((sum, li) => sum + (li.quantity || 0), 0);
    const visibleItems = lineItems.slice(0, 4);
    const hiddenCount = lineItems.length - visibleItems.length;

    const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
      <span className="inline-flex items-baseline gap-1">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground/80">{label}</span>
        <span className="text-xs text-foreground">{value}</span>
      </span>
    );

    return (
      <div className="mt-2 space-y-1.5">
        {/* Quote-level summary row */}
        {quote && (quote.quote_number || quote.delivery_method || quote.requested_date || quote.is_nonprofit) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted/40 px-2 py-1">
            {quote.quote_number && (
              <Field label="Quote" value={<span className="font-medium">{quote.quote_number}</span>} />
            )}
            {quote.delivery_method && (
              <Field label="Delivery" value={<span className="capitalize">{quote.delivery_method}</span>} />
            )}
            {quote.requested_date && (
              <Field label="Needed" value={new Date(quote.requested_date).toLocaleDateString()} />
            )}
            <Field label="Items" value={`${lineItems.length} (${totalQty} pcs)`} />
            {quote.is_nonprofit && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Nonprofit</Badge>
            )}
          </div>
        )}

        {/* Line items — one row each, with labeled fields */}
        <div className="space-y-1">
          {visibleItems.map((li) => (
            <div
              key={li.id}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1"
            >
              {li.image_url ? (
                <img src={li.image_url} alt="" className="h-6 w-6 rounded object-contain bg-muted/30 shrink-0" />
              ) : (
                <Shirt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 flex-1 min-w-0">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                  {SERVICE_LABELS[li.service_type] || li.service_type}
                </Badge>
                <span className="text-xs font-medium truncate">
                  {li.description || li.style_number || 'Item'}
                </span>
                {li.style_number && li.description && (
                  <Field label="Style" value={li.style_number} />
                )}
                {li.color && <Field label="Color" value={li.color} />}
                {li.placement && <Field label="Placement" value={li.placement} />}
                {li.sizes && Object.keys(li.sizes).length > 0 && (
                  <Field label="Sizes" value={formatSizes(li.sizes)} />
                )}
              </div>
              <span className="text-xs font-semibold tabular-nums shrink-0 text-muted-foreground">
                ×{li.quantity}
              </span>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="text-[11px] text-muted-foreground pl-2">
              +{hiddenCount} more {hiddenCount === 1 ? 'item' : 'items'}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quote && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {quote.quote_number && (
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Quote:</span>
              <span className="font-medium">{quote.quote_number}</span>
            </div>
          )}
          {quote.delivery_method && (
            <div className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Delivery:</span>
              <span className="font-medium capitalize">{quote.delivery_method}</span>
            </div>
          )}
          {quote.customer_email && (
            <div className="flex items-center gap-1.5 col-span-2">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{quote.customer_email}</span>
            </div>
          )}
          {quote.customer_phone && (
            <div className="flex items-center gap-1.5 col-span-2">
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-medium">{quote.customer_phone}</span>
            </div>
          )}
          {(quote.address_line1 || quote.city) && (
            <div className="flex items-center gap-1.5 col-span-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">
                {[quote.address_line1, quote.city, quote.state, quote.zip].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {quote.requested_date && (
            <div className="flex items-center gap-1.5 col-span-2">
              <span className="text-muted-foreground">Requested date:</span>
              <span className="font-medium">{new Date(quote.requested_date).toLocaleDateString()}</span>
            </div>
          )}
          {quote.is_nonprofit && (
            <Badge variant="secondary" className="text-xs w-fit">Nonprofit</Badge>
          )}
        </div>
      )}

      <div className="space-y-2">
        {lineItems.map((li, idx) => {
          const cleanedNotes = stripLegacyBrandInfoFromText(li.notes || '');

          return (
            <div key={li.id} className="rounded-md border p-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {SERVICE_LABELS[li.service_type] || li.service_type}
                  </Badge>
                  <span className="text-sm font-medium">
                    {li.description || li.style_number || `Line ${idx + 1}`}
                  </span>
                </div>
                <span className="text-sm font-semibold">×{li.quantity}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {li.style_number && <span>Style: {li.style_number}</span>}
                {li.color && <span>Color: {li.color}</span>}
                {li.placement && <span>Placement: {li.placement}</span>}
                {li.sizes && Object.keys(li.sizes).length > 0 && (
                  <span>Sizes: {formatSizes(li.sizes)}</span>
                )}
              </div>
              {cleanedNotes && (
                <p className="text-xs text-muted-foreground italic whitespace-pre-wrap break-words">{cleanedNotes}</p>
              )}
              {li.image_url && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Image className="h-3 w-3" />
                    <span>Customer Artwork</span>
                  </div>
                  <a href={li.image_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={li.image_url}
                      alt="Customer artwork"
                      className="rounded-md border max-h-48 object-contain bg-muted/20"
                    />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
