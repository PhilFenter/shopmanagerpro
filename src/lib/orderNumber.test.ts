import { describe, it, expect } from 'vitest';
import { compareOrderNumberDesc, compareJobsNewestFirst } from './orderNumber';

describe('order number sorting', () => {
  it('sorts numerically, not as text', () => {
    const jobs = ['999', '1000', '1111', '98'].map((order_number) => ({ order_number }));
    expect(jobs.sort(compareOrderNumberDesc).map((j) => j.order_number)).toEqual(['1111', '1000', '999', '98']);
  });
  it('puts newest jobs first, numeric tie-break', () => {
    const jobs = [
      { order_number: '999', created_at: '2026-08-17' },
      { order_number: '3701', created_at: '2026-10-16' },
      { order_number: '1111', created_at: '2026-10-22' },
      { order_number: '1110', created_at: '2026-10-22' },
    ];
    expect(jobs.sort(compareJobsNewestFirst).map((j) => j.order_number)).toEqual(['1111', '1110', '3701', '999']);
  });
});
