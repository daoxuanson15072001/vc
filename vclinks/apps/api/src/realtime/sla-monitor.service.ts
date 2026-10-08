import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { isWorkingTime } from '@vclinks/shared';
import { AuthzService } from '../authz/authz.service';
import { divisionOfAccount, slaConfigFor } from '../conversations/inbox-state';
import { C, DbService } from '../db/db.service';
import { runsBackgroundJobs } from '../db/role';
import { runAsTenant } from '../db/tenant-context';
import { NotificationsService } from '../notifications/notifications.service';

const SWEEP_MS = () => Number(process.env.SLA_MONITOR_MS ?? 60_000);
const BATCH = 500;
const DAY = 86_400_000;
/** Waits whose deadline passed longer ago than this are not announced (Q14): no flood of old conversations the first time the watch runs. 0 = no limit. */
const BACKLOG_DAYS = () => Number(process.env.SLA_BACKLOG_DAYS ?? 3);

interface ConvDoc {
  _id: string;
  uid: string;
  threadId: string;
  unansweredSince: Date;
  slaDueAt: Date;
  slaMinutes?: number;
  assigneeId?: string | null;
}

/**
 * SLA watch (M1c-07, BA F4.3, story GS-01). A conversation whose customer has waited longer than the SLA
 * (`slaDueAt`, already counted in working minutes of the division calendar) notifies the supervisor of the
 * person who owns it: the nick holder, or the assignee on an official channel. Notified once per wait
 * (`slaNotifiedSince`), and only while the division is inside working hours: a wait that crossed the
 * deadline after hours is announced when the next working window opens. Titles carry no message text.
 * Only waits whose deadline passed in the last `SLA_BACKLOG_DAYS` (default 3) are announced: the first sweep never
 * floods supervisors with conversations that went cold long ago (Q14, M1b-17).
 */
@Injectable()
export class SlaMonitorService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SlaMonitorService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly enabled = process.env.SLA_MONITOR !== 'off' && runsBackgroundJobs();

  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.sweep(), SWEEP_MS());
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass over every tenant. Returns how many notices went out. */
  async sweep(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      let sent = 0;
      for (const t of await this.db.tenants()) sent += await runAsTenant(t, () => this.sweepTenant(now));
      return sent;
    } catch (err) {
      this.logger.warn(`Quét SLA lỗi: ${(err as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async sweepTenant(now: Date): Promise<number> {
    // A cursor, not a fixed first page: waits that cannot be announced now (closed division, nobody to tell)
    // must not hide the others behind them. At most BATCH notices go out per sweep.
    const backlog = BACKLOG_DAYS();
    const due = this.db
      .col<ConvDoc>(C.conversations)
      .find({
        unansweredSince: { $ne: null },
        slaDueAt: { $lte: now, ...(backlog > 0 ? { $gte: new Date(now.getTime() - backlog * DAY) } : {}) },
        $expr: { $ne: ['$slaNotifiedSince', '$unansweredSince'] },
      } as never)
      .sort({ slaDueAt: 1 });
    let sent = 0;
    for await (const c of due) {
      if (sent >= BATCH) break;
      const cfg = await slaConfigFor(this.db, await divisionOfAccount(this.db, c.uid));
      // Outside working hours nothing is announced; the wait stays "due" and is picked up at the next opening.
      if (!isWorkingTime(now.getTime(), cfg.calendar)) continue;
      const owner = (await this.authz.holderOf(c.uid)) ?? c.assigneeId ?? null;
      const supervisor = owner ? await this.authz.supervisorOf(owner) : null;
      const to = supervisor ?? (await this.authz.managersOver(c.uid))[0] ?? null;
      if (!to) continue;
      const minutes = c.slaMinutes ?? cfg.slaMinutes;
      await this.notifications.notify([to], 'sla_breach', `Có hội thoại quá ${minutes} phút chưa trả lời`, `/conversations/${encodeURIComponent(c._id)}`);
      await this.db.col<ConvDoc>(C.conversations).updateOne({ _id: c._id }, { $set: { slaNotifiedSince: c.unansweredSince, slaNotifiedAt: now } } as never);
      sent++;
    }
    return sent;
  }
}
