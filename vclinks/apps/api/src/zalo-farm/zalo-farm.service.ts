import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  SELF_EDIT_MESSAGE,
  type CreateZaloSlot,
  type ZaloSlotMode,
  type ZaloSlotOptions,
  type ZaloFarmStatus,
  type ZaloSlotState,
  type ZaloSlotView,
  type ZaloStickerSearch,
  type ZaloSyncHistoryResult,
} from '@vclinks/shared';
import type { Principal } from '../auth/token.service';
import { AccountsService, type AccountDoc } from '../accounts/accounts.service';
import { AuthzService } from '../authz/authz.service';
import { decide, type Subject } from '../authz/engine';
import { ChannelAccessService } from '../channel-access/channel-access.service';
import { C, DbService } from '../db/db.service';
import { runUnscoped } from '../db/tenant-context';
import { ORG_C, type OrgUnitDoc } from '../org/org.types';
import type { UserDoc } from '../users/users.service';
import { FarmClient, type FarmSlotState } from './farm-client';

/** One nick of the máy Zalo (tenant-scoped). No cookie, token or QR image is ever stored here (§12.2). */
export const ZALO_SLOTS = 'zalo_slots';

export interface ZaloSlotDoc {
  _id: string;
  label: string;
  /** Absent on slots made before the direct mode = browser. */
  mode?: ZaloSlotMode;
  divisionId: string;
  holderUserId: string;
  uid: string | null;
  state: ZaloSlotState;
  message: string | null;
  /** Opens unread conversations to read their content (sender sees "Đã xem"); absent = off. */
  openUnread?: boolean;
  /** Created "Trực tiếp, lấy cả tin cũ": Zalo Web first, the agent moves it to direct by itself (plan P4). */
  historyFirst?: boolean;
  /** Planned move to direct (from the agent), and whether the Zalo Web profile is kept to go back. */
  handoverAt?: Date | null;
  chromeKept?: boolean;
  /** Principal name of the Admin who created the slot: the actor of the binding after the scan. */
  createdBy: string;
  createdAt: Date;
  connectedAt: Date | null;
  disconnectedAt?: Date | null;
  /** Last `zalo.qr_viewed` audit line (one per 10 minutes, the dialog polls every 2 s). */
  lastQrAuditAt?: Date | null;
}

const QR_AUDIT_MS = 10 * 60_000;
/** "Trực tiếp, lấy cả tin cũ": Zalo Web brings the history and reads recent content this long after the scan. */
const HISTORY_FIRST_MIN = 30;
const newId = () => `zs_${randomBytes(8).toString('hex')}`;

/**
 * Máy Zalo (docs/01-quan-ly-du-an/ke-hoach-zalo-ca-nhan-quet-qr.md): connect a company Zalo nick by scanning the
 * QR shown on the Dashboard. The agent runs Chrome; this service decides what the scan means:
 *   - a new slot binds to the account that logged in (division + holder chosen by the Admin beforehand);
 *   - a connected slot that sees another account wipes that login at once ("quét nhầm"), nothing is ingested;
 *   - the QR goes only to the holder of the nick and to Admins (channel.confirm), and is never stored.
 */
@Injectable()
export class ZaloFarmService {
  constructor(
    private readonly db: DbService,
    private readonly farm: FarmClient,
    private readonly accounts: AccountsService,
    private readonly access: ChannelAccessService,
    private readonly authz: AuthzService,
  ) {}

  private col() {
    return this.db.col<ZaloSlotDoc>(ZALO_SLOTS);
  }

  /** Connect / disconnect nicks: the right that confirms new nicks (Admin). Legacy tokens without a user pass. */
  canManage(u: Subject | undefined): boolean {
    return !u || decide(u, 'channel.confirm').allowed;
  }

  /** Disconnect: an Admin, or the holder for his own nick (dev002, 07/10/2026). A "Trực nick" cover sees the nick but may not. */
  private canDisconnect(slot: ZaloSlotDoc, u: Subject | undefined): boolean {
    return this.canManage(u) || (!!u && slot.holderUserId === u.userId);
  }

