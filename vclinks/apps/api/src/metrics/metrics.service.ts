import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  KPI_MAX_DAYS,
  buildTurns,
  dayStats,
  summarize,
  type KpiDay,
  type KpiLoginDay,
  type KpiQuery,
  type KpiReport,
  type KpiReportRow,
  type Turn,
  type TurnMessage,
  workingMinutesBetween,
} from '@vclinks/shared';
import { channelOfUid } from '@vclinks/shared';
import { slaConfigFor, divisionOfAccount, ownSenders } from '../conversations/inbox-state';
import { C, DbService } from '../db/db.service';
import { currentTenant, runAsTenant } from '../db/tenant-context';
import { EventsService } from '../events/events.service';

/*
 * Baseline KPI job (M1b-15). For every VN day and every account it derives the reply turns straight from `messages`
 * (so old conversations need no backfill and a re-run never duplicates: one upserted document per account and day),
 * and stores counts and waiting minutes in `kpi_daily`. No message text and no phone number is ever stored here (§12).
 * Login share comes from `audit_log` (indexed by `at`, one day at a time), kept per day in `kpi_org_daily`.
 */
export const KPI_DAILY = 'kpi_daily';
export const KPI_ORG_DAILY = 'kpi_org_daily';
export const KPI_RUNS = 'kpi_runs';

const DAY_MS = 24 * 3600_000;
const VN_OFFSET_MS = 7 * 3600_000;
const THREAD_CHUNK = 200;
const TICK_MS = 10 * 60_000;
/** Days recomputed by the daily job: yesterday plus two earlier days, so late syncs (BC-24) are picked up. */
const JOB_DAYS = 3;

