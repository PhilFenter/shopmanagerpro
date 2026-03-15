export interface BrandField {
  label: string;
  value: string;
  icon?: React.ElementType;
}

export const BRAND_FIELD_CONFIG: { key: string; label: string; icon?: React.ElementType }[] = [
  { key: 'brandName', label: 'Brand Name' },
  { key: 'brandStory', label: 'Brand Story' },
  { key: 'brandVibe', label: 'Brand Vibe' },
  { key: 'targetAudience', label: 'Target Audience' },
  { key: 'brandColors', label: 'Brand Colors' },
  { key: 'industry', label: 'Industry' },
  { key: 'useCase', label: 'Use Case' },
  { key: 'stylePreference', label: 'Style Preference' },
  { key: 'inspirationNotes', label: 'Inspiration' },
  { key: 'designNotes', label: 'Design Notes' },
  { key: 'logoNotes', label: 'Logo Notes' },
  { key: 'additionalNotes', label: 'Additional Notes' },
  { key: 'budgetRange', label: 'Budget Range' },
];

export const SPEC_KEYS = new Set([
  'hatModel', 'hatStyle', 'hatBrand', 'hatColor', 'hatColors',
  'patchType', 'patchShape', 'patchSize', 'leatherColor',
  'garmentType', 'orderType', 'printLocations', 'embroideryLocations',
  'printColors', 'style_number', 'style', 'colors', 'shape', 'size',
  'patch_type', 'intent', 'poloTier', 'recommendedDecoration', 'eventDate',
]);

const LEGACY_NOTE_FIELDS: { label: string; aliases: string[] }[] = [
  { label: 'Brand Source', aliases: ['Source'] },
  { label: 'Brand Story', aliases: ['Brand Story', 'What They Do'] },
  { label: 'Success Looks Like', aliases: ['Success Looks Like'] },
  { label: 'Brand Vibe', aliases: ['Brand Vibe'] },
  { label: 'Target Audience', aliases: ['Target Audience'] },
  { label: 'Brand Colors', aliases: ['Brand Colors'] },
  { label: 'Years In Business', aliases: ['Years In Business'] },
  { label: 'Team Size', aliases: ['Team Size'] },
  { label: 'Ordered Before', aliases: ['Ordered Before'] },
  { label: 'Artwork Status', aliases: ['Artwork Status'] },
  { label: 'Timeline', aliases: ['Timeline'] },
  { label: 'Brand Name', aliases: ['Brand Name'] },
  { label: 'Industry', aliases: ['Industry'] },
  { label: 'Use Case', aliases: ['Use Case'] },
  { label: 'Style Preference', aliases: ['Style Preference'] },
  { label: 'Inspiration', aliases: ['Inspiration'] },
  { label: 'Design Notes', aliases: ['Design Notes'] },
  { label: 'Logo Notes', aliases: ['Logo Notes'] },
  { label: 'Additional Notes', aliases: ['Additional Notes'] },
  { label: 'Budget Range', aliases: ['Budget Range'] },
];

function normalizeValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

export function extractBrandFieldsFromQuoteData(quoteData: any): BrandField[] {
  if (!quoteData?.lineItems?.length) return [];

  const merged = new Map<string, BrandField>();

  for (const cfg of BRAND_FIELD_CONFIG) {
    for (const li of quoteData.lineItems) {
      const value = li?.decoration_params?.[cfg.key];
      if (value !== null && value !== undefined && value !== '') {
        merged.set(cfg.label, { label: cfg.label, value: normalizeValue(value) });
        break;
      }
    }
  }

  for (const li of quoteData.lineItems) {
    if (li?.decoration_params) {
      for (const [k, v] of Object.entries(li.decoration_params)) {
        if (SPEC_KEYS.has(k) || v === null || v === undefined || v === '') continue;
        const label = BRAND_FIELD_CONFIG.find((f) => f.key === k)?.label
          ?? k.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim().replace(/^\w/, c => c.toUpperCase());
        if (!merged.has(label)) {
          merged.set(label, { label, value: normalizeValue(v) });
        }
      }
    }

    for (const field of parseLegacyBrandFieldsFromText(li?.notes || '')) {
      if (!merged.has(field.label)) merged.set(field.label, field);
    }
  }

  return Array.from(merged.values());
}

export function parseLegacyBrandFieldsFromText(text: string): BrandField[] {
  if (!text) return [];

  const compact = text.replace(/\s+/g, ' ').trim();
  const matches: { index: number; label: string; match: string }[] = [];

  for (const field of LEGACY_NOTE_FIELDS) {
    for (const alias of field.aliases) {
      const regex = new RegExp(`${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'ig');
      const found = regex.exec(compact);
      if (found) {
        matches.push({ index: found.index, label: field.label, match: found[0] });
        break;
      }
    }
  }

  const ordered = matches.sort((a, b) => a.index - b.index);
  const fields: BrandField[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const current = ordered[i];
    const start = current.index + current.match.length;
    const end = ordered[i + 1]?.index ?? compact.length;
    const rawValue = compact.slice(start, end)
      .replace(/^\s*[—-]\s*/, '')
      .replace(/\s*[—-]\s*$/, '')
      .trim();

    if (!rawValue) continue;
    if (/^(quantity|estimate|order details|hat brand|hat model|hat color|patch shape|patch size|leather color|artwork file)$/i.test(current.label)) continue;
    fields.push({ label: current.label, value: rawValue });
  }

  return fields;
}

export function stripLegacyBrandInfoFromText(text: string): string {
  if (!text) return '';

  let cleaned = text;
  cleaned = cleaned.replace(/\s*—\s*Brand Info\s*—[\s\S]*?(?=\s*—\s*[^—\n]+Quote\s*—|$)/i, '');

  const lineLabels = new Set([
    ...BRAND_FIELD_CONFIG.map((f) => f.label),
    ...LEGACY_NOTE_FIELDS.map((f) => f.label),
    'Source', 'What They Do', 'Success Looks Like', 'Years In Business', 'Team Size', 'Ordered Before', 'Artwork Status', 'Timeline',
  ]);

  cleaned = cleaned
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !Array.from(lineLabels).some((label) => trimmed.startsWith(`${label}:`));
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}