  private async allowed(slot: ZaloSlotDoc, u: Subject | undefined): Promise<boolean> {
    if (this.canManage(u) || !u) return true;
    if (slot.holderUserId === u.userId) return true;
    if (!slot.uid) return false;
    if (u.nicks.has(slot.uid)) return true;
    return (await this.authz.ownership()).holders.get(slot.uid) === u.userId;
  }

  /** The slot if the caller may see it; otherwise 404, like a slot that does not exist. */
  private async load(id: string, u: Subject | undefined): Promise<ZaloSlotDoc> {
    const slot = /^zs_[a-f0-9]{16}$/.test(id) ? await this.col().findOne({ _id: id }) : null;
    if (!slot || !(await this.allowed(slot, u))) throw new NotFoundException('Không tìm thấy chỗ kết nối này');
    return slot;
  }

  async status(u: Subject | undefined): Promise<ZaloFarmStatus> {
    const canManage = this.canManage(u);
    if (!this.farm.configured) return { installed: false, slots: 0, max: 0, canManage };
    const h = await this.farm.health().catch(() => null);
    return h ? { installed: true, slots: h.slots, max: h.max, canManage } : { installed: false, slots: 0, max: 0, canManage };
  }

  async list(u: Subject | undefined): Promise<ZaloSlotView[]> {
    const filter = this.canManage(u) ? { state: { $ne: 'da_ngat' as const } } : { state: { $ne: 'da_ngat' as const }, holderUserId: u?.userId ?? '' };
    const found = await this.col().find(filter).sort({ createdAt: 1 }).toArray();
    // Mode facts can change on the agent (a planned move to direct): keep them in step, agent down = as stored.
    const docs = await Promise.all(
      found.map(async (d) => {
        if (!this.farm.configured) return d;
        const st = await this.farm.state(d._id, false).catch(() => null);
        return st ? this.save(d, await this.modePatch(d, st)) : d;
      }),
    );
    const names = await this.names(docs);
    return docs.map((d) => this.toView(d, null, names, u));
  }

  async create(input: CreateZaloSlot, u: Subject | undefined, p: Principal): Promise<ZaloSlotView> {
    if (input.holderUserId === p.userId) throw new ForbiddenException(SELF_EDIT_MESSAGE);
    const division = await runUnscoped(() => this.db.col<OrgUnitDoc>(ORG_C.orgUnits).findOne({ _id: input.divisionId as never, type: 'division' } as never));
    if (!division || division.active === false) throw new NotFoundException('Chọn một division hợp lệ');
    await this.access.assertCanHold(input.holderUserId, input.divisionId);
    const h = await this.farm.health().catch(() => {
      throw new ServiceUnavailableException('Máy Zalo chưa chạy trên máy chủ này.');
    });
    if (h.slots >= h.max) throw new ConflictException(`Máy Zalo đã đủ ${h.max} nick. Ngắt một nick hoặc thêm máy.`);
    // Direct with history: start on Zalo Web, the agent moves the nick to direct HISTORY_FIRST_MIN after the scan.
    const historyFirst = input.mode === 'direct' && input.history === true;
    const doc: ZaloSlotDoc = {
      _id: newId(),
      label: input.label,
      mode: historyFirst ? 'browser' : input.mode,
      ...(historyFirst ? { historyFirst: true } : {}),
      divisionId: input.divisionId,
      holderUserId: input.holderUserId,
      uid: null,
      state: 'dang_bat',
      message: null,
      createdBy: p.name,
      createdAt: new Date(),
      connectedAt: null,
    };
    await this.col().insertOne(doc);
    await this.db.audit(p.name, 'zalo.slot_created', doc._id, { label: doc.label, mode: doc.mode, ...(historyFirst ? { historyFirst: true } : {}), divisionId: doc.divisionId, holderUserId: doc.holderUserId, companyNick: true });
    // Chrome takes up to a minute to come up: the dialog polls the state meanwhile.
    void this.farm.start(doc._id, doc.mode, historyFirst ? HISTORY_FIRST_MIN : undefined).catch(async (e: Error) => {
      await this.col().updateOne({ _id: doc._id }, { $set: { state: 'loi', message: e.message } });
    });
    return this.toView(doc, null, await this.names([doc]), u);
  }

