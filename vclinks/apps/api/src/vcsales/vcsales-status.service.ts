import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { VcsalesHealthView, VcsalesStaffMatching, VcsalesStatusResponse } from '@vclinks/shared';
import { VcsaleUnavailableError, type VcsaleClient, type VcsaleHealth, type VcsaleStaffMember } from '@vclinks/vcsale-client';
import { VCSALE_CLIENT } from '../customers/customers.service';
import { C, DbService } from '../db/db.service';
import type { UserDoc } from '../users/users.service';
import { emailKey, matchStaff, type MatchUser } from './staff-match';

const MIN = 60_000;
/** Check interval while VCsales answers (VCSALE_PING_MS, default 5 minutes; 0 = no background checks, tests). */
const everyMs = () => Number(process.env.VCSALE_PING_MS ?? 5 * MIN);
/** While VCsales is down it is checked sooner, so screens come back quickly after an outage. */
const DOWN_EVERY_MS = 30_000;
/** The staff list is master data: kept one day (BA §6), "Tải lại" reads it again. */
const STAFF_TTL_MS = 24 * 60 * MIN;
const FIRST_CHECK_MS = 10_000;

type Health = Omit<VcsalesHealthView, 'everyMinutes'>;

/**
 * Connection to VCsales (plan C6) and salesperson matching (C5), for Quản trị → "Kết nối VCsales".
 * Every API process checks VCsales on its own timer (a GET, harmless twice) and keeps the answer in memory.
 * List screens ask `down()` and skip VCsales while it is known down instead of waiting for time-outs; a screen a
 * person opens or refreshes still tries VCsales live.
 */
@Injectable()
export class VcsalesStatusService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('VcsalesStatus');
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private running: Promise<VcsalesHealthView> | null = null;
  private health: Health;
  private staff: { at: number; items: VcsaleStaffMember[] } | null = null;

  constructor(
    private readonly db: DbService,
    @Inject(VCSALE_CLIENT) private readonly vcsale: VcsaleClient,
  ) {
    this.health = { mode: vcsale.mode, ok: null, checkedAt: null, latencyMs: null, version: null, error: null, downSince: null, lastOkAt: null };
  }

  onApplicationBootstrap() {
    if (everyMs() > 0) this.schedule(FIRST_CHECK_MS);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.check().then(() => this.schedule(this.health.ok === false ? Math.min(DOWN_EVERY_MS, everyMs()) : everyMs()));
    }, ms);
    this.timer.unref();
  }

  /** True only when the last check failed: unknown (not checked yet) counts as up. */
  down(): boolean {
    return this.health.ok === false;
  }

  view(): VcsalesHealthView {
    return { ...this.health, everyMinutes: Math.round(everyMs() / MIN) };
  }

  /** One check now ("Kiểm tra ngay" too); callers at the same moment share it. */
  check(): Promise<VcsalesHealthView> {
    this.running ??= this.runCheck().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runCheck(): Promise<VcsalesHealthView> {
    const started = Date.now();
    const r = await this.vcsale.getHealth().catch((): VcsaleHealth => ({ ok: false, version: null, error: 'Không kết nối được VCsales.' }));
    const now = new Date();
    const prev = this.health;
    this.health = {
      mode: this.vcsale.mode,
      ok: r.ok,
      checkedAt: now.toISOString(),
      latencyMs: now.getTime() - started,
      version: r.version ?? prev.version,
      error: r.ok ? null : r.error,
      downSince: r.ok ? null : (prev.downSince ?? now.toISOString()),
      lastOkAt: r.ok ? now.toISOString() : prev.lastOkAt,
    };
    // Fixed texts only: nothing of a customer or a message goes to the log (§12.3).
    if (!r.ok && prev.ok !== false) this.logger.warn(`VCsales down: ${r.error ?? 'no answer'}`);
    if (r.ok && prev.ok === false) this.logger.log(`VCsales back, down since ${prev.downSince}`);
    return this.view();
  }

  /** VCsales staff matched with VClinks users of the current tenant by e-mail. */
  async staffMatching(refresh = false): Promise<VcsalesStaffMatching> {
    let error: string | null = null;
    if (refresh || !this.staff || Date.now() - this.staff.at > STAFF_TTL_MS) {
      try {
        this.staff = { at: Date.now(), items: await this.vcsale.listSalesStaff() };
      } catch (e) {
        if (!(e instanceof VcsaleUnavailableError)) throw e;
        error = e.message;
      }
    }
    const items = this.staff?.items ?? [];
    const emails = [...new Set(items.map((s) => emailKey(s.email)).filter((x): x is string => !!x))];
    const users = emails.length
      ? await this.db
          .col<UserDoc>(C.users)
          .find({ email: { $in: emails } }, { projection: { _id: 1, email: 1, fullName: 1, status: 1 } })
          .toArray()
      : [];
    const byEmail = new Map<string, MatchUser>(users.map((u) => [u.email, { id: u._id, fullName: u.fullName, status: u.status }]));
    return { fetchedAt: this.staff ? new Date(this.staff.at).toISOString() : null, error, ...matchStaff(items, byEmail) };
  }

  async status(refresh = false): Promise<VcsalesStatusResponse> {
    const health = refresh || this.health.ok === null ? await this.check() : this.view();
    return { health, staff: await this.staffMatching(refresh) };
  }
}
