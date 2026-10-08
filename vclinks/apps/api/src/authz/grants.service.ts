import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import {
  COVER_MAX_DAYS,
  GRANT_BY_IDENTITY_MESSAGE,
  GRANT_RIGHTS,
  NO_ACCESS_TEXT,
  channelOfUid,
  coverCreatedMessage,
  coverSummaryText,
  fmtVnDateTime,
  type AccessGrantList,
  type AccessGrantRow,
  type CoverCreateInput,
  type CoverOptions,
  type GrantActionResult,
  type GrantTab,
  type LeaveRequestInput,
} from '@vclinks/shared';
import { C, DbService } from '../db/db.service';
import { runsBackgroundJobs } from '../db/role';
import { runAsTenant, runUnscoped } from '../db/tenant-context';
import { NotificationsService } from '../notifications/notifications.service';
import { AUTHZ_C, type AccessGrantDoc, type LeaveRequestDoc } from './authz.types';
import { AuthzService } from './authz.service';
import { effectivePermissions, type Subject } from './engine';

const HOUR = 3600_000;
const VN_OFFSET = 7 * HOUR;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
/** 00:00 of today in Asia/Ho_Chi_Minh ("đầu ngày làm việc hôm nay"; division calendars come later). */
const startOfDayVn = (now: Date) => {
  const l = new Date(now.getTime() + VN_OFFSET);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - VN_OFFSET);
};
const PERSONAL = (uid: string) => ['zalo', 'fb_personal'].includes(channelOfUid(uid));
/** Summary hour (QT-SZ-10 #6). */
const SUMMARY_HOUR_VN = 18;

type Grant = AccessGrantDoc;

/**
 * MH-PQ-07 (docs 01 §2.6, PQ-30…32, PQ-49, M1b-10): approve / reject / revoke temporary grants, covers
 * ("Trực thay": an access_grants row `truc_thay` per covered nick, which the engine turns into `NICK`),
 * leave requests, the "Tất cả trong phạm vi" view and the 18:00 cover summary. Audit lines carry ids,
 * never reasons or message text (CLAUDE.md §12.3).
 */
