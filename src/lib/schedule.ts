/** Shared constants and helpers for the two-week employee schedule. */

/** The grid runs 6am to 6pm, so twelve one-hour rows. */
export const START_HOUR = 6;
export const END_HOUR = 18;
export const HOUR_COUNT = END_HOUR - START_HOUR;

/** Row height in pixels. Shift blocks are positioned against this. */
export const HOUR_HEIGHT = 40;

/** Dragging snaps to the hour; the editor dialog allows half hours. */
export const EDITOR_STEP_MINUTES = 30;

/**
 * Per-person colours, chosen to stay distinguishable in both themes rather than
 * pulled from the semantic tokens — those are all one hue by design.
 */
const WORKER_COLORS = [
  { bg: 'hsl(200 85% 45% / 0.85)', border: 'hsl(200 85% 35%)' },
  { bg: 'hsl(150 60% 38% / 0.85)', border: 'hsl(150 60% 28%)' },
  { bg: 'hsl(280 55% 52% / 0.85)', border: 'hsl(280 55% 42%)' },
  { bg: 'hsl(30 85% 48% / 0.85)', border: 'hsl(30 85% 38%)' },
  { bg: 'hsl(340 65% 50% / 0.85)', border: 'hsl(340 65% 40%)' },
  { bg: 'hsl(190 70% 38% / 0.85)', border: 'hsl(190 70% 28%)' },
  { bg: 'hsl(95 45% 40% / 0.85)', border: 'hsl(95 45% 30%)' },
  { bg: 'hsl(255 60% 58% / 0.85)', border: 'hsl(255 60% 48%)' },
];

/**
 * Stable colour per worker. Hashed from the id so a person keeps the same colour
 * across sessions and browsers without storing anything.
 */
export function colorForWorker(workerId: string) {
  let hash = 0;
  for (let i = 0; i < workerId.length; i++) {
    hash = (hash * 31 + workerId.charCodeAt(i)) >>> 0;
  }
  return WORKER_COLORS[hash % WORKER_COLORS.length];
}

/** Minutes since midnight, local time. */
export function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Vertical offset and height for a shift within a day column, clamped to the
 * visible window so a shift running past 6pm renders to the bottom edge rather
 * than overflowing the grid.
 */
export function blockGeometry(startsAt: Date, endsAt: Date) {
  const gridStart = START_HOUR * 60;
  const gridEnd = END_HOUR * 60;

  const start = Math.max(minutesFromMidnight(startsAt), gridStart);
  const end = Math.min(minutesFromMidnight(endsAt), gridEnd);

  const top = ((start - gridStart) / 60) * HOUR_HEIGHT;
  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT, 14);
  return { top, height };
}

/** Builds a local Date for a given day and minutes-from-midnight. */
export function atMinutes(day: Date, minutes: number): Date {
  const d = new Date(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/** "6:00 AM" / "1:30 PM" without pulling in a formatter for one line. */
export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

/** Every selectable time in the editor, 6:00 AM through 6:00 PM. */
export function editorTimeOptions(): { value: number; label: string }[] {
  const options: { value: number; label: string }[] = [];
  for (let m = START_HOUR * 60; m <= END_HOUR * 60; m += EDITOR_STEP_MINUTES) {
    options.push({ value: m, label: formatMinutes(m) });
  }
  return options;
}
