import { z } from 'zod';
import { workingMinutesBetween, type WorkCalendar } from './inbox';

/*
 * Baseline KPI (M1b-15): reply turns ("lượt chờ", docs 07 BC-03/BC-24), their per-day statistics and the
 * roll-up used by the API and the CSV export. Pure code, no I/O. Counts and minutes only: never message text.
 */

/** Waiting longer than this many working minutes counts as "tin quá 2 giờ" (docs 07 §3). */
export const KPI_LONG_WAIT_MIN = 120;
/** Fixed threshold of G1 / KPI-27: the same 15 minutes for every channel and division. */
export const KPI_G1_MIN = 15;

/** One message of a 1-1 thread as the turn builder needs it (system events already left out). */
export interface TurnMessage {
  at: number;
  /** Sent by the account itself (fromUid 0 / -1 / own uid). */
  own: boolean;
  cliMsgId?: string;
}

export interface Turn {
  startAt: number;
  endAt: number | null;
  /** cliMsgId of the replying message, to tell "from VClinks" from "from the phone". */
  endCliMsgId?: string;
}

/**
 * Reply turns of one thread that START inside [fromMs, toMs). A turn starts at the first customer message after
 * the account's last message and ends at the account's next message (the real send time, BC-24). `messages`
 * must include one message before `fromMs` (when there is one) so a turn already open at `fromMs` is not
 * mistaken for a new one; it is sorted here.
 */
export function buildTurns(messages: TurnMessage[], fromMs: number, toMs: number): Turn[] {
  const sorted = [...messages].sort((a, b) => a.at - b.at);
  const turns: Turn[] = [];
  let open: Turn | null = null;
  for (const m of sorted) {
    if (m.own) {
      if (open) {
        open.endAt = m.at;
        if (m.cliMsgId) open.endCliMsgId = m.cliMsgId;
        open = null;
      }
    } else if (!open) {
      open = { startAt: m.at, endAt: null };
      if (m.at >= fromMs && m.at < toMs) turns.push(open);
    }
  }
  return turns;
}

/** Stored per account and VN day (`kpi_daily`, `_id` = `${uid}:${day}`). */
export interface KpiDay {
  uid: string;
  day: string;
  channel: string;
  turns: number;
  answered: number;
  /** Still waiting when the day was computed. */
  open: number;
  /** Working minutes waited by each answered turn (rounded to 0.1). */
  waits: number[];
  /** Answered turns and open turns past their SLA. */
  breached: number;
  /** Turns (answered or open) that waited more than KPI_G1_MIN. */
  over15: number;
  /** Turns that waited more than KPI_LONG_WAIT_MIN. */
  over120: number;
  /** Answered turns whose reply was sent from VClinks (outbox) and from elsewhere (the phone app). */
  viaVclinks: number;
  fromPhone: number;
  slaMinutes: number;
  computedAt: Date;
}

export type KpiCounts = Pick<KpiDay, 'turns' | 'answered' | 'open' | 'breached' | 'over15' | 'over120' | 'viaVclinks' | 'fromPhone'>;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Statistics of one thread set for one day. `sentFromVclinks` = cliMsgIds of outbox items already sent. */
export function dayStats(
  turns: Turn[],
  opts: { nowMs: number; calendar: WorkCalendar; slaMinutes: number; sentFromVclinks: ReadonlySet<string> },
): Omit<KpiDay, 'uid' | 'day' | 'channel' | 'computedAt'> {
  const out = { turns: turns.length, answered: 0, open: 0, waits: [] as number[], breached: 0, over15: 0, over120: 0, viaVclinks: 0, fromPhone: 0, slaMinutes: opts.slaMinutes };
  for (const t of turns) {
    const wait = workingMinutesBetween(t.startAt, t.endAt ?? opts.nowMs, opts.calendar);
    if (t.endAt === null) out.open++;
    else {
      out.answered++;
      out.waits.push(r1(wait));
      if (t.endCliMsgId && opts.sentFromVclinks.has(t.endCliMsgId)) out.viaVclinks++;
      else out.fromPhone++;
    }
    if (wait > opts.slaMinutes) out.breached++;
    if (wait > KPI_G1_MIN) out.over15++;
    if (wait > KPI_LONG_WAIT_MIN) out.over120++;
  }
  return out;
}

/** Percentile (nearest rank) of a list; null when empty. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] ?? null;
}

export interface KpiSummary extends KpiCounts {
  frtMedian: number | null;
  frtP90: number | null;
  /** Shares in percent (one decimal), null when the denominator is 0. */
  pctBreached: number | null;
  pctOver15: number | null;
  pctOver120: number | null;
  pctViaVclinks: number | null;
}

const pct = (a: number, b: number) => (b > 0 ? r1((a / b) * 100) : null);

/** Rolls rows up: counts add up, FRT is the median / P90 of every answered turn (not an average of days). */
export function summarize(rows: Pick<KpiDay, keyof KpiCounts | 'waits'>[]): KpiSummary {
  const s: KpiCounts = { turns: 0, answered: 0, open: 0, breached: 0, over15: 0, over120: 0, viaVclinks: 0, fromPhone: 0 };
  const waits: number[] = [];
  for (const r of rows) {
    for (const k of Object.keys(s) as (keyof KpiCounts)[]) s[k] += r[k];
    waits.push(...r.waits);
  }
  return {
    ...s,
    frtMedian: percentile(waits, 50),
    frtP90: percentile(waits, 90),
    pctBreached: pct(s.breached, s.turns),
    pctOver15: pct(s.over15, s.turns),
    pctOver120: pct(s.over120, s.turns),
    pctViaVclinks: pct(s.viaVclinks, s.answered),
  };
}

/** People who signed in on a day over the people who could (docs 07 §3 "% đăng nhập"). Whole tenant, not per nick. */
export interface KpiLoginDay {
  day: string;
  loggedIn: number;
  active: number;
}

export const KPI_DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayField = z.string().regex(KPI_DAY, 'Ngày dạng yyyy-mm-dd');

export const kpiQuerySchema = z.object({
  from: dayField.optional(),
  to: dayField.optional(),
  /** Aggregate per day, per account, or both (CSV). */
  by: z.enum(['day', 'account', 'day_account']).default('day'),
});
export type KpiQuery = z.infer<typeof kpiQuerySchema>;

/** Longest range one request may read. */
export const KPI_MAX_DAYS = 120;

export interface KpiReportRow extends KpiSummary {
  day?: string;
  uid?: string;
  label?: string;
  channel?: string;
}

export interface KpiReport {
  from: string;
  to: string;
  by: KpiQuery['by'];
  rows: KpiReportRow[];
  totals: KpiSummary;
  /** Only for callers whose scope is the whole company; null otherwise. */
  login: { days: KpiLoginDay[]; pctLoggedIn: number | null } | null;
}
