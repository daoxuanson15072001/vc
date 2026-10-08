import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('vi');

export const TZ = 'Asia/Ho_Chi_Minh';

type TimeInput = string | number | Date;

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function vn(v: TimeInput) {
  return dayjs(v).tz(TZ);
}

/** Calendar day key (YYYY-MM-DD) in Vietnam time, used to split messages by day. */
export function dayKey(v: TimeInput): string {
  return vn(v).format('YYYY-MM-DD');
}

/** Whole calendar days between `v` and `now` in Vietnam time (0 = same day, 1 = yesterday). */
function daysAgo(v: TimeInput, now: TimeInput): number {
  const a = dayjs.tz(dayKey(v), TZ);
  const b = dayjs.tz(dayKey(now), TZ);
  return Math.round(b.diff(a, 'day', true));
}

/**
 * Zalo-style relative time for the conversation list:
 * "vừa xong", "5 phút", "3 giờ", "Hôm qua", "dd/mm", or "dd/mm/yy" for other years.
 */
export function relativeListTime(v: TimeInput | null | undefined, now: TimeInput = Date.now()): string {
  if (v === null || v === undefined || v === '') return '';
  const d = dayjs(v);
  if (!d.isValid()) return '';
  const diffMin = Math.floor(dayjs(now).diff(d, 'minute', true));
  if (diffMin < 1) return 'vừa xong';
  if (diffMin < 60) return `${diffMin} phút`;
  const days = daysAgo(v, now);
  if (days === 0) return `${Math.floor(diffMin / 60)} giờ`;
  if (days === 1) return 'Hôm qua';
  const local = vn(v);
  return local.year() === vn(now).year() ? local.format('DD/MM') : local.format('DD/MM/YY');
}

/** Day separator label: "Hôm nay", "Hôm qua", or "Thứ Hai, 22/09/2026". */
export function daySeparatorLabel(v: TimeInput, now: TimeInput = Date.now()): string {
  const days = daysAgo(v, now);
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  const local = vn(v);
  return `${WEEKDAYS[local.day()]}, ${local.format('DD/MM/YYYY')}`;
}

/** Short clock time shown inside a bubble. */
export function bubbleTime(v: TimeInput): string {
  const d = dayjs(v);
  return d.isValid() ? vn(v).format('HH:mm') : '';
}

/** Full timestamp for tooltips. */
export function fullTime(v: TimeInput): string {
  const d = dayjs(v);
  return d.isValid() ? vn(v).format('HH:mm DD/MM/YYYY') : '';
}

/** Seconds → "m:ss" (or "h:mm:ss"). */
export function fmtDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec < 0) return '';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export { dayjs };