  /** Live state of a slot; `wantQr` relays the login QR (the dialog polls this every 2 s). */
  async view(id: string, u: Subject | undefined, wantQr: boolean, viewer: string): Promise<ZaloSlotView> {
    const slot = await this.load(id, u);
    if (slot.state === 'da_ngat') return this.toView(slot, null, await this.names([slot]), u);
    let st: FarmSlotState;
    try {
      st = await this.farm.state(id, wantQr);
    } catch (e) {
      if (e instanceof NotFoundException) {
        // The agent lost the slot (its volume was reset): start it again on the QR page.
        void this.farm.start(id, slot.mode).catch(() => undefined);
        st = { page: 'down', uids: [] };
      } else {
        return this.toView(await this.save(slot, { state: 'loi', message: (e as Error).message }), null, await this.names([slot]), u);
      }
    }

    let patch: Partial<ZaloSlotDoc>;
    let qr: ZaloSlotView['qr'] = null;
    if (st.page === 'login') {
      if (st.view === 'scanned') patch = { state: 'da_quet', message: null };
      else {
        patch = {
          state: wantQr || !slot.uid ? 'cho_quet' : 'mat_phien',
          message:
            st.note === 'declined'
              ? 'Điện thoại vừa bấm từ chối đăng nhập. Quét lại mã mới và bấm Đăng nhập.'
              : st.view === 'expired'
                ? 'Mã QR vừa hết hạn, đang lấy mã mới…'
                : null,
        };
        if (wantQr && st.qr) qr = { png: st.qr, expired: st.view === 'expired' };
      }
    } else if (st.page === 'chat') {
      patch = await this.onChat(slot, st.uids);
    } else if (st.lost === 'duplicate_web') {
      patch = { state: 'mat_phien', message: 'Nick đang mở Zalo Web ở nơi khác nên kết nối trực tiếp bị ngắt. Đóng Zalo Web đó rồi bấm "Quét lại QR".' };
    } else {
      if (st.page !== 'down') void this.farm.start(id, slot.mode).catch(() => undefined);
      patch = { state: 'dang_bat', message: null };
    }
    const saved = await this.save(slot, { ...patch, ...(await this.modePatch(slot, st)) });
    if (qr && (!slot.lastQrAuditAt || Date.now() - slot.lastQrAuditAt.getTime() > QR_AUDIT_MS)) {
      await this.col().updateOne({ _id: id }, { $set: { lastQrAuditAt: new Date() } });
      await this.db.audit(viewer, 'zalo.qr_viewed', id, { uid: slot.uid });
    }
    return this.toView(saved, qr, await this.names([saved]), u);
  }

