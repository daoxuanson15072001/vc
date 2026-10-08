import { describe, expect, it } from 'vitest';
import { ATTENTION, hangingMinutes } from './queue';
import { OUTBOX_ATTENTION } from '@vclinks/shared';

describe('outbox queue helpers', () => {
  it('"Treo {n} phút" counts whole minutes since the last status change', () => {
    const now = Date.parse('2026-10-04T10:30:00Z');
    expect(hangingMinutes({ statusAt: '2026-10-04T10:00:00Z', createdAt: '2026-10-04T09:00:00Z' }, now)).toBe(30);
    expect(hangingMinutes({ createdAt: '2026-10-04T10:29:30Z' }, now)).toBe(0);
  });

  it('badge statuses match the shared list', () => {
    expect([...ATTENTION].sort()).toEqual([...OUTBOX_ATTENTION].sort());
  });
});
