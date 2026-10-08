/**
 * Parses Messenger's time separator labels ("10:32", "Hôm qua lúc 10:32",
 * "T2 10:32", "12 Tháng 9, 2026 lúc 10:32", "Yesterday at 10:32 AM",
 * "Mon 10:32 AM", "Sep 12, 2026, 10:32 AM"…) into an absolute epoch-ms minute.
 *
 * Relative labels are resolved against `now` in the browser's local time zone,
 * the same zone Messenger used to render them, so "Hôm nay 10:32" read today and
 * "Hôm qua 10:32" read tomorrow resolve to the same instant — which keeps the
 * derived message ids stable across days (ids.ts). Returns null when the label
 * is not a date/time.
 *
 * FORMATS ARE UNVERIFIED against the live page (docs/04-ky-thuat/kenh/facebook-personal.md §6).
 */

const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Whole-word, case-insensitive, Unicode-aware (`\b` does not work around Vietnamese letters). */
const word = (alts: string) => new RegExp(`(?<![\\p{L}\\d])(?:${alts})(?![\\p{L}\\d])`, 'iu');

/** Weekday tokens → JS getDay() (0 = Sunday). */
const WEEKDAYS: [RegExp, number][] = [
  [word('chủ nhật|cn'), 0],
  [word('thứ hai|thứ 2|t2'), 1],
  [word('thứ ba|thứ 3|t3'), 2],
  [word('thứ tư|thứ 4|t4'), 3],
  [word('thứ năm|thứ 5|t5'), 4],
  [word('thứ sáu|thứ 6|t6'), 5],
  [word('thứ bảy|thứ 7|t7'), 6],
  [word('sun|sunday'), 0],
  [word('mon|monday'), 1],
  [word('tue|tues|tuesday'), 2],
  [word('wed|wednesday'), 3],
  [word('thu|thurs|thursday'), 4],
  [word('fri|friday'), 5],
  [word('sat|saturday'), 6],
];
const YESTERDAY = word('hôm qua|yesterday');
const TODAY = word('hôm nay|today');
const FILLER = new RegExp(`(?<![\\p{L}])(?:lúc|at)(?![\\p{L}])`, 'giu');

interface Hm {
  h: number;
  m: number;
}

function parseClock(s: string): Hm | null {
  const m = /(\d{1,2})[:h](\d{2})\s*(am|pm|sa|ch)?\b/i.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' || ap === 'ch') h = h % 12 + 12;
  else if (ap === 'am' || ap === 'sa') h = h % 12;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

interface Ymd {
  y: number | null;
  mo: number;
  d: number;
}

function parseDate(s: string): Ymd | null {
  // 12 Tháng 9, 2026 / 12 tháng 9 2026 / 12 thg 9
  let m = /(\d{1,2})\s*(?:tháng|thg)\s*(\d{1,2})(?:[,\s]+(\d{4}))?/i.exec(s);
  if (m) return { d: Number(m[1]), mo: Number(m[2]), y: m[3] ? Number(m[3]) : null };
  // 12/9/2026, 12/09 (Vietnamese order: day first)
  m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/.exec(s);
  if (m) return { d: Number(m[1]), mo: Number(m[2]), y: m[3] ? Number(m[3]) : null };
  // Sep 12, 2026 / September 12 / 12 Sep 2026
  m = /\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i.exec(s);
  if (m && MONTHS_EN.includes(m[1].toLowerCase())) {
    return { mo: MONTHS_EN.indexOf(m[1].toLowerCase()) + 1, d: Number(m[2]), y: m[3] ? Number(m[3]) : null };
  }
  m = /\b(\d{1,2})\s+([a-z]{3})[a-z]*\.?(?:,?\s+(\d{4}))?\b/i.exec(s);
  if (m && MONTHS_EN.includes(m[2].toLowerCase())) {
    return { d: Number(m[1]), mo: MONTHS_EN.indexOf(m[2].toLowerCase()) + 1, y: m[3] ? Number(m[3]) : null };
  }
  return null;
}

const DAY = 86_400_000;
/** A label resolving further than this into the future belongs to the previous day/year. */
const FUTURE_SLACK_MS = 5 * 60_000;

function at(base: Date, hm: Hm | null): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hm?.h ?? 0, hm?.m ?? 0, 0, 0);
  return d;
}

/** Epoch ms (minute precision) of a separator label, or null if it is not one. */
export function parseTimeLabel(raw: string | null | undefined, now: number): number | null {
  const s = (raw ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s.length > 80) return null;
  const clock = parseClock(s);
  const today = new Date(now);

  const date = parseDate(s);
  if (date) {
    if (date.mo < 1 || date.mo > 12 || date.d < 1 || date.d > 31) return null;
    let y = date.y ?? today.getFullYear();
    let d = new Date(y, date.mo - 1, date.d, clock?.h ?? 0, clock?.m ?? 0, 0, 0);
    // No year shown ⇒ within the last 12 months.
    if (date.y == null && d.getTime() > now + FUTURE_SLACK_MS) {
      y -= 1;
      d = new Date(y, date.mo - 1, date.d, clock?.h ?? 0, clock?.m ?? 0, 0, 0);
    }
    return d.getTime();
  }

  if (YESTERDAY.test(s)) {
    return at(new Date(now - DAY), clock).getTime();
  }
  if (TODAY.test(s)) {
    return clock ? at(today, clock).getTime() : null;
  }
  for (const [re, wd] of WEEKDAYS) {
    if (!re.test(s)) continue;
    // Most recent such weekday strictly before today (Messenger shows plain times for today).
    let back = (today.getDay() - wd + 7) % 7;
    if (back === 0) back = 7;
    return at(new Date(now - back * DAY), clock).getTime();
  }
  if (clock) {
    // Time only ⇒ today; a time "in the future" was yesterday (read right after midnight).
    // Only accept labels that are essentially just a time, not free text containing one.
    if (s.replace(/(\d{1,2})[:h](\d{2})\s*(am|pm|sa|ch)?/i, '').replace(FILLER, '').trim().length > 0) {
      return null;
    }
    let t = at(today, clock).getTime();
    if (t > now + FUTURE_SLACK_MS) t -= DAY;
    return t;
  }
  return null;
}
