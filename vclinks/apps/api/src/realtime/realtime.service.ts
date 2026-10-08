import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import type { RealtimeEvent, RealtimeEventType } from '@vclinks/shared';
import { ObjectId } from 'mongodb';
import { AuthzService } from '../authz/authz.service';
import { DbService } from '../db/db.service';
import { currentTenant, runAsTenant } from '../db/tenant-context';

const COLLECTION = 'realtime_events';
/** Events live one hour: a reconnecting browser reloads its lists instead of replaying history. */
const TTL_SECONDS = 3600;
const SCOPE_CACHE_MS = 15_000;
/**
 * ObjectIds from different processes (VCLINKS_ROLE=web / connector) are not ordered inside one second, so the
 * tail re-reads a short window behind its cursor and skips ids it already delivered.
 */
const LOOKBACK_SEC = 3;
const PAGE = 1000;

interface EventDoc {
  _id: ObjectId;
  tenant_id: string;
  at: Date;
  type: RealtimeEventType;
  id: string;
  uid?: string;
  threadId?: string;
  kind?: string;
  /** Set for events meant for one user only (notices). */
  userId?: string;
}

export interface RealtimeSubscriber {
  tenantId: string;
  /** Signed-in user; absent for a legacy dashboard token (allowed only with AUTHZ_LEGACY_TOKENS=1). */
  userId?: string;
  legacy: boolean;
  send(ev: RealtimeEvent): void;
}

interface Scope {
  active: boolean;
  all: boolean;
  channels: Set<string>;
  conversations: Set<string>;
  at: number;
}

/**
 * Realtime bus (M1c-07). Events are appended to a small TTL collection, and every process that serves an
 * SSE stream tails it, so a message ingested by the connector process reaches a Dashboard served by the
 * web process (VCLINKS_ROLE split) and nothing depends on one process. Polling runs only while somebody
 * is subscribed. Each event is checked against the subscriber's data scope (`conv.view`) before it is
 * written to the stream, so nobody receives an event of a conversation or nick he may not see.
 */
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly subs = new Map<RealtimeSubscriber, Scope | null>();
  private timer?: NodeJS.Timeout;
  /** Tail cursor in seconds (ObjectId timestamp) and the ids already delivered inside the look-back window. */
  private cursorSec = 0;
  private startSec = 0;
  private readonly seen = new Map<string, number>();
  private polling = false;

  constructor(
    private readonly db: DbService,
    @Optional() private readonly authz?: AuthzService,
  ) {}

  /** TTL index, created once on first use (DbService may not be connected yet at module init). */
  private indexed?: Promise<unknown>;
  private ensureIndex() {
    this.indexed ??= this.db
      .unscoped(COLLECTION)
      .createIndex({ at: 1 }, { expireAfterSeconds: TTL_SECONDS })
      .catch((e) => this.logger.warn(`Không tạo được chỉ mục ${COLLECTION}: ${(e as Error).message}`));
    return this.indexed;
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Appends an event for the current tenant. Never throws: realtime must not break the caller. */
  async publish(e: { type: RealtimeEventType; id: string; uid?: string; threadId?: string; kind?: string; userId?: string }): Promise<void> {
    try {
      await this.ensureIndex();
      const doc: Omit<EventDoc, '_id'> = { tenant_id: currentTenant(), at: new Date(), ...e };
      await this.db.unscoped(COLLECTION).insertOne(doc as never);
    } catch (err) {
      this.logger.warn(`Không ghi được sự kiện realtime: ${(err as Error).message}`);
    }
  }

  subscribe(sub: RealtimeSubscriber): () => void {
    this.subs.set(sub, null);
    if (this.subs.size === 1) {
      this.startSec = this.cursorSec = Math.floor(Date.now() / 1000);
      this.seen.clear();
      const ms = Number(process.env.REALTIME_POLL_MS ?? 1000);
      this.timer = setInterval(() => void this.poll(), ms);
      this.timer.unref();
    }
    return () => {
      this.subs.delete(sub);
      if (!this.subs.size && this.timer) {
        clearInterval(this.timer);
        this.timer = undefined;
      }
    };
  }

  /** One tail step; public so tests can drive it without waiting for the timer. */
  async poll(): Promise<void> {
    if (this.polling || !this.subs.size) return;
    this.polling = true;
    try {
      const from = ObjectId.createFromTime(Math.max(this.startSec, this.cursorSec - LOOKBACK_SEC));
      const docs = await this.db.unscoped<EventDoc>(COLLECTION).find({ _id: { $gte: from } }).sort({ _id: 1 }).limit(PAGE).toArray();
      for (const d of docs) {
        const key = d._id.toHexString();
        const sec = d._id.getTimestamp().getTime() / 1000;
        if (sec > this.cursorSec) this.cursorSec = Math.floor(sec);
        if (this.seen.has(key)) continue;
        this.seen.set(key, sec);
        await Promise.all([...this.subs.keys()].map((s) => this.deliver(s, d)));
      }
      // A full page means a burst: move on rather than re-reading the same window forever.
      if (docs.length === PAGE) this.cursorSec += 1;
      for (const [k, sec] of this.seen) if (sec < this.cursorSec - LOOKBACK_SEC - 1) this.seen.delete(k);
    } catch (err) {
      this.logger.warn(`Đọc sự kiện realtime lỗi: ${(err as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  private async deliver(sub: RealtimeSubscriber, d: EventDoc): Promise<void> {
    try {
      if (d.tenant_id !== sub.tenantId) return;
      if (d.userId) {
        // Personal notices: only to their user, and not to somebody locked or gone since the stream opened.
        if (d.userId !== sub.userId || !(await this.scopeOf(sub)).active) return;
      } else if (!(await this.canSee(sub, d))) return;
      sub.send({
        type: d.type,
        id: d.id,
        at: d.at.toISOString(),
        ...(d.uid ? { uid: d.uid } : {}),
        ...(d.threadId ? { threadId: d.threadId } : {}),
        ...(d.kind ? { kind: d.kind } : {}),
      });
    } catch {
      // A broken stream is cleaned up by its own close handler.
    }
  }

  /** Same data scope as the conversation list: whole channels, plus single conversations opened by a grant. */
  private async canSee(sub: RealtimeSubscriber, d: EventDoc): Promise<boolean> {
    if (!d.uid) return false;
    if (!sub.userId) return sub.legacy;
    const scope = await this.scopeOf(sub);
    return scope.all || scope.channels.has(d.uid) || (!!d.threadId && scope.conversations.has(`${d.uid}:${d.threadId}`));
  }

  /** The subscriber's `conv.view` scope, re-read every SCOPE_CACHE_MS so a lock / handover takes effect on open streams. */
  private async scopeOf(sub: RealtimeSubscriber): Promise<Scope> {
    const none = (): Scope => ({ active: false, all: false, channels: new Set<string>(), conversations: new Set<string>(), at: Date.now() });
    if (!sub.userId || !this.authz) return { ...none(), active: sub.legacy };
    let scope = this.subs.get(sub) ?? null;
    if (!scope || Date.now() - scope.at > SCOPE_CACHE_MS) {
      const authz = this.authz;
      const userId = sub.userId;
      scope = await runAsTenant(sub.tenantId, async () => {
        const u = await authz.subject(userId);
        if (!u.active) return none();
        const s = await authz.dataScope(u, 'conv.view');
        return { active: true, all: !s, channels: new Set(s?.channels ?? []), conversations: new Set(s?.conversations ?? []), at: Date.now() };
      });
      this.subs.set(sub, scope);
    }
    return scope;
  }
}
