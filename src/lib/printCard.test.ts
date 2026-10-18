import { describe, it, expect } from 'vitest';
import {
  defaultChecklistMode, estimatePages, formatRevision, revisionDate, sopLink, LETTER_CONTENT_HEIGHT_PX,
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