  /** Logged in: which account? Binds a new slot, keeps a connected one, wipes a wrong one. */
  private async onChat(slot: ZaloSlotDoc, uids: string[]): Promise<Partial<ZaloSlotDoc>> {
    if (!uids.length) return { state: 'dang_ket_noi', message: null };
    if (slot.uid) {
      if (uids.includes(slot.uid)) return { state: 'da_ket_noi', message: null, ...(slot.connectedAt ? {} : { connectedAt: new Date() }) };
      return this.wrongAccount(slot, `Bạn vừa quét bằng tài khoản Zalo khác. Hãy quét bằng điện thoại đang dùng nick ${slot.label}.`);
    }
    if (uids.length > 1) return this.wrongAccount(slot, 'Hồ sơ có nhiều tài khoản Zalo, máy Zalo đã làm lại. Hãy quét lại một lần.');
    const uid = uids[0]!;
    const other = await this.col().findOne({ _id: { $ne: slot._id }, uid, state: { $ne: 'da_ngat' } });
    if (other) return this.wrongAccount(slot, `Nick này đã chạy ở chỗ "${other.label}" của máy Zalo. Mỗi nick chỉ một chỗ.`);
    // Only one poll binds (the dialog may be open twice).
    const won = await this.col().findOneAndUpdate({ _id: slot._id, uid: null }, { $set: { uid } }, { returnDocument: 'after' });
    if (!won) return {};
    const existing = await runUnscoped(() => this.db.col<AccountDoc>(C.accounts).findOne({ _id: uid }));
    // A system action decided by the Admin who created the slot: not limited to the data scope of whoever watches the QR.
    if (!existing) await runUnscoped(() => this.accounts.register({ uid, label: slot.label, channel: 'zalo' }, slot.createdBy, true));
    await this.access.attachConnectedNick(uid, slot.divisionId, slot.holderUserId, slot.createdBy);
    await this.farm.meta(slot._id, uid).catch(() => undefined);
    await this.db.audit(slot.createdBy, 'zalo.connected', slot._id, { uid, created: !existing });
    return {
      uid,
      state: 'da_ket_noi',
      connectedAt: new Date(),
      message: existing ? 'Nick đã có trong VClinks: giữ division và người giữ nick hiện có.' : null,
    };
  }

  /** Another account logged in: wipe that login right away (nothing of it is ingested), back to the QR page. */
  private async wrongAccount(slot: ZaloSlotDoc, message: string): Promise<Partial<ZaloSlotDoc>> {
    await this.db.audit('may-zalo', 'zalo.wrong_account', slot._id, { expected: slot.uid });
    await this.farm.reset(slot._id).catch(() => undefined);
    return { state: 'quet_nham', message };
  }

  /** "Quét lại QR" of a nick (holder or Admin): makes sure its Chrome runs, then the dialog polls the slot. */
  async rescan(uid: string, u: Subject | undefined, viewer: string): Promise<ZaloSlotView> {
    const slot = await this.col().findOne({ uid, state: { $ne: 'da_ngat' } });
    if (!slot || !(await this.allowed(slot, u))) {
      throw new NotFoundException('Nick này không chạy trên máy Zalo (đang dùng tiện ích hoặc Chrome driver): quét lại ở máy đó.');
    }
    void this.farm.start(slot._id, slot.mode).catch(() => undefined);
    return this.view(slot._id, u, true, viewer);
  }

  /**
   * Admin: per-nick options. `openUnread` lets this nick's automatic sync and Dashboard fetches open conversations
   * that still have unread messages: content shows within seconds instead of waiting for someone to read the chat
   * on the phone, but the sender sees "Đã xem" and the holder loses the unread badge. Off by default (owner rule
   * of 29/09/2026); each change is logged.
   */
  async setOptions(id: string, input: ZaloSlotOptions, u: Subject | undefined, p: Principal): Promise<ZaloSlotView> {
    const slot = await this.load(id, u);
    if (!this.canManage(u)) throw new ForbiddenException('Chỉ Admin đổi tùy chọn của nick.');
    if (slot.state === 'da_ngat') throw new ConflictException('Nick đã ngắt kết nối.');
    const patch: Partial<ZaloSlotDoc> = {};
    if (input.openUnread !== undefined) patch.openUnread = input.openUnread;
    await this.farm.options(id, patch);
    const saved = await this.save(slot, patch);
    await this.db.audit(p.name, 'zalo.options_changed', id, { uid: slot.uid, ...patch });
    return this.toView(saved, null, await this.names([saved]), u);
  }

  /**
   * Zalo's sticker search for the composer of a direct nick (keyword → stickers with their image). Nicks on Zalo Web
   * answer `direct: false` and keep the default set the extension can click. The route checks conv.reply on the nick.
   */
  async stickers(uid: string, q: string): Promise<ZaloStickerSearch> {
    const slot = uid ? await this.col().findOne({ uid, state: { $ne: 'da_ngat' } }) : null;
    if (!slot || slot.mode !== 'direct') return { direct: false, items: [] };
    const keyword = q.trim().slice(0, 50) || 'chào';
    try {
      return { direct: true, items: (await this.farm.stickers(slot._id, keyword)).items.slice(0, 40) };
    } catch {
      return { direct: true, items: [] };
    }
  }

