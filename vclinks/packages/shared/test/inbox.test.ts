import { describe, expect, it } from 'vitest';
import { DEFAULT_SLA_CONFIG, addWorkingMinutes, isWorkingTime, slaChip, unansweredSinceOf, vnParts, workingMinutesBetween } from '../src/inbox';

/** Instant from a Vietnam wall-clock time (UTC+7). */
const vn = (iso: string) => new Date(`${iso}+07:00`).getTime();
const cal = DEFAULT_SLA_CONFIG.calendar;

describe('unansweredSinceOf (SZ-21)', () => {
  it('waits since the first customer message after the last message of the nick', () => {
    expect(unansweredSinceOf([{ own: false, sentAt: 10 }, { own: true, sentAt: 20 }, { own: false, sentAt: 30 }, { own: false, sentAt: 40 }])).toBe(30);
  });
  it('a reply from the phone app (own message) ends the wait', () => {
    expect(unansweredSinceOf([{ own: false, sentAt: 10 }, { own: true, sentAt: 20 }])).toBeNull();
  });
  it('system events and notes are neither a customer message nor a reply', () => {
    expect(unansweredSinceOf([{ own: false, sentAt: 10 }, { own: true, sentAt: 20, ignore: true }])).toBe(10);
    expect(unansweredSinceOf([{ own: false, sentAt: 10, ignore: true }])).toBeNull();
  });
  it('uses the real send time, not the arrival order', () => {
    expect(unansweredSinceOf([{ own: true, sentAt: 50 }, { own: false, sentAt: 40 }])).toBeNull();
  });
});

describe('work calendar in Asia/Ho_Chi_Minh', () => {
  it('splits an instant by Vietnam wall clock, not UTC', () => {
    // Sunday 23:30 UTC = Monday 06:30 in Vietnam.
    const p = vnParts(Date.parse('2026-10-04T23:30:00Z'));
    expect(p.weekday).toBe(1);
    expect(p.ymd).toBe('2026-10-05');
    expect(p.minuteOfDay).toBe(6 * 60 + 30);
  });
  it('deadline inside the morning window', () => {
    expect(addWorkingMinutes(vn('2026-10-05T09:00:00'), 15, cal)).toBe(vn('2026-10-05T09:15:00'));
  });
  it('a message before opening counts from 08:00 (Monday 06:30 VN = Sunday 23:30 UTC)', () => {
    expect(addWorkingMinutes(Date.parse('2026-10-04T23:30:00Z'), 15, cal)).toBe(vn('2026-10-05T08:15:00'));
  });
  it('lunch break pauses the clock', () => {
    expect(addWorkingMinutes(vn('2026-10-05T11:50:00'), 15, cal)).toBe(vn('2026-10-05T13:35:00'));
  });
  it('rolls over the end of the day and the weekend (Friday 17:20 -> Saturday 08:05)', () => {
    expect(addWorkingMinutes(vn('2026-10-09T17:20:00'), 15, cal)).toBe(vn('2026-10-10T08:05:00'));
    // Saturday 11:55 + 15 min: Saturday has only the morning, Sunday off -> Monday 08:10.
    expect(addWorkingMinutes(vn('2026-10-10T11:55:00'), 15, cal)).toBe(vn('2026-10-12T08:10:00'));
  });
  it('skips holidays', () => {
    const holiday = { ...cal, holidays: ['2026-10-06'] };
    expect(addWorkingMinutes(vn('2026-10-05T17:25:00'), 15, holiday)).toBe(vn('2026-10-07T08:10:00'));
  });
  it('counts working minutes only', () => {
    expect(workingMinutesBetween(vn('2026-10-05T11:00:00'), vn('2026-10-05T14:00:00'), cal)).toBe(60 + 30);
    expect(workingMinutesBetween(vn('2026-10-04T10:00:00'), vn('2026-10-05T08:30:00'), cal)).toBe(30);
    expect(isWorkingTime(vn('2026-10-05T12:30:00'), cal)).toBe(false);
  });
});

describe('slaChip (UAT-SZ-87: SLA 15 minutes, 24/7 calendar)', () => {
  const day: DayWindowsFor = { '0': [['00:00', '24:00']], '1': [['00:00', '24:00']], '2': [['00:00', '24:00']], '3': [['00:00', '24:00']], '4': [['00:00', '24:00']], '5': [['00:00', '24:00']], '6': [['00:00', '24:00']] };
  type DayWindowsFor = Record<string, [string, string][]>;
  const config = { ...DEFAULT_SLA_CONFIG, calendar: { weekdays: day, holidays: [] } };
  const now = vn('2026-10-05T10:00:00');
  const chip = (waitedMin: number) => slaChip({ dueAtMs: addWorkingMinutes(now - waitedMin * 60_000, 15, config.calendar), config, nowMs: now });

  it('waited 5 min: no chip text', () => {
    expect(chip(5)).toMatchObject({ level: 'ok' });
    expect(chip(5)!.text).toBeUndefined();
  });
  it('waited 12 min: warn "⏰ 3′"', () => {
    expect(chip(12)).toMatchObject({ level: 'warn', text: '⏰ 3′' });
  });
  it('waited 20 min: "Quá 5′"', () => {
    expect(chip(20)).toMatchObject({ level: 'over', text: 'Quá 5′', overMin: 5 });
  });
  it('long overdue shows hours and days', () => {
    expect(slaChip({ dueAtMs: now - 3 * 3600_000, config, nowMs: now })!.text).toBe('Quá 3g');
    expect(slaChip({ dueAtMs: now - 2 * 24 * 3600_000, config, nowMs: now })!.text).toBe('Quá 2n');
  });
  it('outside working hours the clock is paused and shows no list text', () => {
    const night = vn('2026-10-05T22:00:00');
    const c = slaChip({ dueAtMs: vn('2026-10-06T08:10:00'), config: DEFAULT_SLA_CONFIG, nowMs: night })!;
    expect(c.level).toBe('paused');
    expect(c.text).toBeUndefined();
    expect(c.resumeAt).toBe(new Date(vn('2026-10-06T08:00:00')).toISOString());
  });
  it('nothing waits: no chip', () => {
    expect(slaChip({ dueAtMs: null, config, nowMs: now })).toBeNull();
  });
});
