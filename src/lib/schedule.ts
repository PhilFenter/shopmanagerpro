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

export interface LaidOut<T> {
  item: T;
  /** Column index within the overlapping group. */
  lane: number;
  /** How many columns that group needs, so widths match across it. */
  laneCount: number;
}

/**
 * Assigns side-by-side lanes to overlapping items, the way a calendar does.
 *
 * Several people working the same hours is the normal case in the shop, not an
 * edge case, so blocks have to sit beside each other rather than on top. Items
 * are grouped into clusters of transitively-overlapping shifts; every member of
 * a cluster gets the same laneCount so their widths line up, and separate
 * clusters in the same day are free to use the full width again.
 */
export function layoutOverlaps<T>(
  items: T[],
  getStart: (item: T) => number,
  getEnd: (item: T) => number,
): LaidOut<T>[] {
  const sorted = [...items].sort(
    (a, b) => getStart(a) - getStart(b) || getEnd(b) - getEnd(a),
  );

  const placed: LaidOut<T>[] = [];
  let cluster: LaidOut<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    const laneCount = Math.max(laneEnds.length, 1);
    for (const entry of cluster) {
      entry.laneCount = laneCount;
      placed.push(entry);
    }
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    const start = getStart(item);
    const end = getEnd(item);

    // A gap with nothing spanning it ends the cluster.
    if (cluster.length > 0 && start >= clusterEnd) closeCluster();

    // Reuse the first lane that has already finished, else open a new one.
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }

    cluster.push({ item, lane, laneCount: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }

  if (cluster.length > 0) closeCluster();
  return placed;
}

/** Every selectable time in the editor, 6:00 AM through 6:00 PM. */
export function editorTimeOptions(): { value: number; label: string }[] {
  const options: { value: number; label: string }[] = [];
  for (let m = START_HOUR * 60; m <= END_HOUR * 60; m += EDITOR_STEP_MINUTES) {
    options.push({ value: m, label: formatMinutes(m) });
  }
  return options;
}
