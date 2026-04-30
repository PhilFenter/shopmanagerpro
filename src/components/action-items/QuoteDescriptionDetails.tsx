import { useMemo } from 'react';

interface QuoteDescriptionDetailsProps {
  description: string;
}

interface Section {
  title: string | null;
  fields: { label: string; value: string }[];
  loose: string[];
}

// Known field labels we want to recognize. Order doesn't matter for parsing,
// but longer/multi-word labels should appear before shorter ones to avoid
// partial matches (e.g. "Event Date" before "Date").
const KNOWN_LABELS = [
  'Company/Org',
  'Company',
  'Brand Name',
  'Name',
  'Email',
  'Phone',
  'Customer Notes',
  'Customer Name',
  'Event Type',
  'Event Date',
  'Event Details',
  'Items Needed',
  'Quantity',
  'Deadline Type',
  'Deadline Date',
  'Deadline',
  'Artwork Status',
  'Timeline',
  'Order Details',
  'Source',
  'Notes',
  'Budget Range',
  'Budget',
  'Industry',
  'Use Case',
  'Style Preference',
  'Inspiration',
  'Design Notes',
  'Logo Notes',
  'Additional Notes',
  'Brand Story',
  'Brand Vibe',
  'Brand Colors',
  'Target Audience',
  'Success Looks Like',
  'Years In Business',
  'Team Size',
  'Ordered Before',
  'What They Do',
];

function parseSections(text: string): { lead: string; sections: Section[] } {
  if (!text) return { lead: '', sections: [] };

  // Split by "— Section Name —" markers.
  const sectionRegex = /—\s*([^—\n]+?)\s*—/g;
  const parts: { title: string | null; body: string }[] = [];
  let lastIndex = 0;
  let lastTitle: string | null = null;
  let m: RegExpExecArray | null;

  while ((m = sectionRegex.exec(text)) !== null) {
    const body = text.slice(lastIndex, m.index).trim();
    if (body) parts.push({ title: lastTitle, body });
    lastTitle = m[1].trim();
    lastIndex = m.index + m[0].length;
  }
  const tail = text.slice(lastIndex).trim();
  if (tail) parts.push({ title: lastTitle, body: tail });
  if (parts.length === 0) parts.push({ title: null, body: text });

  // For each section, find label:value pairs by scanning for known labels.
  const labelAlt = KNOWN_LABELS
    .map(l => l.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
    .join('|');
  const fieldRegex = new RegExp(`(?:^|\\s)(${labelAlt}):\\s*`, 'gi');

  let lead = '';
  const sections: Section[] = [];

  parts.forEach((part, idx) => {
    const matches: { idx: number; len: number; label: string }[] = [];
    let mm: RegExpExecArray | null;
    const re = new RegExp(fieldRegex.source, 'gi');
    while ((mm = re.exec(part.body)) !== null) {
      // Find the label string canonical case from KNOWN_LABELS
      const found = mm[1];
      const canonical = KNOWN_LABELS.find(l => l.toLowerCase() === found.toLowerCase()) || found;
      matches.push({
        idx: mm.index + mm[0].indexOf(found),
        len: mm[0].length - (mm[0].indexOf(found)),
        label: canonical,
      });
    }

    const fields: { label: string; value: string }[] = [];
    const looseChunks: string[] = [];

    if (matches.length === 0) {
      const trimmed = part.body.trim();
      if (trimmed) looseChunks.push(trimmed);
    } else {
      // Anything before the first match is loose lead text
      if (matches[0].idx > 0) {
        const pre = part.body.slice(0, matches[0].idx).trim();
        if (pre) looseChunks.push(pre);
      }
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].idx + matches[i].len;
        const end = i + 1 < matches.length ? matches[i + 1].idx : part.body.length;
        const value = part.body.slice(start, end).replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
        if (value) fields.push({ label: matches[i].label, value });
      }
    }

    if (idx === 0 && part.title === null && fields.length === 0 && looseChunks.length > 0) {
      // The very first untitled chunk with no fields is the lead sentence
      lead = looseChunks.join(' ');
      return;
    }

    if (fields.length === 0 && looseChunks.length === 0) return;
    sections.push({ title: part.title, fields, loose: looseChunks });
  });

  return { lead, sections };
}

// Drop fields that are duplicates across sections (same label+value)
function dedupe(sections: Section[]): Section[] {
  const seen = new Set<string>();
  return sections.map(s => ({
    ...s,
    fields: s.fields.filter(f => {
      const key = `${f.label.toLowerCase()}::${f.value.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  })).filter(s => s.fields.length > 0 || s.loose.length > 0);
}

export function QuoteDescriptionDetails({ description }: QuoteDescriptionDetailsProps) {
  const { lead, sections } = useMemo(() => {
    const parsed = parseSections(description);
    return { lead: parsed.lead, sections: dedupe(parsed.sections) };
  }, [description]);

  if (!lead && sections.length === 0) {
    return <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{description}</p>;
  }

  return (
    <div className="mt-1 space-y-2">
      {lead && <p className="text-sm text-muted-foreground">{lead}</p>}
      {sections.map((section, i) => (
        <div key={i} className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
          {section.title && (
            <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">
              {section.title}
            </div>
          )}
          {section.fields.length > 0 && (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
              {section.fields.map((f, j) => (
                <FieldRow key={j} label={f.label} value={f.value} />
              ))}
            </dl>
          )}
          {section.loose.map((chunk, j) => (
            <p key={`loose-${j}`} className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
              {chunk}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground/80 pt-0.5">
        {label}
      </dt>
      <dd className="text-xs text-foreground break-words">{value}</dd>
    </>
  );
}
