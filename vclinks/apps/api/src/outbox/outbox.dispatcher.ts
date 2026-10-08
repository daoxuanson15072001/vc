import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { CHANNEL_INFO, channelOfUid, type OutboxItem } from '@vclinks/shared';
import { ChannelSenderRegistry } from '../channels/channel-sender';
import { DbService } from '../db/db.service';
import { runsBackgroundJobs } from '../db/role';
import { runAsTenant } from '../db/tenant-context';
import { OutboxService } from './outbox.service';

/** How often approved items of API channels are swept (covers restarts and missed kicks). */
const SWEEP_MS = 30_000;

/**
 * Sends approved outbox items of API channels (Zalo OA, Fanpage) server-side.
 * Every send goes claim() → sender.send() → result(), so the approval
 * invariant (approvedBy + approvedAt, CLAUDE.md §12.1) is re-checked in the
 * claim query and every outcome lands in the audit log. Extension channels are
 * left alone: the extension (or Claude over MCP) sends those.
 */
@Injectable()
export class OutboxDispatcher implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly outbox: OutboxService,
    private readonly senders: ChannelSenderRegistry,
    private readonly db: DbService,
  ) {}

  /**
   * OUTBOX_DISPATCHER=off, or a web process next to a connector (VCLINKS_ROLE=web),
   * disables automatic sends (kick and sweep); sweep() can still be called.
   */
  private readonly enabled = process.env.OUTBOX_DISPATCHER !== 'off' && runsBackgroundJobs();

  onApplicationBootstrap() {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.sweep(), SWEEP_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Called right after an item is approved, so API sends do not wait for the sweep. */
  kick(item: OutboxItem) {
    if (!this.enabled || CHANNEL_INFO[item.channel].sendMode !== 'api') return;
    setImmediate(() => void this.dispatch(item));
  }

  async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      // The outbox is tenant-scoped: sweep each tenant in its own scope.
      for (const tenant of await this.db.tenants()) {
        await runAsTenant(tenant, async () => {
          for (const channel of this.senders.channels()) {
            for (const item of await this.outbox.pendingForChannel(channel)) await this.dispatch(item);
          }
        });
      }
    } catch (e) {
      this.logger.warn(`Sweep failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.running = false;
    }
  }

  async dispatch(item: OutboxItem): Promise<void> {
    const channel = channelOfUid(item.uid);
    const sender = this.senders.get(channel);
    if (!sender) return;
    const actor = `dispatcher:${channel}`;
    let claimed: OutboxItem;
    try {
      claimed = await this.outbox.claim(item.id, actor, true);
    } catch {
      return; // Already claimed by a concurrent dispatch, or no longer approved.
    }
    let outcome;
    try {
      outcome = await sender.send(claimed);
    } catch (e) {
      outcome = { ok: false, error: (e instanceof Error ? e.message : 'send threw').slice(0, 300) };
    }
    await this.outbox.result(
      claimed.id,
      outcome.ok
        ? { ok: true, sentAt: new Date().toISOString(), cliMsgId: outcome.externalMsgId }
        : { ok: false, error: outcome.error ?? 'lỗi không rõ' },
      actor,
    );
  }
}