export const vnDay = (ms: number) => new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
export const dayStartMs = (day: string) => Date.parse(`${day}T00:00:00+07:00`);
const addDays = (day: string, n: number) => vnDay(dayStartMs(day) + n * DAY_MS + 12 * 3600_000);

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: DbService,
    private readonly events: EventsService,
  ) {}

  onModuleInit() {
    // The daily job does not run inside test suites (they call run() directly) nor when KPI_JOB=off.
    if (process.env.NODE_ENV === 'test' || process.env.KPI_JOB === 'off') return;
    this.timer = setInterval(() => void this.tick().catch((e) => this.logger.error(`kpi tick: ${(e as Error).message}`)), TICK_MS);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** After 01:00 VN, once per VN day and tenant: recompute the last days. */
  private async tick() {
    const now = Date.now();
    if (new Date(now + VN_OFFSET_MS).getUTCHours() < 1) return;
    const today = vnDay(now);
    for (const tenant of await this.db.tenants()) {
      await runAsTenant(tenant, async () => {
        if (await this.db.col(KPI_RUNS).findOne({ _id: `${tenant}:${today}` as never })) return;
        const to = addDays(today, -1);
        await this.run(addDays(to, -(JOB_DAYS - 1)), to, now);
        await this.db.col(KPI_RUNS).updateOne({ _id: `${tenant}:${today}` as never }, { $set: { at: new Date() } }, { upsert: true });
      });
    }
  }

  /** Computes (or recomputes) every day of [from, to] for the current tenant. Idempotent. */
  async run(from: string, to: string, nowMs = Date.now()) {
    const days = this.daysBetween(from, to);
    const accounts = await this.db.col<{ _id: string; channel?: string }>(C.accounts).find({}, { projection: { _id: 1, channel: 1 } }).toArray();
    let turns = 0;
    for (const day of days) {
      for (const a of accounts) turns += await this.computeAccountDay(a._id, a.channel ?? channelOfUid(a._id), day, nowMs);
      await this.computeLogin(day);
    }
    await this.events.append({ type: 'kpi.computed', subject: { kind: 'kpi', id: `${from}..${to}` }, actor: 'he-thong', data: { days: days.length, accounts: accounts.length, turns } });
    return { days: days.length, accounts: accounts.length, turns };
  }

  private daysBetween(from: string, to: string): string[] {
    const out: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    if (!out.length || out.length > KPI_MAX_DAYS) throw new BadRequestException(`Khoảng ngày không hợp lệ (1 đến ${KPI_MAX_DAYS} ngày)`);
    return out;
  }

  /** Reply turns that start on `day` for one account, with their thread (1-1 threads only). */
  private async collectTurns(uid: string, day: string): Promise<(Turn & { threadId: string })[]> {
    const s = dayStartMs(day);
    const e = s + DAY_MS;
    const own = new Set(ownSenders(uid));
    const real = { 'systemEvent.act': { $exists: false } };
    const active = await this.db
      .col(C.messages)
      .aggregate<{ _id: string }>([{ $match: { uid, sentAt: { $gte: new Date(s), $lt: new Date(e) }, ...real } }, { $group: { _id: '$threadId' } }])
      .toArray();
    const types = new Map(
      (await this.db.col(C.conversations).find({ uid }, { projection: { threadId: 1, type: 1 } }).toArray()).map((c) => [c.threadId as string, c.type as string]),
    );
    // Groups wait for QĐ-50 (as in the inbox): only 1-1 threads make turns.
    const threads = active.map((t) => t._id).filter((t) => types.get(t) !== 'group');
    const turns: (Turn & { threadId: string })[] = [];
    const proj = { projection: { fromUid: 1, sentAt: 1, cliMsgId: 1 } };
    for (let i = 0; i < threads.length; i += THREAD_CHUNK) {
      for (const threadId of threads.slice(i, i + THREAD_CHUNK)) {
        const [before, within] = await Promise.all([
          this.db.col(C.messages).find({ uid, threadId, sentAt: { $lt: new Date(s) }, ...real }, proj).sort({ sentAt: -1 }).limit(1).toArray(),
          this.db.col(C.messages).find({ uid, threadId, sentAt: { $gte: new Date(s) }, ...real }, proj).sort({ sentAt: 1 }).toArray(),
        ]);
        const msgs: TurnMessage[] = [...before, ...within].map((m) => ({
          at: (m.sentAt as Date).getTime(),
          own: own.has(String(m.fromUid)),
          ...(m.cliMsgId ? { cliMsgId: String(m.cliMsgId) } : {}),
        }));
        turns.push(...buildTurns(msgs, s, e).map((t) => ({ ...t, threadId })));
      }
    }
    return turns;
  }

  /** cliMsgIds (of `replyIds`) that were sent from VClinks (a sent suggestion / outbox item). */
  private async sentFromVclinks(uid: string, replyIds: string[]): Promise<Set<string>> {
    const sent = new Set<string>();
    for (let i = 0; i < replyIds.length; i += 1000) {
      const rows = await this.db.col(C.suggestions).find({ uid, status: 'sent', cliMsgId: { $in: replyIds.slice(i, i + 1000) } }, { projection: { cliMsgId: 1 } }).toArray();
      for (const r of rows) sent.add(String(r.cliMsgId));
    }
    return sent;
  }

  /**
   * One account-day turn by turn (Drawer "Lượt chờ", detail sheet of the export): waiting minutes, SLA verdict and
   * whether the reply came from VClinks. Same rules as the stored numbers. No message text.
   */
  async turnDetails(uid: string, day: string, nowMs = Date.now()) {
    const turns = await this.collectTurns(uid, day);
    const sent = await this.sentFromVclinks(uid, turns.map((t) => t.endCliMsgId).filter((x): x is string => !!x));
    const cfg = await slaConfigFor(this.db, await divisionOfAccount(this.db, uid));
    return turns.map((t) => {
      const waitMin = workingMinutesBetween(t.startAt, t.endAt ?? nowMs, cfg.calendar);
      return {
        threadId: t.threadId,
        startAt: t.startAt,
        endAt: t.endAt,
        waitMin: Math.round(waitMin * 10) / 10,
        slaMin: cfg.slaMinutes,
        breached: waitMin > cfg.slaMinutes,
        source: t.endAt === null ? null : t.endCliMsgId && sent.has(t.endCliMsgId) ? ('vclinks' as const) : ('phone' as const),
      };
    });
  }

  private async computeAccountDay(uid: string, channel: string, day: string, nowMs: number): Promise<number> {
    const turns = await this.collectTurns(uid, day);
    const sent = await this.sentFromVclinks(uid, turns.map((t) => t.endCliMsgId).filter((x): x is string => !!x));
    const cfg = await slaConfigFor(this.db, await divisionOfAccount(this.db, uid));
    const stats = dayStats(turns, { nowMs, calendar: cfg.calendar, slaMinutes: cfg.slaMinutes, sentFromVclinks: sent });
    const doc: KpiDay = { uid, day, channel, ...stats, computedAt: new Date() };
    await this.db.col<KpiDay & { _id: string }>(KPI_DAILY).updateOne({ _id: `${uid}:${day}` }, { $set: doc }, { upsert: true });
    return turns.length;
  }

  private async computeLogin(day: string) {
    const s = dayStartMs(day);
    const rows = await this.db
      .col(C.auditLog)
      .aggregate<{ _id: string }>([{ $match: { action: 'login', at: { $gte: new Date(s), $lt: new Date(s + DAY_MS) } } }, { $group: { _id: '$actor' } }])
      .toArray();
    const loggedIn = rows.filter((r) => r._id && r._id !== 'system').length;
    const active = await this.db.col(C.users).countDocuments({ status: 'hoat_dong' });
    const doc: KpiLoginDay & { computedAt: Date } = { day, loggedIn, active, computedAt: new Date() };
    await this.db.col(KPI_ORG_DAILY).updateOne({ _id: `${currentTenant()}:${day}` as never }, { $set: doc }, { upsert: true });
  }

  /** Report over stored days. The data scope of the request already limits `kpi_daily` to the caller's channels. */
  async report(q: KpiQuery, opts: { includeLogin: boolean }): Promise<KpiReport> {
    const to = q.to ?? addDays(vnDay(Date.now()), -1);
    const from = q.from ?? addDays(to, -29);
    this.daysBetween(from, to);
    const docs = await this.db.col<KpiDay>(KPI_DAILY).find({ day: { $gte: from, $lte: to } }).toArray();
    const labels = new Map(
      (await this.db.col<{ _id: string; label?: string }>(C.accounts).find({}, { projection: { label: 1 } }).toArray()).map((a) => [a._id, a.label ?? '']),
    );
    const groupKey = (d: KpiDay) => (q.by === 'day' ? d.day : q.by === 'account' ? d.uid : `${d.day}|${d.uid}`);
    const groups = new Map<string, KpiDay[]>();
    for (const d of docs) groups.set(groupKey(d), [...(groups.get(groupKey(d)) ?? []), d]);
    const rows: KpiReportRow[] = [...groups.entries()]
      .map(([, g]) => {
        const f = g[0]!;
        const row: KpiReportRow = { ...summarize(g) };
        if (q.by !== 'account') row.day = f.day;
        if (q.by !== 'day') Object.assign(row, { uid: f.uid, label: labels.get(f.uid) ?? '', channel: f.channel });
        return row;
      })
      .sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || (a.label ?? '').localeCompare(b.label ?? ''));
    let login: KpiReport['login'] = null;
    if (opts.includeLogin) {
      const ld = await this.db.col<KpiLoginDay>(KPI_ORG_DAILY).find({ day: { $gte: from, $lte: to } }, { projection: { _id: 0, day: 1, loggedIn: 1, active: 1 } }).sort({ day: 1 }).toArray();
      const days = ld.map((d) => ({ day: d.day, loggedIn: d.loggedIn, active: d.active }));
      const sumIn = days.reduce((n, d) => n + d.loggedIn, 0);
      const sumAct = days.reduce((n, d) => n + d.active, 0);
      login = { days, pctLoggedIn: sumAct ? Math.round((sumIn / sumAct) * 1000) / 10 : null };
    }
    return { from, to, by: q.by, rows, totals: summarize(docs), login };
  }
}
