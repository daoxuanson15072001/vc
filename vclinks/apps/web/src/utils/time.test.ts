import { describe, expect, it } from 'vitest';
import { bubbleTime, dayKey, daySeparatorLabel, fmtDuration, relativeListTime } from './time';

// All expectations are in Asia/Ho_Chi_Minh (UTC+7); the runner uses TZ=UTC.
const NOW = '2026-09-28T10:00:00+07:00';

describe('relativeListTime', () => {
  it('shows "vừa xong" under a minute', () => {
    expect(relativeListTime('2026-09-28T09:59:30+07:00', NOW)).toBe('vừa xong');
  });
  it('shows minutes under an hour', () => {
    expect(relativeListTime('2026-09-28T09:55:00+07:00', NOW)).toBe('5 phút');
  });
  it('shows hours on the same Vietnam day', () => {
    expect(relativeListTime('2026-09-28T01:00:00+07:00', NOW)).toBe('9 giờ');
    // 18:30 UTC on the 27th is already the 28th in Vietnam.
    expect(relativeListTime('2026-09-27T18:30:00Z', NOW)).toBe('8 giờ');
  });
  it('shows "Hôm qua" for the previous Vietnam day', () => {
    expect(relativeListTime('2026-09-27T23:50:00+07:00', NOW)).toBe('Hôm qua');
    expect(relativeListTime('2026-09-27T00:10:00+07:00', NOW)).toBe('Hôm qua');
  });
  it('shows dd/mm this year and dd/mm/yy otherwise', () => {
    expect(relativeListTime('2026-09-22T08:00:00+07:00', NOW)).toBe('22/09');
    expect(relativeListTime('2025-12-31T08:00:00+07:00', NOW)).toBe('31/12/25');
  });
  it('returns empty for missing or invalid input', () => {
    expect(relativeListTime(null, NOW)).toBe('');
    expect(relativeListTime('not a date', NOW)).toBe('');
  });
});

describe('daySeparatorLabel', () => {
  it('labels today and yesterday', () => {
    expect(daySeparatorLabel('2026-09-28T00:05:00+07:00', NOW)).toBe('Hôm nay');
    expect(daySeparatorLabel('2026-09-27T12:00:00+07:00', NOW)).toBe('Hôm qua');
  });
  it('uses the Vietnamese weekday and full date for older days', () => {
    expect(daySeparatorLabel('2026-09-21T12:00:00+07:00', NOW)).toBe('Thứ Hai, 21/09/2026');
    expect(daySeparatorLabel('2026-09-20T12:00:00+07:00', NOW)).toBe('Chủ Nhật, 20/09/2026');
  });
});

describe('dayKey / bubbleTime', () => {
  it('uses Vietnam time', () => {
    expect(dayKey('2026-09-27T18:30:00Z')).toBe('2026-09-28');
    expect(bubbleTime('2026-09-27T18:30:00Z')).toBe('01:30');
  });
});

describe('fmtDuration', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(fmtDuration(12)).toBe('0:12');
    expect(fmtDuration(75)).toBe('1:15');
    expect(fmtDuration(3725)).toBe('1:02:05');
    expect(fmtDuration(undefined)).toBe('');
  });
});
