import type { ServiceType } from '@/hooks/useJobs';

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF',
  leather_patch: 'Leather',
  uv_patch: 'UV Patch',
  heat_press_patch: 'Heat Press',
  woven_patch: 'Woven',
  pvc_patch: 'PVC',
  mixed: 'Mixed',
  other: 'Other',
};

/** Same labels keyed by string for analytics/reporting contexts */
export const SERVICE_LABELS: Record<string, string> = SERVICE_TYPE_LABELS;
