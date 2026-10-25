// InkSoft decoration method → HCD production method.
// InkSoft's method is always kept as printed; this only proposes the in-house method.

export type ProductionMethod = 'embroidery' | 'dtf' | 'screen_print' | 'laser' | 'leather_patch' | 'other';

export const METHOD_LABELS: Record<ProductionMethod, string> = {
  embroidery: 'Embroidery',
  dtf: 'DTF',
  screen_print: 'Screen print',
  laser: 'Laser',
  leather_patch: 'Leather patch',
  other: 'Other',
};

export interface MethodRule {
  /** null = applies to every store */
  store_name: string | null;
  method_inksoft: string;
  method_production: ProductionMethod;
  note?: string | null;
}

/**
 * HCD rules confirmed by Phil on Oct 25 2026. The migration seeds the same rows into
 * prod_method_rules; the database copy is what the app uses.
 */
export const DEFAULT_METHOD_RULES: MethodRule[] = [
  { store_name: null, method_inksoft: 'Embroidery', method_production: 'embroidery', note: 'InkSoft embroidery' },
  { store_name: null, method_inksoft: 'DigitalPrint', method_production: 'dtf', note: 'InkSoft DigitalPrint is DTF at HCD' },
  { store_name: null, method_inksoft: 'ScreenPrint', method_production: 'dtf', note: 'Store orders marked ScreenPrint are produced as DTF' },
];

export interface MethodProposal {
  method: ProductionMethod | null;
  /** why: 'rule' when a rule matched, otherwise null (staff must choose) */
  source: 'rule' | null;
  /** true when the production method differs from what InkSoft says */
  isOverride: boolean;
  note: string | null;
}

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '').toLowerCase();

const NATURAL: Record<string, ProductionMethod> = {
  embroidery: 'embroidery',
  screenprint: 'screen_print',
  dtf: 'dtf',
  digitalprint: 'dtf',
};

export function proposeMethod(methodInksoft: string | null, storeName: string | null, rules: MethodRule[]): MethodProposal {
  if (!methodInksoft) return { method: null, source: null, isOverride: false, note: null };
  const m = norm(methodInksoft);
  const hit =
    rules.find((r) => r.store_name && norm(r.store_name) === norm(storeName) && norm(r.method_inksoft) === m) ??
    rules.find((r) => !r.store_name && norm(r.method_inksoft) === m);
  if (!hit) return { method: null, source: null, isOverride: false, note: null };
  const natural = NATURAL[m];
  return {
    method: hit.method_production,
    source: 'rule',
    isOverride: natural !== undefined && natural !== hit.method_production,
    note: hit.note ?? null,
  };
}
