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

// ─── Running a checklist (full-screen view) ───

export interface RunItem { text: string; required: boolean; done: boolean }

/** Tick or untick one item; the checklist completes when every item is done. */
export function toggleChecklistItem(items: RunItem[], index: number, now: Date = new Date()) {
  const next = items.map((it, i) => (i === index ? { ...it, done: !it.done } : it));
  const allDone = next.length > 0 && next.every(it => it.done);
  return {
    items: next,
    status: allDone ? 'completed' : 'in_progress',
    completed_at: allDone ? now.toISOString() : null,
  };
}

export function checklistProgress(items: { done: boolean }[]) {
  const done = items.filter(i => i.done).length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

/**
 * A run is "open" until it's completed or someone closes it.
 * Closing keeps the record (status 'closed') so nothing is lost; it just leaves the active lists.
 */
export function isOpenRun(status: string | null | undefined): boolean {
  return status !== 'completed' && status !== 'closed';
}

export const CLOSE_RUN_UPDATE = { status: 'closed' } as const;
