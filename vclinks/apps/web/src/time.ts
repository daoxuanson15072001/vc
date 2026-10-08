import { dayjs, TZ } from './utils/time';

export { TZ, dayjs };

/** Formats an ISO string or epoch ms in Vietnam time; '—' for empty values. */
export function fmtTime(v: string | number | null | undefined, fmt = 'DD/MM/YYYY HH:mm'): string {
  if (v === null || v === undefined || v === '') return '—';
  const d = dayjs(v);
  return d.isValid() ? d.tz(TZ).format(fmt) : String(v);
}
