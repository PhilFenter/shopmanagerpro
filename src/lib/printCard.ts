// Helpers for the printable SOP station cards and checklist sheets
// (/print/sop/:id and /print/checklist/:id). Kept free of React so they can be tested.

export type ChecklistPrintMode = 'laminated' | 'per-job';

/** Letter page minus 0.5in margins all round, in CSS px (96 per inch). */
export const LETTER_CONTENT_HEIGHT_PX = 10 * 96;

/**
 * The revision date printed on a card: the most recent edit to the SOP itself
 * or to any of its steps. Editing a step doesn't touch the SOP row, so both count.
 */
export function revisionDate(
  sopUpdatedAt: string,
  steps: { updated_at: string | null }[] = [],
): Date {
  let latest = new Date(sopUpdatedAt).getTime();
  for (const s of steps) {
    if (!s.updated_at) continue;
    const t = new Date(s.updated_at).getTime();
    if (!Number.isNaN(t) && t > latest) latest = t;
  }
  return new Date(latest);
}

export function formatRevision(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Per-job paper sheets travel with the job ticket (counts, QC, packing).
 * Everything else (startup, shutdown, cleaning) is a reusable laminated card.
 * This only picks the starting choice; the print page lets you switch.
 */
export function defaultChecklistMode(title: string, category?: string | null): ChecklistPrintMode {
  const text = `${title} ${category ?? ''}`.toLowerCase();
  return /\b(qc|quality|pack|packing|goods in|receiv|count|intake|ship)/.test(text)
    ? 'per-job'
    : 'laminated';
}

/** Where a card's QR code points: the SOP opened in Shop Knowledge. */
export function sopLink(origin: string, sopId: string): string {
  return `${origin.replace(/\/$/, '')}/knowledge?sop=${encodeURIComponent(sopId)}`;
}

/** Roughly how many letter pages a rendered card takes. */
export function estimatePages(contentHeightPx: number): number {
  if (contentHeightPx <= 0) return 1;
  return Math.max(1, Math.ceil(contentHeightPx / LETTER_CONTENT_HEIGHT_PX));
}