  /**
   * Mode facts the agent reports. A move to direct the agent made by itself (planned after the history) is recorded
   * here: the audit line, and the messages still waiting for content get `contentGone` (no Zalo Web left to read them).
   */
  private async modePatch(slot: ZaloSlotDoc, st: FarmSlotState): Promise<Partial<ZaloSlotDoc>> {
    const patch: Partial<ZaloSlotDoc> = {};
    if (st.handoverAt !== undefined) patch.handoverAt = st.handoverAt ? new Date(st.handoverAt) : null;
    if (st.chromeKept !== undefined) patch.chromeKept = st.chromeKept;
    if (st.mode && st.mode !== (slot.mode ?? 'browser')) {
      patch.mode = st.mode;
      if (st.mode === 'direct' && slot.uid) {
        await this.markContentGone(slot.uid);
        await this.db.audit('may-zalo', 'zalo.slot_handover', slot._id, { uid: slot.uid, auto: true });
      }
    }
    return patch;
  }

  /**
   * Messages of the nick still waiting for content when it left Zalo Web: shown as such, not as "Đang chờ". A system
   * effect of the move: not limited to the data scope of whoever moved the nick (an Admin may not see its chats).
   */
  private async markContentGone(uid: string): Promise<void> {
    await runUnscoped(() =>
      this.db.col(C.messages).updateMany({ uid, $or: [{ encrypted: true }, { contentStatus: { $in: ['pending', 'partial'] } }] }, { $set: { contentGone: true } }),
    );
  }

  /**
   * Admin: Zalo Web → direct now (plan P4). The agent hands the session of the nick's Chrome profile to zca-js; when
   * Zalo refuses it, the nick stays on Zalo Web and the error says so. The profile stays 7 days to go back.
   */
  async handover(id: string, u: Subject | undefined, p: Principal): Promise<ZaloSlotView> {
    const slot = await this.load(id, u);
    if (!this.canManage(u)) throw new ForbiddenException('Chỉ Admin chuyển cách kết nối của nick.');
    if ((slot.mode ?? 'browser') !== 'browser') throw new ConflictException('Nick đã kết nối trực tiếp.');
    if (slot.state !== 'da_ket_noi' || !slot.uid) throw new ConflictException('Nick chưa kết nối xong: quét QR trước.');
    const r = await this.farm.handover(id);
    await this.markContentGone(slot.uid);
    const saved = await this.save(slot, { mode: 'direct', handoverAt: null, chromeKept: r.chromeKept });
    await this.db.audit(p.name, 'zalo.slot_handover', id, { uid: slot.uid, auto: false });
    return this.toView(saved, null, await this.names([saved]), u);
  }

  /** Admin: direct → Zalo Web again, while the Zalo Web profile is kept (7 days after the move). */
  async rollback(id: string, u: Subject | undefined, p: Principal): Promise<ZaloSlotView> {
    const slot = await this.load(id, u);
    if (!this.canManage(u)) throw new ForbiddenException('Chỉ Admin chuyển cách kết nối của nick.');
    if (slot.mode !== 'direct') throw new ConflictException('Nick đang chạy qua Zalo Web.');
    await this.farm.rollback(id);
    // Zalo Web can read the content again.
    if (slot.uid) await runUnscoped(() => this.db.col(C.messages).updateMany({ uid: slot.uid!, contentGone: true }, { $unset: { contentGone: '' } }));
    const saved = await this.save(slot, { mode: 'browser', chromeKept: false, state: 'dang_bat' });
    await this.db.audit(p.name, 'zalo.slot_rollback', id, { uid: slot.uid });
    return this.toView(saved, null, await this.names([saved]), u);
  }

