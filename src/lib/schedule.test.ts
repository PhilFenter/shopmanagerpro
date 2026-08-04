import { describe, it, expect } from 'vitest';
import { layoutOverlaps, blockGeometry, HOUR_HEIGHT, START_HOUR } from './schedule';

/** Helper: an item spanning whole hours on an arbitrary day. */
const span = (name: string, startHour: number, endHour: number) => ({
  name,
  start: startHour * 60,
  end: endHour * 60,
});

const layout = (items: ReturnType<typeof span>[]) =>
  layoutOverlaps(items, (i) => i.start, (i) => i.end);

const laneOf = (result: ReturnType<typeof layout>, name: string) =>
  result.find((r) => r.item.name === name)!;

describe('layoutOverlaps', () => {
  it('gives a lone shift the full width', () => {
    const [only] = layout([span('a', 8, 16)]);
    expect(only.lane).toBe(0);
    expect(only.laneCount).toBe(1);
  });

  it('puts simultaneous shifts in separate lanes', () => {
    const result = layout([span('a', 8, 16), span('b', 8, 16), span('c', 8, 16)]);
    expect(result.every((r) => r.laneCount === 3)).toBe(true);
    expect(new Set(result.map((r) => r.lane))).toEqual(new Set([0, 1, 2]));
  });

  it('lets sequential shifts reuse the same lane at full width', () => {
    // 6-10 then 10-14: they touch but do not overlap, so neither is narrowed.
    const result = layout([span('morning', 6, 10), span('afternoon', 10, 14)]);
    expect(laneOf(result, 'morning').laneCount).toBe(1);
    expect(laneOf(result, 'afternoon').laneCount).toBe(1);
    expect(laneOf(result, 'afternoon').lane).toBe(0);
  });

  it('keeps a whole overlapping cluster at the same width', () => {
    // c only overlaps b, but b overlaps a, so all three share a cluster and
    // must render at the same width or they will not line up.
    const result = layout([span('a', 6, 10), span('b', 9, 13), span('c', 12, 16)]);
    expect(result.map((r) => r.laneCount)).toEqual([2, 2, 2]);
    expect(laneOf(result, 'c').lane).toBe(0); // reuses a's lane, which has ended
  });

  it('treats separate clusters in a day independently', () => {
    const result = layout([
      span('a', 6, 8), span('b', 6, 8),   // pair in the morning
      span('c', 14, 16),                  // alone in the afternoon
    ]);
    expect(laneOf(result, 'a').laneCount).toBe(2);
    expect(laneOf(result, 'b').laneCount).toBe(2);
    expect(laneOf(result, 'c').laneCount).toBe(1);
  });

  it('handles a full shop without dropping anyone', () => {
    const everyone = Array.from({ length: 8 }, (_, i) => span(`e${i}`, 8, 17));
    const result = layout(everyone);
    expect(result).toHaveLength(8);
    expect(new Set(result.map((r) => r.lane)).size).toBe(8);
  });

  it('returns nothing for an empty day', () => {
    expect(layout([])).toEqual([]);
  });
});

describe('blockGeometry', () => {
  const on = (hour: number, minute = 0) => new Date(2026, 7, 4, hour, minute);

  it('positions a shift against the top of the grid', () => {
    const { top, height } = blockGeometry(on(START_HOUR), on(START_HOUR + 2));
    expect(top).toBe(0);
    expect(height).toBe(2 * HOUR_HEIGHT);
  });

  it('handles half hours', () => {
    const { top, height } = blockGeometry(on(8, 30), on(9, 30));
    expect(top).toBe(2.5 * HOUR_HEIGHT);
    expect(height).toBe(HOUR_HEIGHT);
  });

  it('clamps a shift running past the end of the grid', () => {
    // 4pm to 9pm, but the grid stops at 6pm.
    const { top, height } = blockGeometry(on(16), on(21));
    expect(top).toBe(10 * HOUR_HEIGHT);
    expect(height).toBe(2 * HOUR_HEIGHT);
  });

  it('keeps a very short shift clickable', () => {
    const { height } = blockGeometry(on(8), on(8, 5));
    expect(height).toBeGreaterThanOrEqual(14);
  });
});
