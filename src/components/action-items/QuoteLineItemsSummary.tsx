import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Shirt, Package, Truck, MapPin, FileText, Image } from 'lucide-react';

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
    // Inline badges for the action item row
    return (
      <div className="flex flex-wrap items-center gap-1 mt-1">
        {lineItems.map((li) => (
          <Badge key={li.id} variant="outline" className="text-xs font-normal gap-1">
            {li.image_url ? (
              <img src={li.image_url} alt="" className="h-4 w-4 rounded object-contain" />
            ) : (
              <Shirt className="h-3 w-3" />
            )}
            {li.description || li.style_number || SERVICE_LABELS[li.service_type] || li.service_type}
            {li.color && ` — ${li.color}`}
            <span className="text-muted-foreground">×{li.quantity}</span>
          </Badge>
        ))}
        {lineItems.length > 3 && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            +{lineItems.length - 3} more
          </Badge>
        )}
      </div>
    );
  }

  // Full detail view for the detail sheet
  return (
    <div className="space-y-3">
      {/* Quote metadata */}
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

      {/* Line items */}
      <div className="space-y-2">
        {lineItems.map((li, idx) => (
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
            {li.notes && (
              <p className="text-xs text-muted-foreground italic">{li.notes}</p>
            )}
            {/* Brand / questionnaire details from decoration_params */}
            {li.decoration_params && (() => {
              const skipKeys = new Set([
                'hatModel', 'hatStyle', 'hatBrand', 'hatColor', 'hatColors',
                'patchType', 'patchShape', 'patchSize', 'leatherColor',
                'garmentType', 'orderType', 'printLocations', 'embroideryLocations',
                'printColors', 'style_number', 'style', 'colors', 'shape', 'size',
                'patch_type', 'intent', 'poloTier', 'recommendedDecoration',
              ]);
              const brandFields = Object.entries(li.decoration_params)
                .filter(([k, v]) => !skipKeys.has(k) && v !== null && v !== undefined && v !== '')
                .map(([k, v]) => ({
                  label: k.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim().replace(/^\w/, c => c.toUpperCase()),
                  value: typeof v === 'object' ? JSON.stringify(v) : String(v),
                }));
              if (brandFields.length === 0) return null;
              return (
                <div className="mt-2 space-y-1 p-2 rounded bg-muted/30 border">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Brand & Project Details</div>
                  {brandFields.map(({ label, value }) => (
                    <div key={label} className="text-xs">
                      <span className="text-muted-foreground">{label}:</span>{' '}
                      <span className="text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
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
        ))}
      </div>
    </div>
  );
}
