import { Label } from '@/components/ui/label';
import { Palette, Users, Sparkles, Building2, MessageSquareText } from 'lucide-react';

const BRAND_FIELD_CONFIG: { key: string; label: string; icon?: React.ElementType }[] = [
  { key: 'brandName', label: 'Brand Name', icon: Building2 },
  { key: 'brandStory', label: 'Brand Story', icon: MessageSquareText },
  { key: 'brandVibe', label: 'Brand Vibe', icon: Sparkles },
  { key: 'targetAudience', label: 'Target Audience', icon: Users },
  { key: 'brandColors', label: 'Brand Colors', icon: Palette },
  { key: 'industry', label: 'Industry' },
  { key: 'useCase', label: 'Use Case' },
  { key: 'stylePreference', label: 'Style Preference' },
  { key: 'inspirationNotes', label: 'Inspiration' },
  { key: 'designNotes', label: 'Design Notes' },
  { key: 'logoNotes', label: 'Logo Notes' },
  { key: 'additionalNotes', label: 'Additional Notes' },
  { key: 'budgetRange', label: 'Budget Range' },
];

// Keys that are garment/patch specs (not brand info)
const SPEC_KEYS = new Set([
  'hatModel', 'hatStyle', 'hatBrand', 'hatColor', 'hatColors',
  'patchType', 'patchShape', 'patchSize', 'leatherColor',
  'garmentType', 'orderType', 'printLocations', 'embroideryLocations',
  'printColors', 'style_number', 'style', 'colors', 'shape', 'size',
  'patch_type', 'intent', 'poloTier', 'recommendedDecoration', 'eventDate',
]);

interface BrandDetailsSectionProps {
  quoteData: {
    quote: unknown;
    lineItems: Array<{ decoration_params: Record<string, unknown> | null; [key: string]: unknown }>;
  } | null | undefined;
}

export function BrandDetailsSection({ quoteData }: BrandDetailsSectionProps) {
  if (!quoteData?.lineItems?.length) return null;

  // Merge all decoration_params to find brand fields
  const merged: Record<string, unknown> = {};
  for (const li of quoteData.lineItems) {
    if (!li.decoration_params) continue;
    for (const [k, v] of Object.entries(li.decoration_params)) {
      if (!SPEC_KEYS.has(k) && v !== null && v !== undefined && v !== '') {
        merged[k] = v;
      }
    }
  }

  // Build ordered fields from config, then any remaining
  const configKeys = new Set(BRAND_FIELD_CONFIG.map(f => f.key));
  const fields: { label: string; value: string; icon?: React.ElementType }[] = [];

  for (const cfg of BRAND_FIELD_CONFIG) {
    const val = merged[cfg.key];
    if (val !== undefined) {
      fields.push({
        label: cfg.label,
        value: typeof val === 'object' ? JSON.stringify(val) : String(val),
        icon: cfg.icon,
      });
    }
  }

  // Any extra fields not in config
  for (const [k, v] of Object.entries(merged)) {
    if (configKeys.has(k)) continue;
    const label = k.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim().replace(/^\w/, c => c.toUpperCase());
    fields.push({ label, value: typeof v === 'object' ? JSON.stringify(v) : String(v) });
  }

  if (fields.length === 0) return null;

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Brand & Customer Details</Label>
      <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
        {fields.map(({ label, value, icon: Icon }) => (
          <div key={label} className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {Icon && <Icon className="h-3 w-3" />}
              {label}
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
