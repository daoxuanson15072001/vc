import { describe, expect, it } from 'vitest';
import { defaultPeriod, delta, fmtMin, fmtPct, periodOf, rangeOf } from './report';

// Wednesday 07/10/2026, 10:00 Vietnam time.
const WED = new Date('2026-10-07T03:00:00Z');
// Monday 12/10/2026, 08:00 Vietnam time.
const MON = new Date('2026-10-12T01:00:00Z');

describe('report periods (07 MH-BC-01 #6)', () => {
  it('never reaches today: the daily job closes a day after 01:00', () => {
    expect(rangeOf('yesterday', WED)).toEqual({ from: '2026-10-06', to: '2026-10-06' });
    expect(rangeOf('this_week', WED)).toEqual({ from: '2026-10-05', to: '2026-10-06' });
    expect(rangeOf('this_month', WED)).toEqual({ from: '2026-10-01', to: '2026-10-06' });
  });
  it('Monday morning: the previous working day is Saturday, this week has no closed day yet', () => {
    expect(rangeOf('prev_workday', MON)).toEqual({ from: '2026-10-10', to: '2026-10-10' });
    expect(rangeOf('this_week', MON)).toEqual({ from: '2026-10-11', to: '2026-10-11' });
    expect(rangeOf('last_week', MON)).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });
  it('last month is the whole calendar month', () => {
    expect(rangeOf('last_month', WED)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
  it('recognises a quick period and falls back to custom', () => {
    expect(periodOf('2026-09-01', '2026-09-30', WED)).toBe('last_month');
    expect(periodOf('2026-09-02', '2026-09-30', WED)).toBe('custom');
  });
  it('default period follows what the viewer sees', () => {
    expect(defaultPeriod('self')).toBe('this_week');
    expect(defaultPeriod('nvkd')).toBe('prev_workday');
    expect(defaultPeriod('team')).toBe('this_month');
  });
});

describe('report numbers (07 §3.6, BC-13)', () => {
  it('formats minutes and shares', () => {
    expect(fmtMin(12)).toBe('12′');
    expect(fmtMin(65)).toBe('1g 05′');
    expect(fmtMin(null)).toBe('–');
    expect(fmtPct(42.857)).toBe('42,9%');
  });
  it('colours the delta by the good direction, not by up or down', () => {
    expect(delta(12, 20, 'low', 'min')).toEqual({ text: '▼ 8′', tone: 'good' });
    expect(delta(40, 50, 'low', 'pct')).toEqual({ text: '▼ 10 điểm', tone: 'good' });
    expect(delta(5, 2, 'none', 'n')).toEqual({ text: '▲ 3', tone: 'neutral' });
    expect(delta(60, 50, 'low', 'pct')?.tone).toBe('bad');
    expect(delta(5, null, 'none', 'n')).toBeNull();
  });
});
