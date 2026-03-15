import { Label } from '@/components/ui/label';
import { Palette, Users, Sparkles, Building2, MessageSquareText } from 'lucide-react';
import { extractBrandFieldsFromQuoteData } from './brandDetails';

const FIELD_ICONS: Record<string, React.ElementType> = {
  'Brand Name': Building2,
  'Brand Story': MessageSquareText,
  'Brand Vibe': Sparkles,
  'Target Audience': Users,
  'Brand Colors': Palette,
};

interface BrandDetailsSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quoteData: any;
}

export function BrandDetailsSection({ quoteData }: BrandDetailsSectionProps) {
  const fields = extractBrandFieldsFromQuoteData(quoteData).map((field) => ({
    ...field,
    icon: FIELD_ICONS[field.label],
  }));

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
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
