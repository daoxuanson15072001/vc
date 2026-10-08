import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service';
import {
  HEALTH_OFFLINE_MS,
  STREAMS,
  TEST_PHASE_MESSAGE,
  type AccountHealth,
  channelOfUid,
  CHANNEL_INFO,
  type Channel,
  type AccountStatus,
  type RegisterAccount,
  type SessionLostReason,
  type SessionReport,
  type SessionReportResult,
  type SessionState,
  type SendPaceInput,
  type Stream,
  type StreamStatus,
} from '@vclinks/shared';
import { toIso } from '../common/zod';
import { HEALTH_LABELS, computeHealth } from './health';
import { C, DbService } from '../db/db.service';
import type { Principal } from '../auth/token.service';
import { TokenService } from '../auth/token.service';
import { TOKEN_TEXT } from '@vclinks/shared';

export interface AccountDoc {
  _id: string;
  channel?: Channel;
  label: string;
  ownerName?: string;
  createdAt: Date;
  lastSyncAt?: Date;
  /** Web session health reported by the driver watchdog (tools/chrome-driver/watchdog.js). */
  session?: SessionDoc;
  /** Flagged "Chưa an toàn" (01 PQ-51): locks sending. Set by M1b-04; false/absent by default. */
  unsafe?: boolean;
  /** `cho_xac_nhan` = registered by a device, awaiting an Admin (M1b-06, PQ-52 d); absent = normal. */
  status?: 'cho_xac_nhan';
  pendingDevice?: string;
  /** Send allowlist reported by the extension's outbox poll (SZ-14); absent = no limit. */
  sendLimit?: { onlyThreadIds: string[]; at: Date };
}

/** Heartbeat of the extension per account (collection `extension_presence`, written by FetchRequestsService). */
interface PresenceRow {
  _id: string;
  lastSeenAt: Date;
  loggedIn: boolean | null;
  waiting: string | null;
}

export interface SessionDoc {
  state: SessionState;
  reason: SessionLostReason | null;
  since: Date;
  reportedAt: Date;
  source: string | null;
}

export interface CheckpointDoc {
  _id: string;
  uid: string;
  stream: Stream;
  cursor?: number;
  sourceCount?: number;
  sourceCountAt?: Date;
  mappingVersion?: number;
  lastIngestAt?: Date;
}

/** Collection + filter used to count what we hold for a stream (compared with IndexedDB). */
export const STREAM_COUNT: Record<Stream, { col: string; extra?: Record<string, unknown> }> = {
  contacts: { col: C.contacts },
  groups: { col: C.groups },
  // Conversations derived from messages alone are not in the IndexedDB store.
  conversations: { col: C.conversations, extra: { fromStore: true } },
  messages: { col: C.messages },
  reactions: { col: C.reactions },
  labels: { col: C.labels },
  read_state: { col: C.readStates },
};

const channelSendsViaExtension = (c: Channel) => CHANNEL_INFO[c].sendMode === 'extension';