@Injectable()
export class GrantsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(GrantsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    private readonly notices: NotificationsService,
  ) {}

  private get grants() {
    return this.db.col<Grant>(AUTHZ_C.accessGrants);
  }
  private get leaves() {
    return this.db.col<LeaveRequestDoc>(AUTHZ_C.leaveRequests);
  }

  onApplicationBootstrap() {
    if (!runsBackgroundJobs() || process.env.GRANT_JOBS === 'off') return;
    this.timer = setInterval(() => void this.tick(), 5 * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Expiry and the 18:00 summary for every tenant. */
  async tick(now = new Date()) {
    try {
      for (const tenant of await this.db.tenants()) {
        await runAsTenant(tenant, async () => {
          await this.expire(now);
          await this.coverSummaries(now);
        });
      }
    } catch (e) {
      this.logger.warn(`Grant jobs failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Active grants past their end become `het_han` (the engine already ignores them). */
  async expire(now = new Date()): Promise<number> {
    const r = await runUnscoped(() => this.grants.updateMany({ status: 'hieu_luc', to: { $lte: now } }, { $set: { status: 'het_han' } }));
    if (r.modifiedCount) this.authz.invalidate();
    return r.modifiedCount;
  }

  // ---------- list ----------

  private perms(u: Subject) {
    return effectivePermissions(u);
  }

  /** Tabs the user sees (MH-PQ-07 #1, "Quyền trên màn hình"). */
  tabsOf(u: Subject): GrantTab[] {
    const p = this.perms(u);
    const tabs: GrantTab[] = [];
    if (p['grant.approve'] || p['grant.cover']) tabs.push('pending');
    tabs.push('mine');
    if (p['grant.cover'] || p['grant.approve']) tabs.push('cover', 'scope');
    if (p['grant.revoke']?.scopes.includes('TD')) tabs.push('all');
    return tabs;
  }

  async list(u: Subject, tab?: GrantTab, now = new Date()): Promise<AccessGrantList> {
    await this.expire(now);
    const tabs = this.tabsOf(u);
    const pendingCount =
      (await runUnscoped(() => this.grants.countDocuments({ status: 'cho_duyet', approverId: u.userId }))) +
      (await runUnscoped(() => this.leaves.countDocuments({ status: 'cho_duyet', approverId: u.userId })));
    const chosen: GrantTab = tab && tabs.includes(tab) ? tab : tabs.includes('pending') && pendingCount ? 'pending' : 'mine';
    let grants: Grant[] = [];
    let leaves: LeaveRequestDoc[] = [];
    await runUnscoped(async () => {
      switch (chosen) {
        case 'pending':
          grants = await this.grants.find({ status: 'cho_duyet', approverId: u.userId }).sort({ createdAt: -1 }).limit(200).toArray();
          leaves = await this.leaves.find({ status: 'cho_duyet', approverId: u.userId }).sort({ createdAt: -1 }).limit(200).toArray();
          break;
        case 'mine':
          grants = await this.grants.find({ $or: [{ userId: u.userId }, { requestedBy: u.userId }, { absentUserId: u.userId }] }).sort({ createdAt: -1 }).limit(200).toArray();
          leaves = await this.leaves.find({ userId: u.userId }).sort({ createdAt: -1 }).limit(50).toArray();
          break;
        case 'cover': {
          const rows = await this.grants.find({ type: 'truc_thay', status: 'hieu_luc' }).sort({ from: -1 }).limit(500).toArray();
          grants = [];
          for (const g of rows) if (await this.coverVisible(u, g)) grants.push(g);
          break;
        }
        case 'scope': {
          const rows = await this.grants.find({ type: { $ne: 'truc_thay' }, status: { $in: ['hieu_luc', 'het_han', 'thu_hoi', 'tu_choi', 'cho_duyet'] } }).sort({ createdAt: -1 }).limit(500).toArray();
          const scope = await this.authz.dataScope({ ...u, grants: [] });
          grants = rows.filter((g) => g.userId !== u.userId && (scope === null || scope.channels.includes(this.channelOf(g))));
          break;
        }
        case 'all':
          grants = await this.grants.find({}).sort({ createdAt: -1 }).limit(500).toArray();
          break;
      }
    });
    const items = [...(await Promise.all(grants.map((g) => this.row(u, g, chosen)))), ...(await Promise.all(leaves.map((l) => this.leaveRow(u, l))))].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    );
    return { tab: chosen, tabs, pendingCount, items };
  }

  private channelOf(g: Grant): string {
    if (g.targetType === 'channel' || g.targetType === 'account') return g.targetId;
    const i = g.targetId.indexOf(':');
    return i > 0 ? g.targetId.slice(0, i) : g.targetId;
  }

  private async targetFor(g: Grant) {
    const uid = this.channelOf(g);
    if (g.targetType === 'conversation') return this.authz.conversationTarget(uid, g.targetId.slice(uid.length + 1));
    return this.authz.channelTarget(uid);
  }

  private async coverVisible(u: Subject, g: Grant): Promise<boolean> {
    if ([g.userId, g.absentUserId, g.requestedBy].includes(u.userId)) return true;
    return (
      (await this.authz.canOnUser(u, 'grant.cover', g.absentUserId ?? g.userId)) ||
      (await this.authz.canOnUser(u, 'grant.revoke', g.absentUserId ?? g.userId))
    );
  }

  private async targetLabel(g: Grant, reveal: boolean): Promise<string> {
    if (!reveal) return g.targetId;
    return runUnscoped(async () => {
      if (g.targetType === 'conversation') {
        const c = await this.db.col(C.conversations).findOne({ _id: g.targetId as never }, { projection: { name: 1 } });
        if (typeof c?.name === 'string' && c.name.trim()) return c.name.trim();
        const k = await this.db.col(C.contacts).findOne({ _id: g.targetId as never }, { projection: { displayName: 1 } });
        return (k?.displayName as string) || g.targetId;
      }
      const a = await this.db.col(C.accounts).findOne({ _id: this.channelOf(g) as never }, { projection: { label: 1 } });
      return (a?.label as string) || g.targetId;
    });
  }

  private async row(u: Subject, g: Grant, tab: GrantTab): Promise<AccessGrantRow> {
    const names = await this.authz.userNames([g.userId, g.absentUserId, g.requestedBy, g.approverId, g.approvedBy]);
    const n = (id?: string | null) => (id ? names.get(id) : undefined);
    const isRequester = g.userId === u.userId || g.requestedBy === u.userId;
    const reveal = !isRequester || g.status === 'hieu_luc' || g.type === 'truc_thay';
    const canRevoke = g.status === 'hieu_luc' && (await this.mayRevoke(u, g));
    return {
      id: g._id,
      type: g.type,
      status: g.status,
      userId: g.userId,
      userName: n(g.userId) ?? g.userId,
      ...(g.absentUserId ? { absentUserId: g.absentUserId, absentUserName: n(g.absentUserId) } : {}),
      targetType: g.targetType,
      targetId: g.targetId,
      targetLabel: await this.targetLabel(g, reveal),
      rights: g.rights,
      ...(g.durationHours ? { durationHours: g.durationHours } : {}),
      ...(g.from ? { from: g.from.toISOString() } : {}),
      ...(g.to ? { to: g.to.toISOString() } : {}),
      // The reason is shown to the people deciding and to the requester, never in logs.
      reason: g.reason,
      requestedByName: n(g.requestedBy),
      ...(g.approverId ? { approverName: n(g.approverId) } : {}),
      ...(g.approvedBy ? { approvedByName: n(g.approvedBy) } : {}),
      createdAt: (g.createdAt ?? g.approvedAt ?? g.from ?? new Date(0)).toISOString(),
      canApprove: g.status === 'cho_duyet' && tab === 'pending' && !isRequester,
      canReject: g.status === 'cho_duyet' && tab === 'pending' && !isRequester,
      canCancel: g.status === 'cho_duyet' && g.requestedBy === u.userId,
      canRevoke: canRevoke && g.type !== 'truc_thay',
      canEnd: g.type === 'truc_thay' && g.status === 'hieu_luc' && (g.requestedBy === u.userId || canRevoke || (await this.authz.canOnUser(u, 'grant.cover', g.absentUserId ?? g.userId))),
      canReviewRequest: tab === 'scope' && g.status === 'hieu_luc' && !canRevoke && !!g.approvedBy && g.approvedBy !== u.userId,
    };
  }

  private async leaveRow(u: Subject, l: LeaveRequestDoc): Promise<AccessGrantRow> {
    const names = await this.authz.userNames([l.userId, l.approverId, l.proposedCoverId]);
    return {
      id: l._id,
      type: 'dang_ky_vang',
      status: l.status === 'cho_duyet' ? 'cho_duyet' : l.status === 'dong_y' ? 'hieu_luc' : 'tu_choi',
      userId: l.userId,
      userName: names.get(l.userId) ?? l.userId,
      absentUserId: l.userId,
      absentUserName: names.get(l.userId),
      targetType: 'user',
      targetId: l.userId,
      targetLabel: names.get(l.userId) ?? l.userId,
      rights: [],
      from: l.from.toISOString(),
      to: l.to.toISOString(),
      reason: l.reason,
      ...(l.approverId ? { approverName: names.get(l.approverId) } : {}),
      createdAt: l.createdAt.toISOString(),
      proposedCoverId: l.proposedCoverId ?? null,
      proposedCoverName: l.proposedCoverId ? (names.get(l.proposedCoverId) ?? null) : null,
      canApprove: l.status === 'cho_duyet' && l.approverId === u.userId,
      canReject: l.status === 'cho_duyet' && l.approverId === u.userId,
      canCancel: l.status === 'cho_duyet' && l.userId === u.userId,
    };
  }

  // ---------- decide on requests ----------

  private async load(id: string): Promise<Grant> {
    const g = await runUnscoped(() => this.grants.findOne({ _id: id }));
    if (!g) throw new NotFoundException('Không tìm thấy yêu cầu.');
    return g;
  }

  /**
   * "Duyệt" (PQ-30, PQ-31): the computed approver, or a manager whose grant.approve covers the target;
   * never the requester; the approver must see the target himself; the duration may only shrink.
   */
  async approve(u: Subject, id: string, durationHours?: number, now = new Date()): Promise<GrantActionResult> {
    const g = await this.load(id);
    if (g.status !== 'cho_duyet') throw new ConflictException('Yêu cầu không còn chờ duyệt.');
    if (g.userId === u.userId || g.requestedBy === u.userId) throw new ForbiddenException('Không tự duyệt yêu cầu của mình.');
    const target = await this.targetFor(g);
    const byRole = this.authz.decide(u, 'grant.approve', target).allowed;
    if (g.approverId !== u.userId && !byRole) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('grant.approve'));
    if (!this.authz.decide({ ...u, grants: [] }, 'conv.view', target).allowed) {
      throw new ForbiddenException('Bạn không có quyền này nên không duyệt được (không cấp quá quyền mình có).');
    }
    const asked = g.durationHours ?? 24;
    const hours = Math.min(durationHours ?? asked, asked);
    const to = new Date(now.getTime() + hours * HOUR);
    const r = await runUnscoped(() =>
      this.grants.updateOne({ _id: id, status: 'cho_duyet' }, { $set: { status: 'hieu_luc', from: now, to, approvedBy: u.userId, approvedAt: now, durationHours: hours } }),
    );
    if (!r.modifiedCount) throw new ConflictException('Yêu cầu không còn chờ duyệt.');
    this.authz.invalidate();
    await this.db.audit(`user:${u.userId}`, 'grant.approve', g.targetId, { grantId: id, userId: g.userId, hours });
    const names = await this.authz.userNames([g.userId, u.userId]);
    await this.notices.notify([g.userId], 'grant.approved', `Yêu cầu quyền của bạn đã được duyệt tới ${fmtVnDateTime(to)}.`, '/admin/access-requests?tab=mine');
    // §2.6 last rule: managers of the target's team learn about it in one line (UAT-PQ-85).
    const managers = (await this.authz.managersOver(this.channelOf(g))).filter((m) => m !== u.userId && m !== g.userId);
    await this.notices.notify(
      managers,
      'grant.in_scope',
      `${names.get(u.userId)} đã duyệt cho ${names.get(g.userId)} quyền tạm thời trong phạm vi của bạn tới ${fmtVnDateTime(to)}.`,
      '/admin/access-requests?tab=scope',
    );
    return { message: `Đã duyệt yêu cầu của ${names.get(g.userId)}.`, id };
  }

  async reject(u: Subject, id: string, reason: string): Promise<GrantActionResult> {
    const leave = await runUnscoped(() => this.leaves.findOne({ _id: id }));
    if (leave) return this.rejectLeave(u, leave, reason);
    const g = await this.load(id);
    if (g.status !== 'cho_duyet') throw new ConflictException('Yêu cầu không còn chờ duyệt.');
    if (g.userId === u.userId) throw new ForbiddenException('Không tự xử lý yêu cầu của mình.');
    if (g.approverId !== u.userId && !this.authz.decide(u, 'grant.approve', await this.targetFor(g)).allowed) {
      throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('grant.approve'));
    }
    await runUnscoped(() => this.grants.updateOne({ _id: id, status: 'cho_duyet' }, { $set: { status: 'tu_choi', approvedBy: u.userId, approvedAt: new Date(), rejectReason: reason } }));
    await this.db.audit(`user:${u.userId}`, 'grant.reject', g.targetId, { grantId: id });
    const names = await this.authz.userNames([g.userId]);
    await this.notices.notify([g.userId], 'grant.rejected', 'Yêu cầu quyền của bạn đã bị từ chối. Xem lý do ở Quyền tạm thời.', '/admin/access-requests?tab=mine');
    return { message: `Đã từ chối yêu cầu của ${names.get(g.userId)}.`, id };
  }

  /** "Hủy yêu cầu" (tab Của tôi): only the requester, only while waiting. The row stays for the log. */
  async cancel(u: Subject, id: string): Promise<GrantActionResult> {
    const leave = await runUnscoped(() => this.leaves.findOne({ _id: id }));
    if (leave) {
      if (leave.userId !== u.userId) throw new ForbiddenException(NO_ACCESS_TEXT.api);
      const r = await runUnscoped(() => this.leaves.updateOne({ _id: id, status: 'cho_duyet' }, { $set: { status: 'huy' } }));
      if (!r.modifiedCount) throw new ConflictException('Yêu cầu không còn chờ duyệt.');
      await this.db.audit(`user:${u.userId}`, 'leave.cancel', id);
      return { message: 'Đã hủy yêu cầu.', id };
    }
    const g = await this.load(id);
    if (g.requestedBy !== u.userId) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    const r = await runUnscoped(() => this.grants.updateOne({ _id: id, status: 'cho_duyet' }, { $set: { status: 'thu_hoi', revokedBy: u.userId, revokedAt: new Date() } }));
    if (!r.modifiedCount) throw new ConflictException('Yêu cầu không còn chờ duyệt.');
    await this.db.audit(`user:${u.userId}`, 'grant.cancel', g.targetId, { grantId: id });
    return { message: 'Đã hủy yêu cầu.', id };
  }

  /** grant.revoke: TĐ (admin) any; DV in the division; TỔ only grants he approved himself (§3.6). */
  private async mayRevoke(u: Subject, g: Grant): Promise<boolean> {
    const d = this.authz.decide(u, 'grant.revoke', await this.targetFor(g));
    if (!d.allowed) return false;
    if (d.via === 'TO') return g.approvedBy === u.userId || g.requestedBy === u.userId;
    return true;
  }

  async revoke(u: Subject, id: string, now = new Date()): Promise<GrantActionResult> {
    const g = await this.load(id);
    if (g.status !== 'hieu_luc') throw new ConflictException('Quyền này không còn hiệu lực.');
    if (!(await this.mayRevoke(u, g))) throw new ForbiddenException('Bạn không thu hồi được quyền do cấp trên duyệt; hãy bấm "Đề nghị xem lại".');
    await runUnscoped(() => this.grants.updateOne({ _id: id, status: 'hieu_luc' }, { $set: { status: 'thu_hoi', revokedBy: u.userId, revokedAt: now, to: now } }));
    this.authz.invalidate();
    await this.db.audit(`user:${u.userId}`, 'grant.revoke', g.targetId, { grantId: id });
    const names = await this.authz.userNames([g.userId]);
    return { message: `Đã thu hồi quyền của ${names.get(g.userId)}.`, id };
  }

  /** "Đề nghị xem lại" (§2.6): a manager of the target asks the approver to look again. */
  async reviewRequest(u: Subject, id: string): Promise<GrantActionResult> {
    const g = await this.load(id);
    if (!g.approvedBy || g.status !== 'hieu_luc') throw new ConflictException('Quyền này không còn hiệu lực.');
    const scope = await this.authz.dataScope({ ...u, grants: [] });
    if (scope !== null && !scope.channels.includes(this.channelOf(g))) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    const names = await this.authz.userNames([u.userId, g.userId, g.approvedBy]);
    await this.notices.notify(
      [g.approvedBy],
      'grant.review_request',
      `${names.get(u.userId)} đề nghị xem lại quyền tạm thời của ${names.get(g.userId)}.`,
      '/admin/access-requests?tab=scope',
    );
    await this.db.audit(`user:${u.userId}`, 'grant.review_request', g.targetId, { grantId: id });
    return { message: `Đã gửi đề nghị xem lại tới ${names.get(g.approvedBy)}.`, id };
  }

  /**
   * "Xin quyền theo SĐT / mã KH" (PQ-49, UAT-PQ-71): match on the raw data; when a conversation of that
   * customer exists outside the requester's scope, file a request to its PQ-30 approver. The answer is the
   * same whether or not anything matched, and never names the approver.
   */
  async requestByIdentity(u: Subject, input: { query: string; right: (typeof GRANT_RIGHTS)[number]; durationHours: number; reason: string }): Promise<GrantActionResult> {
    const digits = input.query.replace(/\D/g, '');
    const tail = digits.length >= 9 ? digits.slice(-9) : null;
    const contact = await runUnscoped(async () => {
      const or: Record<string, unknown>[] = [{ customerCode: input.query.trim() }];
      if (tail) or.push({ phone: { $regex: `${tail}$` } });
      return this.db.col<{ _id: string; uid: string; userId: string }>(C.contacts).findOne({ $or: or } as never, { projection: { uid: 1, userId: 1 } });
    });
    if (contact) {
      const conversationId = `${contact.uid}:${contact.userId}`;
      const exists = await runUnscoped(() => this.db.col(C.conversations).countDocuments({ _id: conversationId as never }, { limit: 1 }));
      const target = await this.authz.conversationTarget(contact.uid, contact.userId);
      const sees = this.authz.decide(u, 'conv.view', target).allowed;
      const approver = exists && !sees ? await this.authz.grantApprover(u.userId, contact.uid) : null;
      const dup = await runUnscoped(() => this.grants.countDocuments({ userId: u.userId, targetId: conversationId, status: 'cho_duyet' }, { limit: 1 }));
      if (approver && !dup) {
        const right = input.right === 'tra_loi' && PERSONAL(contact.uid) ? 'ghi_chu' : input.right;
        const id = newId('grant');
        await runUnscoped(() =>
          this.grants.insertOne({
            _id: id,
            userId: u.userId,
            type: 'xem_ngoai_pham_vi',
            targetType: 'conversation',
            targetId: conversationId,
            rights: GRANT_RIGHTS.slice(0, GRANT_RIGHTS.indexOf(right) + 1),
            reason: input.reason,
            requestedBy: u.userId,
            status: 'cho_duyet',
            approverId: approver.userId,
            durationHours: input.durationHours,
            createdAt: new Date(),
          }),
        );
        await this.notices.notify([approver.userId], 'grant.pending', 'Có yêu cầu quyền chờ duyệt.', '/admin/access-requests?tab=pending');
        await this.db.audit(`user:${u.userId}`, 'grant.request', conversationId, { grantId: id, approverId: approver.userId, via: 'identity' });
      }
    }
    // Same answer in every case (PQ-49): nothing reveals whether the customer exists.
    return { message: GRANT_BY_IDENTITY_MESSAGE };
  }

  // ---------- covers ----------

  async coverOptions(u: Subject, absentUserId?: string): Promise<CoverOptions> {
    const users = await runUnscoped(() =>
      this.db.col<{ _id: string; fullName: string; status: string }>(C.users).find({ status: 'hoat_dong' }, { projection: { fullName: 1 } }).toArray(),
    );
    const inScope: { id: string; name: string }[] = [];
    for (const x of users) if (await this.authz.canOnUser(u, 'grant.cover', x._id)) inScope.push({ id: x._id, name: x.fullName });
    const nicks = absentUserId ? await this.authz.heldNicks(absentUserId) : [];
    const labels = await runUnscoped(() => this.db.col<{ _id: string; label?: string }>(C.accounts).find({ _id: { $in: nicks as never[] } }, { projection: { label: 1 } }).toArray());
    const me = users.find((x) => x._id === u.userId);
    const candidates = [...inScope, ...(me && !inScope.some((x) => x.id === me._id) ? [{ id: me._id, name: me.fullName }] : [])].filter((x) => x.id !== absentUserId);
    return {
      absentees: inScope.filter((x) => x.id !== u.userId),
      nicks: nicks.map((uid) => ({ uid, label: labels.find((l) => l._id === uid)?.label ?? uid })),
      candidates,
    };
  }

  /**
   * "Tạo trực thay" / "Đồng ý" a leave request (PQ-32, MH-PQ-07 #4–#6): one cover per nick the absent
   * person holds, ≤ 30 days, "Từ" back to the start of today at most (backdating needs a reason and only
   * affects reports: rights start now), no overlap with another cover of the same person, and a cover
   * person who is not himself covered.
   */
  async createCover(u: Subject, input: CoverCreateInput, now = new Date()): Promise<GrantActionResult> {
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (!(to > from)) throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu.');
    if (to.getTime() - from.getTime() > COVER_MAX_DAYS * 24 * HOUR) throw new BadRequestException('Trực thay tối đa 30 ngày.');
    if (to <= now) throw new BadRequestException('Thời gian kết thúc đã qua.');
    if (from < startOfDayVn(now)) throw new BadRequestException('Chỉ lùi được tới đầu ngày làm việc hôm nay.');
    const backdated = from.getTime() < now.getTime() - 60_000;
    if (backdated && !input.backdateReason) throw new BadRequestException('Lùi thời gian bắt đầu cần lý do hồi tố (10–300 ký tự).');
    if (input.absentUserId === u.userId) throw new BadRequestException('Không tạo trực thay cho chính mình; hãy gửi Đăng ký vắng.');
    if (!(await this.authz.canOnUser(u, 'grant.cover', input.absentUserId))) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('grant.cover'));
    const leave = input.leaveRequestId ? await runUnscoped(() => this.leaves.findOne({ _id: input.leaveRequestId })) : null;
    if (input.leaveRequestId && (!leave || leave.status !== 'cho_duyet' || leave.userId !== input.absentUserId)) throw new ConflictException('Đăng ký vắng không còn chờ duyệt.');
    const held = await this.authz.heldNicks(input.absentUserId);
    const byNick = new Map(input.covers.map((c) => [c.uid, c.userId]));
    for (const uid of held) if (!byNick.get(uid)) throw new BadRequestException('Chọn người trực cho mọi nick người vắng đang giữ.');
    for (const uid of byNick.keys()) if (!held.includes(uid)) throw new BadRequestException('Người vắng không giữ nick này.');
    const names = await this.authz.userNames([input.absentUserId, ...byNick.values()]);
    const effFrom = backdated ? now : from;
    for (const coverId of new Set(byNick.values())) {
      if (coverId === input.absentUserId) throw new BadRequestException('Người trực phải khác người vắng.');
      const user = await runUnscoped(() => this.db.col<{ status: string }>(C.users).findOne({ _id: coverId as never }, { projection: { status: 1 } }));
      if (user?.status !== 'hoat_dong') throw new BadRequestException(`${names.get(coverId)} không ở trạng thái hoạt động.`);
      if (coverId !== u.userId && !(await this.authz.canOnUser(u, 'grant.cover', coverId))) throw new ForbiddenException(`${names.get(coverId)} ngoài phạm vi của bạn.`);
      const coveredHimself = await runUnscoped(() =>
        this.grants.countDocuments({ type: 'truc_thay', status: 'hieu_luc', absentUserId: coverId, from: { $lt: to }, to: { $gt: effFrom } }, { limit: 1 }),
      );
      if (coveredHimself) throw new BadRequestException('Người này đang được trực thay, không nhận trực được.');
    }
    const overlap = await runUnscoped(() =>
      this.grants.countDocuments({ type: 'truc_thay', status: 'hieu_luc', absentUserId: input.absentUserId, from: { $lt: to }, to: { $gt: effFrom } }, { limit: 1 }),
    );
    if (overlap) throw new ConflictException(`${names.get(input.absentUserId)} đã có trực thay trong khoảng này.`);
    if (!held.length) throw new BadRequestException(`${names.get(input.absentUserId)} không giữ nick nào; trực nhóm khách chưa có ở bản này.`);
    const ids: string[] = [];
    for (const [uid, coverId] of byNick) {
      const id = newId('cover');
      ids.push(id);
      await runUnscoped(() =>
        this.grants.insertOne({
          _id: id,
          userId: coverId,
          type: 'truc_thay',
          targetType: 'channel',
          targetId: uid,
          rights: [...GRANT_RIGHTS],
          from: effFrom,
          to,
          reason: leave?.reason ?? input.backdateReason ?? 'Trực thay',
          requestedBy: u.userId,
          approvedBy: u.userId,
          approvedAt: now,
          status: 'hieu_luc',
          absentUserId: input.absentUserId,
          createdAt: now,
          ...(leave ? { leaveRequestId: leave._id } : {}),
          ...(backdated ? { backdateReason: input.backdateReason, backdateFrom: from } : {}),
        } as Grant),
      );
      await this.db.audit(`user:${u.userId}`, 'grant.cover', uid, { grantId: id, coverId, absentUserId: input.absentUserId, from: effFrom, to });
      if (backdated) await this.db.audit(`user:${u.userId}`, 'grant.cover.backdate', uid, { grantId: id, from });
    }
    this.authz.invalidate();
    const coverNames = [...new Set(byNick.values())].map((c) => names.get(c)).join(', ');
    const absentName = names.get(input.absentUserId)!;
    const nickLabels = await runUnscoped(() => this.db.col<{ _id: string; label?: string }>(C.accounts).find({ _id: { $in: [...byNick.keys()] as never[] } }, { projection: { label: 1 } }).toArray());
    const nickText = nickLabels.map((n) => n.label ?? n._id).join(', ');
    await this.notices.notify([...byNick.values()], 'cover.assigned', `Bạn trực thay ${absentName} (nick ${nickText}) từ ${fmtVnDateTime(effFrom)} đến ${fmtVnDateTime(to)}.`, '/conversations');
    if (leave) {
      await runUnscoped(() => this.leaves.updateOne({ _id: leave._id }, { $set: { status: 'dong_y', decidedBy: u.userId, decidedAt: now } }));
      const me = await this.authz.userNames([u.userId]);
      await this.notices.notify(
        [leave.userId],
        'leave.approved',
        `${me.get(u.userId)} đã đồng ý đăng ký vắng. ${coverNames} trực nick ${nickText} từ ${fmtVnDateTime(effFrom)} đến ${fmtVnDateTime(to)}.`,
        '/admin/access-requests?tab=mine',
      );
      await this.db.audit(`user:${u.userId}`, 'leave.approve', leave._id, { grantIds: ids });
    } else {
      await this.notices.notify([input.absentUserId], 'cover.created', `${coverNames} trực nick ${nickText} thay bạn từ ${fmtVnDateTime(effFrom)} đến ${fmtVnDateTime(to)}.`);
    }
    return { message: coverCreatedMessage(coverNames, absentName, effFrom, to), id: ids[0] };
  }

  /** "Kết thúc sớm": the creator of the cover or a manager of the absent person (all nicks of that cover). */
  async endCover(u: Subject, id: string, now = new Date()): Promise<GrantActionResult> {
    const g = await this.load(id);
    if (g.type !== 'truc_thay' || g.status !== 'hieu_luc') throw new ConflictException('Trực thay không còn hiệu lực.');
    const ok = g.requestedBy === u.userId || (await this.authz.canOnUser(u, 'grant.cover', g.absentUserId ?? g.userId)) || (await this.mayRevoke(u, g));
    if (!ok) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('grant.cover'));
    await runUnscoped(() =>
      this.grants.updateMany(
        { type: 'truc_thay', status: 'hieu_luc', absentUserId: g.absentUserId, requestedBy: g.requestedBy, from: g.from, to: g.to },
        { $set: { status: 'thu_hoi', revokedBy: u.userId, revokedAt: now, to: now } },
      ),
    );
    this.authz.invalidate();
    await this.db.audit(`user:${u.userId}`, 'grant.cover.end', g.targetId, { grantId: id });
    return { message: 'Đã kết thúc trực thay.', id };
  }

  // ---------- leave requests ----------

  /** People a leave request may propose as cover: active colleagues of the same units. */
  async leaveCandidates(u: Subject): Promise<{ id: string; name: string }[]> {
    const mine = new Set(await this.authz.unitsOf(u.userId));
    const rows = await runUnscoped(() => this.db.col<{ userId: string; orgUnitId: string }>('role_assignments').find({ orgUnitId: { $in: [...mine] } }).toArray());
    const ids = [...new Set(rows.map((r) => r.userId))].filter((x) => x !== u.userId);
    const users = await runUnscoped(() => this.db.col<{ _id: string; fullName: string }>(C.users).find({ _id: { $in: ids as never[] }, status: 'hoat_dong' }, { projection: { fullName: 1 } }).toArray());
    return users.map((x) => ({ id: x._id, name: x.fullName })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  async requestLeave(u: Subject, input: LeaveRequestInput, now = new Date()): Promise<GrantActionResult> {
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (!(to > from)) throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu.');
    if (to.getTime() - from.getTime() > COVER_MAX_DAYS * 24 * HOUR) throw new BadRequestException('Trực thay tối đa 30 ngày.');
    if (from < startOfDayVn(now)) throw new BadRequestException('Chỉ lùi được tới đầu ngày làm việc hôm nay.');
    if (from.getTime() < now.getTime() - 60_000 && !input.backdateReason) throw new BadRequestException('Lùi thời gian bắt đầu cần lý do hồi tố (10–300 ký tự).');
    const dup = await runUnscoped(() => this.leaves.countDocuments({ userId: u.userId, status: 'cho_duyet', from: { $lt: to }, to: { $gt: from } }, { limit: 1 }));
    if (dup) throw new ConflictException('Bạn đã có đăng ký vắng chờ duyệt trong khoảng này.');
    const approverId = await this.authz.supervisorOf(u.userId);
    if (!approverId) throw new BadRequestException('Chưa có giám sát hoặc giám đốc để duyệt. Liên hệ quản trị viên.');
    const id = newId('leave');
    await runUnscoped(() =>
      this.leaves.insertOne({
        _id: id,
        userId: u.userId,
        from,
        to,
        reason: input.reason,
        proposedCoverId: input.proposedCoverId ?? null,
        ...(input.note ? { note: input.note } : {}),
        ...(input.backdateReason ? { backdateReason: input.backdateReason } : {}),
        approverId,
        status: 'cho_duyet',
        createdAt: now,
      }),
    );
    await this.db.audit(`user:${u.userId}`, 'leave.request', id, { approverId });
    await this.notices.notify([approverId], 'leave.pending', 'Có đăng ký vắng chờ bạn duyệt.', '/admin/access-requests?tab=pending');
    const names = await this.authz.userNames([approverId]);
    return { message: `Đã gửi đăng ký vắng tới ${names.get(approverId)}.`, id };
  }

  private async rejectLeave(u: Subject, l: LeaveRequestDoc, reason: string): Promise<GrantActionResult> {
    if (l.status !== 'cho_duyet') throw new ConflictException('Yêu cầu không còn chờ duyệt.');
    if (l.approverId !== u.userId && !(await this.authz.canOnUser(u, 'grant.cover', l.userId))) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('grant.cover'));
    await runUnscoped(() => this.leaves.updateOne({ _id: l._id }, { $set: { status: 'tu_choi', decidedBy: u.userId, decidedAt: new Date(), rejectReason: reason } }));
    await this.db.audit(`user:${u.userId}`, 'leave.reject', l._id);
    await this.notices.notify([l.userId], 'leave.rejected', 'Đăng ký vắng của bạn đã bị từ chối. Xem lý do ở Quyền tạm thời.', '/admin/access-requests?tab=mine');
    const names = await this.authz.userNames([l.userId]);
    return { message: `Đã từ chối yêu cầu của ${names.get(l.userId)}.`, id: l._id };
  }

  /** "Nghỉ phép" flag (SZ-27): the current or next cover where the user is the absent person. */
  async leaveOf(userId: string, now = new Date()): Promise<{ from: string; to: string; coverName: string; active: boolean } | null> {
    const g = await runUnscoped(() =>
      this.grants.find({ type: 'truc_thay', status: 'hieu_luc', absentUserId: userId, to: { $gt: now } }).sort({ from: 1 }).limit(1).next(),
    );
    if (!g?.from || !g.to) return null;
    const names = await this.authz.userNames([g.userId]);
    return { from: g.from.toISOString(), to: g.to.toISOString(), coverName: names.get(g.userId) ?? g.userId, active: g.from <= now };
  }

  /**
   * People on leave right now (SZ-27 a: "Chia đều" skips them; b: notices for the holder go to the
   * cover). Map absent user → cover user per nick.
   */
  async onLeave(now = new Date()): Promise<Map<string, { coverId: string; uid: string }[]>> {
    const rows = await runUnscoped(() => this.grants.find({ type: 'truc_thay', status: 'hieu_luc', from: { $lte: now }, to: { $gt: now } }).toArray());
    const out = new Map<string, { coverId: string; uid: string }[]>();
    for (const g of rows) if (g.absentUserId) (out.get(g.absentUserId) ?? out.set(g.absentUserId, []).get(g.absentUserId)!).push({ coverId: g.userId, uid: g.targetId });
    return out;
  }

  /**
   * 18:00 summary (QT-SZ-10 #6): once a day per absent person and nick while a cover runs, counting
   * today's conversations answered by the cover on that nick and his phone reveals there.
   */
  async coverSummaries(now = new Date()): Promise<number> {
    const local = new Date(now.getTime() + VN_OFFSET);
    if (local.getUTCHours() < SUMMARY_HOUR_VN) return 0;
    const dayStart = startOfDayVn(now);
    const rows = await runUnscoped(() => this.grants.find({ type: 'truc_thay', status: 'hieu_luc', from: { $lte: now }, to: { $gt: dayStart } }).toArray());
    let sent = 0;
    for (const g of rows) {
      if (!g.absentUserId) continue;
      const kind = `cover.summary:${g.targetId}`;
      if (await this.notices.sentSince(g.absentUserId, kind, dayStart)) continue;
      const threads = await runUnscoped(() =>
        this.db.col(C.suggestions).distinct('threadId', { uid: g.targetId, approvedBy: g.userId, sendSource: 'truc_thay', createdAt: { $gte: dayStart } }),
      );
      const reveals = await runUnscoped(() =>
        this.db.col(C.auditLog).countDocuments({ actor: `user:${g.userId}`, action: 'phone.reveal', target: { $regex: `^${g.targetId}:` }, at: { $gte: dayStart } }),
      );
      const names = await this.authz.userNames([g.userId]);
      const nick = await runUnscoped(() => this.db.col<{ _id: string; label?: string }>(C.accounts).findOne({ _id: g.targetId as never }, { projection: { label: 1 } }));
      await this.notices.notify([g.absentUserId], kind, coverSummaryText(names.get(g.userId)!, nick?.label ?? g.targetId, threads.length, reveals), '/outbox?filter=on_behalf');
      sent++;
    }
    return sent;
  }
}
