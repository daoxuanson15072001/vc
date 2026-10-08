import dayjs from 'dayjs';
import { TZ } from './time';

/*
 * Period and number helpers of the Báo cáo page (docs 07 MH-BC-01 #6, BC-13, §3.6). Pure code.
 * The figures come from a daily job that closes a day after 01:00, so a period never reaches today.
 */

export type PeriodKey = 'prev_workday' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  prev_workday: 'Ngày làm việc trước',
  yesterday: 'Hôm qua',
  this_week: 'Tuần này',
  last_week: 'Tuần trước',
  this_month: 'Tháng này',
  last_month: 'Tháng trước',
  custom: 'Tùy chọn',
};

const FMT = 'YYYY-MM-DD';
const today = (now: Date) => dayjs(now).tz(TZ).startOf('day');

/** Monday of the week of `d` (dayjs weeks start on Sunday). */
const monday = (d: dayjs.Dayjs) => d.subtract((d.day() + 6) % 7, 'day');

/** Range (yyyy-mm-dd) of a quick period, never later than yesterday. "Ngày làm việc trước" skips Sundays. */
export function rangeOf(key: Exclude<PeriodKey, 'custom'>, now: Date = new Date()): { from: string; to: string } {
  const t = today(now);
  const yesterday = t.subtract(1, 'day');
  let from = yesterday;
  let to = yesterday;
  if (key === 'prev_workday') {
    let d = yesterday;
    if (d.day() === 0) d = d.subtract(1, 'day');
    from = d;
    to = d;
  } else if (key === 'this_week') {
    from = monday(t);
  } else if (key === 'last_week') {
    from = monday(t).subtract(7, 'day');
    to = from.add(6, 'day');
  } else if (key === 'this_month') {
    from = t.startOf('month');
  } else if (key === 'last_month') {
    from = t.subtract(1, 'month').startOf('month');
    to = t.subtract(1, 'month').endOf('month').startOf('day');
  }
  if (to.isAfter(yesterday)) to = yesterday;
  if (from.isAfter(to)) from = to;
  return { from: from.format(FMT), to: to.format(FMT) };
}

/** Default period per what the viewer sees (MH-BC-01 #6). */
export function defaultPeriod(mode: 'self' | 'nvkd' | 'team' | undefined): Exclude<PeriodKey, 'custom'> {
  if (mode === 'nvkd') return 'prev_workday';
  if (mode === 'team') return 'this_month';
  return 'this_week';
}

/** Which quick period matches a range, or "custom". */
export function periodOf(from: string, to: string, now: Date = new Date()): PeriodKey {
  for (const k of Object.keys(PERIOD_LABELS) as PeriodKey[]) {
    if (k === 'custom') continue;
    const r = rangeOf(k, now);
    if (r.from === from && r.to === to) return k;
  }
  return 'custom';
}

/** Minutes as "12′" or "1g 05′" (§3.6); null shows a dash. */
export function fmtMin(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–';
  const r = Math.round(n);
  if (r < 60) return `${r}′`;
  return `${Math.floor(r / 60)}g ${String(r % 60).padStart(2, '0')}′`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–';
  return `${n.toFixed(1).replace('.', ',')}%`;
}

export type DeltaTone = 'good' | 'bad' | 'neutral';
export interface Delta {
  text: string;
  tone: DeltaTone;
}

/**
 * Change against the previous period (BC-13): arrow by sign, colour by the good direction of the figure, not by
 * up or down. `unit` "min" prints minutes, "pct" prints percentage points, "n" prints a count.
 */
export function delta(cur: number | null, prev: number | null | undefined, good: 'low' | 'high' | 'none', unit: 'n' | 'min' | 'pct'): Delta | null {
  if (cur === null || prev === null || prev === undefined) return null;
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return { text: '= kỳ trước', tone: 'neutral' };
  const mag = Math.abs(d);
  const num = unit === 'min' ? fmtMin(mag) : unit === 'pct' ? `${String(mag).replace('.', ',')} điểm` : String(mag).replace('.', ',');
  const up = d > 0;
  const tone: DeltaTone = good === 'none' ? 'neutral' : (good === 'low') === !up ? 'good' : 'bad';
  return { text: `${up ? '▲' : '▼'} ${num}`, tone };
}