@Injectable()
export class AccountsService {
  constructor(
    private readonly db: DbService,
    private readonly tokens: TokenService,
    // M1c-07: push red / green nick changes to open Dashboards.
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  /**
   * A bound device announces a nick nobody declared. The account is created as pending and the device may
   * push to it (its data is stored but shown to nobody); an Admin confirms or rejects it (ChannelAccessService).
   */
  async registerPending(input: RegisterAccount, p: Principal) {
    const col = this.db.col<AccountDoc>(C.accounts);
    if (await col.countDocuments({ _id: input.uid }, { limit: 1 })) throw new ForbiddenException(TOKEN_TEXT.deviceNotAssigned);
    await col
      .insertOne({ _id: input.uid, label: input.label, ...(input.ownerName ? { ownerName: input.ownerName } : {}), channel: input.channel, createdAt: new Date(), status: 'cho_xac_nhan', pendingDevice: p.name } as AccountDoc)
      .catch((e: { code?: number }) => {
        if (e?.code === 11000) throw new ConflictException(`Tài khoản ${input.uid} đã thuộc đơn vị khác`);
        throw e;
      });
    await this.db.col(C.apiTokens).updateOne({ _id: p.tokenId as never }, { $addToSet: { uids: input.uid } } as never);
    this.tokens.forgetCache();
    await this.db.audit(p.name, 'account.pending', input.uid, { device: p.name });
    return { uid: input.uid, label: input.label, created: true, pending: true };
  }

  /**
   * Registers an account of any channel. With `overwriteLabel` false (extension), an
   * existing label — possibly renamed on the Dashboard — is kept.
   */
  async register(input: RegisterAccount, actor: string, overwriteLabel: boolean) {
    const col = this.db.col<AccountDoc>(C.accounts);
    const set: Partial<AccountDoc> = {};
    if (overwriteLabel) set.label = input.label;
    if (input.ownerName) set.ownerName = input.ownerName;
    const r = await col
      .updateOne(
        { _id: input.uid },
        {
          $set: set,
          $setOnInsert: {
            createdAt: new Date(),
            channel: input.channel,
            ...(overwriteLabel ? {} : { label: input.label }),
          },
        },
        { upsert: true },
      )
      .catch((e: { code?: number }) => {
        // The upsert only sees this tenant's accounts: a duplicate _id means another tenant owns the uid.
        if (e?.code === 11000) throw new ConflictException(`Tài khoản ${input.uid} đã thuộc đơn vị khác`);
        throw e;
      });
    const created = r.upsertedCount === 1;
    if (created || overwriteLabel) await this.db.audit(actor, 'account.register', input.uid, { created });
    const doc = await col.findOne({ _id: input.uid });
    return { uid: input.uid, label: doc!.label, created };
  }

  async assertExists(uid: string) {
    const n = await this.db.col<AccountDoc>(C.accounts).countDocuments({ _id: uid }, { limit: 1 });
    if (!n) throw new NotFoundException(`Tài khoản ${uid} chưa được đăng ký`);
  }

  async update(uid: string, patch: { label?: string; ownerName?: string; sendPace?: SendPaceInput }, actor: string) {
    const { sendPace, ...rest } = patch;
    const set: Record<string, unknown> = { ...rest };
    // Only the given pace fields change; the others keep falling back to env / default.
    if (sendPace?.gapMs !== undefined) set['sendPace.gapMs'] = sendPace.gapMs;
    if (sendPace?.perMinute !== undefined) set['sendPace.perMinute'] = sendPace.perMinute;
    const r = await this.db.col<AccountDoc>(C.accounts).updateOne({ _id: uid }, { $set: set });
    if (!r.matchedCount) throw new NotFoundException(`Không tìm thấy tài khoản ${uid}`);
    await this.db.audit(actor, 'account.update', uid, { fields: Object.keys(set), ...(sendPace ? { sendPace } : {}) });
  }

  /**
   * Records a session report from the driver watchdog. Every report refreshes the
   * heartbeat (`session.reportedAt`); only a change of state or reason is audited,
   * as `account.session_lost` / `account.session_restored`.
   * Both are mirrored into the events log by DbService.audit (subject kind `account`).
   */
  async reportSession(uid: string, r: SessionReport, actor: string): Promise<SessionReportResult> {
    const col = this.db.col<AccountDoc>(C.accounts);
    const now = new Date();
    const reason = r.reason ?? null;
    const source = r.source ?? null;
    // Same state and reason: heartbeat only (atomic, so two reports cannot both "change").
    const same = await col.findOneAndUpdate(
      { _id: uid, 'session.state': r.state, 'session.reason': reason },
      { $set: { 'session.reportedAt': now, 'session.source': source } },
      { returnDocument: 'after' },
    );
    if (same) return { state: r.state, changed: false, lastSyncAt: toIso(same.lastSyncAt) };

    const session: SessionDoc = { state: r.state, reason, since: now, reportedAt: now, source };
    const prev = await col.findOneAndUpdate({ _id: uid }, { $set: { session } }, { returnDocument: 'before' });
    if (!prev) throw new NotFoundException(`Tài khoản ${uid} chưa được đăng ký`);
    const action = r.state === 'lost' ? 'account.session_lost' : 'account.session_restored';
    // A first "ok" from a new watchdog is not a restore; skip that audit line.
    if (r.state === 'lost' || prev.session?.state === 'lost') {
      await this.db.audit(actor, action, uid, {
        reason,
        source,
        detail: r.detail,
        previous: prev.session ? { state: prev.session.state, reason: prev.session.reason } : null,
      });
      void this.realtime?.publish({ type: r.state === 'lost' ? 'account.red' : 'account.ok', id: uid, uid });
    }
    return { state: r.state, changed: true, lastSyncAt: toIso(prev.lastSyncAt) };
  }

  /** Records the send allowlist the extension is running with (empty list = no limit). */
  async noteSendLimit(uid: string, onlyThreadIds: string[]) {
    const col = this.db.col<AccountDoc>(C.accounts);
    if (onlyThreadIds.length) await col.updateOne({ _id: uid }, { $set: { sendLimit: { onlyThreadIds, at: new Date() } } });
    else await col.updateOne({ _id: uid, sendLimit: { $exists: true } }, { $unset: { sendLimit: '' } });
  }

  /**
   * "Báo Admin" (03 MH-SZ-12a #4): records a notice for Admins in the events log,
   * at most once per 30 minutes per nick. Returns false when throttled.
   */
  async notifyAdmin(uid: string, actor: string): Promise<boolean> {
    await this.assertExists(uid);
    const since = new Date(Date.now() - 30 * 60_000);
    const recent = await this.db.col(C.events).countDocuments({ type: 'account.admin_notified', 'subject.id': uid, at: { $gt: since } }, { limit: 1 });
    if (recent) return false;
    const [h] = await this.health(uid);
    await this.db.audit(actor, 'account.admin_notified', uid, { level: h.level, technical: h.technical });
    return true;
  }

  /** Health of one account, or of all when `uid` is omitted. */
  async health(uid?: string): Promise<AccountHealth[]> {
    const accounts = await this.db.col<AccountDoc>(C.accounts).find(uid ? { _id: uid } : {}).sort({ createdAt: 1 }).toArray();
    if (uid && !accounts.length) throw new NotFoundException(`Tài khoản ${uid} chưa được đăng ký`);
    return Promise.all(accounts.map((a) => this.healthOf(a)));
  }

  private async healthOf(a: AccountDoc): Promise<AccountHealth> {
    const uid = a._id;
    const channel = a.channel ?? channelOfUid(uid);
    const [presence, openDrifts, pendingCommands, failedCommands] = await Promise.all([
      this.db.col<PresenceRow>(C.extensionPresence).findOne({ _id: uid }),
      this.db.col(C.mappingDrifts).countDocuments({ uid, status: 'open' }),
      this.db.col(C.suggestions).countDocuments({ uid, status: { $in: ['approved', 'sending', 'awaiting_confirm'] } }),
      this.db.col(C.suggestions).countDocuments({ uid, status: { $in: ['failed', 'expired'] } }),
    ]);
    const { level, reason, technical, since } = computeHealth({
      extensionChannel: channelSendsViaExtension(channel),
      unsafe: !!a.unsafe,
      session: a.session ? { state: a.session.state, reason: a.session.reason, since: a.session.since } : null,
      presence: presence ? { lastSeenAt: presence.lastSeenAt, loggedIn: presence.loggedIn, waiting: presence.waiting } : null,
      openDrifts,
      now: new Date(),
    });
    return {
      uid,
      level,
      label: HEALTH_LABELS[level],
      reason,
      technical,
      since: toIso(since),
      lastSyncAt: toIso(a.lastSyncAt),
      canSend: level !== 'red' && level !== 'unsafe',
      onlyThreadIds: a.sendLimit?.onlyThreadIds?.length ? a.sendLimit.onlyThreadIds : null,
      pendingCommands,
      failedCommands,
      farmMode: await this.farmModeOf(uid),
    };
  }

  /** How the máy Zalo runs this nick (collection of the zalo-farm module); null when it is not there. */
  private async farmModeOf(uid: string): Promise<'direct' | 'browser' | null> {
    const slot = await this.db
      .col<{ _id: string; uid?: string | null; state?: string; mode?: string }>('zalo_slots')
      .findOne({ uid, state: { $ne: 'da_ngat' } }, { projection: { mode: 1 } });
    if (!slot) return null;
    return slot.mode === 'direct' ? 'direct' : 'browser';
  }

  /**
   * Gate for new outbox commands: refuses red / "Chưa an toàn" accounts (SZ-10)
   * and threads outside the test allowlist (SZ-14). Yellow still queues.
   */
  async assertCanSend(uid: string, threadId: string, opts: { anyThread?: boolean } = {}) {
    const [h] = await this.health(uid);
    if (!h.canSend) {
      throw new BadRequestException(
        h.level === 'unsafe'
          ? 'Nick này đang ở trạng thái "Chưa an toàn" nên chưa gửi được. Hãy báo Admin.'
          : `Nick đang mất kết nối nên chưa gửi được. ${h.reason ?? ''} Nháp của bạn vẫn được giữ.`.trim(),
      );
    }
    // Friend requests are not tied to a conversation: only the nick state applies (each one is approved by a person).
    if (!opts.anyThread && h.onlyThreadIds && !h.onlyThreadIds.includes(threadId)) throw new BadRequestException(TEST_PHASE_MESSAGE);
  }

  async status(uid?: string): Promise<AccountStatus[]> {
    const accounts = await this.db
      .col<AccountDoc>(C.accounts)
      .find(uid ? { _id: uid } : {})
      .sort({ createdAt: 1 })
      .toArray();

    return Promise.all(
      accounts.map(async (a) => {
        const cps = await this.db.col<CheckpointDoc>(C.checkpoints).find({ uid: a._id }).toArray();
        const byStream = new Map(cps.map((c) => [c.stream, c]));
        const streams: StreamStatus[] = await Promise.all(
          STREAMS.map(async (stream) => {
            const { col, extra } = STREAM_COUNT[stream];
            const cp = byStream.get(stream);
            return {
              stream,
              sourceCount: cp?.sourceCount ?? null,
              sourceCountAt: toIso(cp?.sourceCountAt),
              dbCount: await this.db.col(col).countDocuments({ uid: a._id, ...extra }),
              cursor: cp?.cursor ?? null,
              lastIngestAt: toIso(cp?.lastIngestAt),
            };
          }),
        );
        const openDrifts = await this.db
          .col(C.mappingDrifts)
          .countDocuments({ uid: a._id, status: 'open' });
        return {
          uid: a._id,
          channel: a.channel ?? channelOfUid(a._id),
          label: a.label,
          ownerName: a.ownerName,
          lastSyncAt: toIso(a.lastSyncAt),
          session: a.session
            ? {
                state: a.session.state,
                reason: a.session.reason,
                since: toIso(a.session.since)!,
                reportedAt: toIso(a.session.reportedAt)!,
                source: a.session.source,
              }
            : null,
          streams,
          openDrifts,
        };
      }),
    );
  }
}
