/**
 * Dates of VC Home (05; khung chung mục 6): instants are stored as UTC `Date`; effective dates are `YYYY-MM-DD`
 * in Vietnam time. Vietnam has used UTC+7 without daylight saving since 1975, so the offset is a constant.
 */
export const VN_TZ = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written `YYYY-MM-DD`. */
export function isYmd(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = YMD.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Calendar date in Vietnam of an instant. */
export function ymdInVn(at: Date): string {
  return new Date(at.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** 00:00 Vietnam time of an effective date, as a UTC instant (17:00Z of the previous day). */
export function toEffectiveAt(ymd: string): Date {
  if (!isYmd(ymd)) throw new RangeError(`Ngày không hợp lệ: ${ymd}`);
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - VN_OFFSET_MS);
}

export function addDays(ymd: string, days: number): string {
  if (!isYmd(ymd)) throw new RangeError(`Ngày không hợp lệ: ${ymd}`);
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Wall-clock parts in Vietnam (for schedules such as "00:10 every day"). */
export function vnParts(at: Date): { ymd: string; hour: number; minute: number } {
  const v = new Date(at.getTime() + VN_OFFSET_MS);
  return { ymd: v.toISOString().slice(0, 10), hour: v.getUTCHours(), minute: v.getUTCMinutes() };
}

/** `dd/mm/yyyy` for messages (06 mục 1.5). */
export function formatVnDate(ymd: string): string {
  const m = YMD.exec(ymd);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ymd;
}
