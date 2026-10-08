/** Asia/Ho_Chi_Minh is UTC+7 all year (no daylight saving): plain arithmetic is enough. */
const VN_OFFSET_MS = 7 * 3600 * 1000;

export function vnParts(d: Date): { hour: number; weekday: number; day: string } {
  const v = new Date(d.getTime() + VN_OFFSET_MS);
  return { hour: v.getUTCHours(), weekday: v.getUTCDay(), day: v.toISOString().slice(0, 10) };
}

/** 22:00–06:00 or Sunday (rule R5, PQ-46). */
export function isOffHours(d: Date): boolean {
  const { hour, weekday } = vnParts(d);
  return hour >= 22 || hour < 6 || weekday === 0;
}

/** dd/MM/yyyy in Vietnam time. */
export function vnDate(d: Date): string {
  const p = new Date(d.getTime() + VN_OFFSET_MS);
  const dd = String(p.getUTCDate()).padStart(2, '0');
  const mm = String(p.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${p.getUTCFullYear()}`;
}