  /** Asks the phone for older messages (Zalo's "Đồng bộ tin nhắn"); the holder then taps "Đồng bộ ngay". */
  async syncHistory(id: string, u: Subject | undefined, actor: string): Promise<ZaloSyncHistoryResult> {
    const slot = await this.load(id, u);
    if (slot.state !== 'da_ket_noi') throw new ForbiddenException('Nick chưa kết nối xong.');
    const r = await this.farm.syncHistory(id);
    await this.db.audit(actor, 'zalo.sync_history', id, { uid: slot.uid, requested: r.requested });
    return r.requested
      ? { requested: true, message: 'Đã gửi yêu cầu. Trên điện thoại của nick, bấm "Đồng bộ ngay" và chờ đồng bộ xong.' }
      : { requested: false, message: 'Chưa thấy nút đồng bộ trên Zalo Web của nick. Nhờ Admin mở màn hình máy Zalo để bấm "Đồng bộ tin nhắn".' };
  }

  /**
   * Admin (any nick) or the holder (his own nick): stop the nick on the farm and delete its profile / session (the Zalo
   * login is gone); history stays in VClinks. Connecting it again needs a new slot from an Admin.
   */
  async disconnect(id: string, u: Subject | undefined, p: Principal): Promise<{ ok: true }> {
    const slot = await this.load(id, u);
    if (!this.canDisconnect(slot, u)) throw new ForbiddenException('Chỉ Admin hoặc người giữ nick được ngắt kết nối nick này.');
    await this.farm.remove(id).catch((e) => {
      if (!(e instanceof NotFoundException)) throw e;
    });
    await this.save(slot, { state: 'da_ngat', disconnectedAt: new Date(), message: null });
    if (slot.uid) await runUnscoped(() => this.accounts.reportSession(slot.uid!, { state: 'lost', reason: 'cdp_down', source: 'may-zalo' }, p.name)).catch(() => undefined);
    await this.db.audit(p.name, 'zalo.disconnected', id, { uid: slot.uid, by: this.canManage(u) ? 'admin' : 'holder' });
    return { ok: true };
  }

  private async save(slot: ZaloSlotDoc, patch: Partial<ZaloSlotDoc>): Promise<ZaloSlotDoc> {
    const next = { ...slot, ...patch };
    const changed = (Object.keys(patch) as (keyof ZaloSlotDoc)[]).some((k) => String(slot[k]) !== String(next[k]));
    if (changed) await this.col().updateOne({ _id: slot._id }, { $set: patch });
    return next;
  }

  private async names(slots: ZaloSlotDoc[]) {
    const divisionIds = [...new Set(slots.map((s) => s.divisionId))];
    const userIds = [...new Set(slots.map((s) => s.holderUserId))];
    const [units, users] = await runUnscoped(() =>
      Promise.all([
        this.db.col<OrgUnitDoc>(ORG_C.orgUnits).find({ _id: { $in: divisionIds } as never }).toArray(),
        this.db.col<UserDoc>(C.users).find({ _id: { $in: userIds } as never }, { projection: { fullName: 1 } }).toArray(),
      ]),
    );
    return {
      division: new Map(units.map((x) => [String(x._id), x.name])),
      user: new Map(users.map((x) => [String(x._id), (x as unknown as { fullName: string }).fullName])),
    };
  }

  private toView(s: ZaloSlotDoc, qr: ZaloSlotView['qr'], names: Awaited<ReturnType<ZaloFarmService['names']>>, u: Subject | undefined): ZaloSlotView {
    return {
      id: s._id,
      label: s.label,
      mode: s.mode ?? 'browser',
      divisionId: s.divisionId,
      divisionName: names.division.get(s.divisionId) ?? null,
      holderUserId: s.holderUserId,
      holderName: names.user.get(s.holderUserId) ?? null,
      uid: s.uid,
      state: s.state,
      openUnread: !!s.openUnread,
      handoverAt: s.handoverAt ? s.handoverAt.toISOString() : null,
      chromeKept: (s.mode ?? 'browser') === 'direct' && !!s.chromeKept,
      canDisconnect: this.canDisconnect(s, u),
      qr,
      message: s.message,
      connectedAt: s.connectedAt ? s.connectedAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
