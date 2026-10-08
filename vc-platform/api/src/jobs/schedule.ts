/** Job schedules in Vietnam time (kế hoạch GĐ B mục 6.1: "00:10", "mỗi giờ phút 7", "mỗi phút"). */
export type Schedule = { everyMinutes: number } | { dailyAt: string } | { hourlyAtMinute: number } | 'manual';

const VN = 7 * 3_600_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function checkSchedule(s: Schedule): void {
  if (s === 'manual') return;
  const n = 'everyMinutes' in s ? s.everyMinutes : 1;
  if (!(Number.isInteger(n) && n > 0 && (60 % n === 0 || n % 60 === 0))) {
    throw new Error(`everyMinutes phải chia hết 60 hoặc là bội của 60: ${n}`);
  }
  if ('dailyAt' in s && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.dailyAt)) throw new Error(`dailyAt phải là HH:MM: ${s.dailyAt}`);
  if ('hourlyAtMinute' in s && !(Number.isInteger(s.hourlyAtMinute) && s.hourlyAtMinute >= 0 && s.hourlyAtMinute < 60)) {
    throw new Error(`hourlyAtMinute phải từ 0 đến 59: ${s.hourlyAtMinute}`);
  }
}

/**
 * The latest occurrence at or before `now`. A job runs once per occurrence; if every process was down at that time,
 * the occurrence runs late as soon as one is up again.
 */
export function lastOccurrence(s: Schedule, now: Date): Date | undefined {
  if (s === 'manual') return undefined;
  const t = now.getTime();
  if ('everyMinutes' in s) {
    // Vietnam is UTC+7 (whole hours), so minute slots line up the same in both clocks.
    const p = s.everyMinutes * 60_000;
    return new Date(Math.floor((t + VN) / p) * p - VN);
  }
  const vn = t + VN;
  if ('hourlyAtMinute' in s) {
    let occ = Math.floor(vn / HOUR) * HOUR + s.hourlyAtMinute * 60_000;
    if (occ > vn) occ -= HOUR;
    return new Date(occ - VN);
  }
  const [h, m] = s.dailyAt.split(':').map(Number);
  let occ = Math.floor(vn / DAY) * DAY + (h * 60 + m) * 60_000;
  if (occ > vn) occ -= DAY;
  return new Date(occ - VN);
}
