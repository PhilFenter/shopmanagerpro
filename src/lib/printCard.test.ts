import { describe, it, expect } from 'vitest';
import {
  defaultChecklistMode, estimatePages, formatRevision, revisionDate, sopLink, LETTER_CONTENT_HEIGHT_PX,
  toggleChecklistItem, checklistProgress, isOpenRun,
} from './printCard';

describe('revisionDate', () => {
  it('uses the SOP date when no step is newer', () => {
    const d = revisionDate('2026-10-10T12:00:00Z', [{ updated_at: '2026-09-01T00:00:00Z' }]);
    expect(d.toISOString()).toBe('2026-10-10T12:00:00.000Z');
  });

  it('uses the newest step edit, since editing a step does not touch the SOP row', () => {
    const d = revisionDate('2026-10-10T12:00:00Z', [
      { updated_at: '2026-10-12T08:00:00Z' },
      { updated_at: null },
      { updated_at: 'not a date' },
      { updated_at: '2026-10-15T09:30:00Z' },
    ]);
    expect(d.toISOString()).toBe('2026-10-15T09:30:00.000Z');
  });

  it('formats like "Oct 15, 2026"', () => {
    expect(formatRevision(new Date('2026-10-15T18:00:00Z'))).toBe('Oct 15, 2026');
  });
});

describe('defaultChecklistMode', () => {
  it.each([
    ['QC / Pack', null],
    ['Goods In count', null],
    ['Receiving check', 'Shipping & Receiving'],
    ['Final quality check', null],
  ])('"%s" defaults to a per-job paper sheet', (title, category) => {
    expect(defaultChecklistMode(title, category)).toBe('per-job');
  });

  it.each([
    ['Barudan daily startup', 'Embroidery'],
    ['Hydra shutdown and cleaning', 'DTF Printing'],
    ['Screen reclaim', 'Screen Printing'],
  ])('"%s" defaults to a laminated card', (title, category) => {
    expect(defaultChecklistMode(title, category)).toBe('laminated');
  });
});

describe('sopLink', () => {
  it('points the QR code at the SOP in Shop Knowledge', () => {
    expect(sopLink('https://shop.example.com/', 'abc-123')).toBe('https://shop.example.com/knowledge?sop=abc-123');
  });
});

describe('estimatePages', () => {
  it('counts letter pages', () => {
    expect(estimatePages(0)).toBe(1);
    expect(estimatePages(LETTER_CONTENT_HEIGHT_PX)).toBe(1);
    expect(estimatePages(LETTER_CONTENT_HEIGHT_PX + 1)).toBe(2);
    expect(estimatePages(LETTER_CONTENT_HEIGHT_PX * 2.5)).toBe(3);
  });
});

describe('toggleChecklistItem', () => {
  const items = [
    { text: 'A', required: true, done: false },
    { text: 'B', required: false, done: true },
  ];
  const now = new Date('2026-10-18T19:00:00Z');

  it('ticks one item and stays in progress', () => {
    const r = toggleChecklistItem([{ ...items[0] }, { ...items[1], done: false }], 0, now);
    expect(r.items.map(i => i.done)).toEqual([true, false]);
    expect(r.status).toBe('in_progress');
    expect(r.completed_at).toBeNull();
  });

  it('completes when the last item is ticked', () => {
    const r = toggleChecklistItem(items, 0, now);
    expect(r.status).toBe('completed');
    expect(r.completed_at).toBe('2026-10-18T19:00:00.000Z');
  });

  it('reopens when an item is unticked', () => {
    const r = toggleChecklistItem([{ ...items[0], done: true }, items[1]], 1, now);
    expect(r.status).toBe('in_progress');
    expect(r.completed_at).toBeNull();
  });

  it('does not change the original list', () => {
    toggleChecklistItem(items, 0, now);
    expect(items[0].done).toBe(false);
  });
});

describe('checklistProgress', () => {
  it('counts done items', () => {
    expect(checklistProgress([{ done: true }, { done: false }, { done: true }, { done: false }]))
      .toEqual({ done: 2, total: 4, percent: 50 });
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe('isOpenRun', () => {
  it('treats completed and closed runs as done, everything else as open', () => {
    expect(isOpenRun('in_progress')).toBe(true);
    expect(isOpenRun(null)).toBe(true);
    expect(isOpenRun('completed')).toBe(false);
    expect(isOpenRun('closed')).toBe(false);
  });
});
