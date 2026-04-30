import { Building2, Hash, CalendarClock } from 'lucide-react';

interface QuoteEssentialsRowProps {
  description: string;
}

function pickField(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\s)${label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}:\\s*([^—\\n]+?)(?=\\s+(?:[A-Z][\\w/ ]{0,30}):|\\s*—|$)`, 'i');
    const m = text.match(re);
    if (m && m[1]) {
      const v = m[1].trim().replace(/[.,;]+$/, '');
      if (v) return v;
    }
  }
  return null;
}

export function QuoteEssentialsRow({ description }: QuoteEssentialsRowProps) {
  const company = pickField(description, ['Company/Org', 'Company', 'Brand Name']);
  const quantity = pickField(description, ['Quantity', 'Items Needed']);
  const deadline = pickField(description, ['Deadline Date', 'Event Date', 'Deadline']);

  if (!company && !quantity && !deadline) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
      {company && (
        <span className="inline-flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          <span className="text-foreground font-medium truncate max-w-[260px]">{company}</span>
        </span>
      )}
      {quantity && (
        <span className="inline-flex items-center gap-1">
          <Hash className="h-3 w-3" />
          <span>{quantity}</span>
        </span>
      )}
      {deadline && (
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" />
          <span>{deadline}</span>
        </span>
      )}
    </div>
  );
}
