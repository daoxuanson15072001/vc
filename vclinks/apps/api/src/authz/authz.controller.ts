import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Optional, Param, Post, Query } from '@nestjs/common';
import {
  CHANNEL_ACCESS_LEVELS,
  NO_ACCESS_TEXT,
  GRANT_RIGHTS,
  PERMISSION_INFO,
  PERMISSION_KEYS,
  SCOPE_LABELS,
  channelOfUid,
  grantRequestInputSchema,
  findContactsInText,
  revealInputSchema,
  revealMessageInputSchema,
  type ConversationAccess,
  type EffectiveRightsResponse,
  type GrantApproverView,
  type GrantRequestInput,
  type MePermissions,
} from '@vclinks/shared';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { C, DbService } from '../db/db.service';
import { runUnscoped } from '../db/tenant-context';
import { explainRights, userFullName } from './effective-rights';
import { MessageVault } from '../security/message-vault';
import { NotificationsService } from '../notifications/notifications.service';
import { CustomRolesService } from '../org/custom-roles.service';
import { AlertsService } from '../audit/alerts.service';
import { AUTHZ_C, type AccessGrantDoc } from './authz.types';
import { AuthzService } from './authz.service';
import { CurrentSubject } from './authz.guard';
import { decide, type Subject } from './engine';

const CHANNEL_PERSONAL = (uid: string) => ['zalo', 'fb_personal'].includes(channelOfUid(uid));

@Controller()
export class AuthzController {
  constructor(
    private readonly authz: AuthzService,
    private readonly db: DbService,
    private readonly alerts: AlertsService,
    private readonly customRoles: CustomRolesService,
    @Optional() private readonly vault?: MessageVault,
    @Optional() private readonly notices?: NotificationsService,
  ) {}

  /** Effective permissions of the signed-in user (docs 01 §2.4: the UI reads this, D8-02). */
  @Get('me/permissions')
  me(@CurrentPrincipal() p: Principal): Promise<MePermissions> {
    return this.authz.me(p);
  }

  /** System roles, then custom roles (MH-PQ-05), with their matrix rows. */
  @Get('admin/roles')
  async roles() {
    return {
      scopes: SCOPE_LABELS,
      channelAccessLevels: CHANNEL_ACCESS_LEVELS,
      keys: PERMISSION_KEYS.map((key) => ({ key, ...PERMISSION_INFO[key] })),
      roles: await this.customRoles.columns(),
    };
  }

  /**
   * "Hiện" on a masked phone (MH-PQ-12): full number when cust.phone_full shows it on the identity's
   * channel (always or after a click). Every call writes `phone.reveal` without the number (PQ-37, PQ-38).
   */
  @Post('reveal')
  @HttpCode(200)
  async reveal(@Body() body: unknown, @CurrentSubject() u: Subject | undefined, @CurrentPrincipal() p: Principal) {
    const input = parseOr400(revealInputSchema, body);
    if (!u && !this.authz.legacyAllowed(p)) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    const vis = u ? await this.authz.phoneOn(u, input.uid) : 'full';
    if (vis === 'masked') throw new ForbiddenException(NO_ACCESS_TEXT.api);
    // Read through the request's data scope: an identity outside it is "not found".
    const c = await this.db
      .col<{ _id: string; phone?: string | null }>(C.contacts)
      .findOne({ _id: `${input.uid}:${input.userId}` as never }, { projection: { phone: 1 } });
    if (!c) throw new NotFoundException(NO_ACCESS_TEXT.api);
    await this.db.audit(u ? `user:${u.userId}` : `token:${p.name}`, 'phone.reveal', `${input.uid}:${input.userId}`, {
      action: input.action,
      where: input.where ?? null,
      via: vis,
    });
    // Too many reveals raise an alert for the managers; the person only gets this warning (UAT-PQ-28).
    const warning = u ? await this.alerts.warningFor(u.userId, 'R1') : null;
    return { phone: c.phone ?? null, ...(warning ? { warning } : {}) };
  }

  /**
   * "Hiện" on a masked number or email typed inside a message (L-02). Same rule as `reveal`: only a viewer
   * whose role may see the phone on that channel (always or after a click). The audit line has the message id
   * and the position, never the value.
   */
  @Post('reveal/message')
  @HttpCode(200)
  async revealInMessage(@Body() body: unknown, @CurrentSubject() u: Subject | undefined, @CurrentPrincipal() p: Principal) {
    const input = parseOr400(revealMessageInputSchema, body);
    if (!u && !this.authz.legacyAllowed(p)) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    // Read through the request's data scope: a message outside it is "not found".
    const m = await this.db.col<{ _id: string; uid: string; threadId: string; text?: string; sealed?: unknown }>(C.messages).findOne({ _id: input.messageId as never });
    if (!m) throw new NotFoundException(NO_ACCESS_TEXT.api);
    // The channel scope is not enough: the conversation itself must be one the user may open (conv.view).
    if (u && !decide(u, 'conv.view', await this.authz.conversationTarget(m.uid, m.threadId)).allowed) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    const vis = u ? await this.authz.phoneOn(u, m.uid) : 'full';
    if (vis === 'masked') throw new ForbiddenException(NO_ACCESS_TEXT.api);
    if (this.vault) await this.vault.open([m]);
    const hit = findContactsInText(m.text)[input.index];
    if (!hit) throw new NotFoundException('Không có số hoặc email thứ tự này trong tin nhắn');
    await this.db.audit(u ? `user:${u.userId}` : `token:${p.name}`, hit.kind === 'phone' ? 'phone.reveal' : 'email.reveal', input.messageId, {
      action: input.action,
      where: input.where ?? 'message',
      via: vis,
      kind: 'message_text',
    });
    const warning = u ? await this.alerts.warningFor(u.userId, 'R1') : null;
    return { value: hit.value, kind: hit.kind, ...(warning ? { warning } : {}) };
  }

  /**
   * Tab "Quyền hiệu lực" of MH-PQ-03 (L-01, PQ-09, PQ-70): why a user does or does not see a customer or
   * conversation. Looks the target up by conversation id, name or phone and answers ✔/✖ with the reason;
   * no message content and no phone number ever come back. Every call is logged as `permission.explain`.
   */
  @Get('admin/users/:id/effective')
  async effective(@Param('id') id: string, @Query('target') target: string | undefined, @CurrentPrincipal() p: Principal, @CurrentSubject() me: Subject | undefined): Promise<EffectiveRightsResponse> {
    const fullName = await userFullName(this.db, id);
    if (!fullName) throw new NotFoundException('Không tìm thấy người dùng');
    const text = (target ?? '').slice(0, 200);
    const out = await explainRights(this.authz, this.db, await this.authz.subject(id), text, me);
    await this.db.audit(me ? `user:${me.userId}` : `token:${p.name}`, 'permission.explain', id, { targets: out.results.map((r) => r.conversationId), searched: text.length > 0 });
    return { userId: id, fullName, ...out };
  }

  /** What the user may do in one conversation (compose box or "chỉ xem", D8-02). The guard already refused foreign ones. */
  @Get('conversations/:id/access')
  access(@Param('id') id: string, @CurrentPrincipal() p: Principal): Promise<ConversationAccess> {
    return this.authz.conversationAccess(p, id);
  }

  /** Approver shown in "Xin quyền truy cập" before sending (PQ-30). */
  @Get('access-grants/approver')
  async approver(@Query('targetId') targetId: string | undefined, @CurrentSubject() u: Subject | undefined): Promise<GrantApproverView> {
    if (!u || !targetId) throw new BadRequestException('Thiếu mã đối tượng');
    const uid = targetId.slice(0, Math.max(targetId.indexOf(':'), 0)) || targetId;
    const a = await this.authz.grantApprover(u.userId, uid);
    return { approverId: a?.userId ?? null, approverName: a?.fullName ?? null, replyLocked: CHANNEL_PERSONAL(uid) };
  }

  /**
   * "Gửi yêu cầu" of MH-PQ-11: records an `access_grants` row `cho_duyet`; the approver is computed by PQ-30
   * (the approval screen is M1b-10). The requester learns nothing about the target beyond its existence.
   */
  @Post('access-grants')
  async requestGrant(@Body() body: unknown, @CurrentSubject() u: Subject | undefined) {
    const input = parseOr400(grantRequestInputSchema, body);
    if (!u) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    return this.createGrantRequest(u.userId, u.userId, input);
  }

  /**
   * "Tạo yêu cầu quyền hộ" of the tab "Quyền hiệu lực" (L-01 phần 2, PQ-70): an Admin files the request in the
   * name of the checked person. It only creates a `cho_duyet` row for the approver of PQ-30; it grants nothing
   * and the Admin cannot approve it for himself. The checked person is notified.
   */
  @Post('admin/users/:id/grant-request')
  async requestGrantFor(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() me: Subject | undefined) {
    const input = parseOr400(grantRequestInputSchema, body);
    if (!(await userFullName(this.db, id))) throw new NotFoundException('Không tìm thấy người dùng');
    const by = me?.userId ?? `token:${p.name}`;
    const r = await this.createGrantRequest(id, by, input);
    await this.notices?.notify([id], 'grant_on_behalf', 'Quản trị viên đã tạo hộ bạn một yêu cầu quyền truy cập, đang chờ duyệt.', '/access-requests');
    return r;
  }

  private async createGrantRequest(requesterId: string, requestedBy: string, input: GrantRequestInput) {
    const sep = input.targetId.indexOf(':');
    if (sep <= 0) throw new NotFoundException('Không tìm thấy đối tượng với mã này.');
    const uid = input.targetId.slice(0, sep);
    // Existence is checked outside the caller's data scope, otherwise "out of scope" would read as "missing".
    const exists = await runUnscoped(() => this.db.col(C.conversations).countDocuments({ _id: input.targetId as never }, { limit: 1 }));
    if (!exists) throw new NotFoundException('Không tìm thấy đối tượng với mã này.');
    if (input.right === 'tra_loi' && CHANNEL_PERSONAL(uid)) {
      throw new BadRequestException('Trả lời qua nick cá nhân của người khác chỉ qua Trực thay.');
    }
    const approver = await this.authz.grantApprover(requesterId, uid);
    if (!approver) throw new BadRequestException('Chưa có người duyệt cho phạm vi này. Liên hệ quản trị viên.');
    // On behalf (PQ-70): whoever files the request must not be the one who approves it (no self-approval loop).
    if (requesterId !== requestedBy && approver.userId === requestedBy) {
      throw new BadRequestException('Bạn là người duyệt của phạm vi này nên không tạo hộ được yêu cầu (không tự tạo rồi tự duyệt).');
    }
    const grants = this.db.col<AccessGrantDoc & { approverId?: string; durationHours?: number; createdAt?: Date }>(AUTHZ_C.accessGrants);
    const dup = await runUnscoped(() =>
      grants.countDocuments({ userId: requesterId, targetType: 'conversation', targetId: input.targetId, status: 'cho_duyet' }, { limit: 1 }),
    );
    if (dup) throw new ConflictException(requesterId === requestedBy ? 'Bạn đã có yêu cầu đang chờ duyệt cho đối tượng này.' : 'Người này đã có yêu cầu đang chờ duyệt cho đối tượng này.');
    const id = `grant_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await grants.insertOne({
      _id: id,
      userId: requesterId,
      type: 'xem_ngoai_pham_vi',
      targetType: 'conversation',
      targetId: input.targetId,
      rights: GRANT_RIGHTS.slice(0, GRANT_RIGHTS.indexOf(input.right) + 1),
      reason: input.reason,
      requestedBy,
      status: 'cho_duyet',
      approverId: approver.userId,
      durationHours: input.durationHours,
      createdAt: new Date(),
    } as never);
    // The audit line carries ids only: no message content, no reason text (log rule, CLAUDE.md §12.3).
    await this.db.audit(requestedBy.startsWith('token:') ? requestedBy : `user:${requestedBy}`, requesterId !== requestedBy ? 'grant.request_on_behalf' : 'grant.request', input.targetId, {
      grantId: id,
      approverId: approver.userId,
      right: input.right,
      hours: input.durationHours,
      ...(requesterId !== requestedBy ? { onBehalfOf: requesterId } : {}),
    });
    return { id, status: 'cho_duyet', approverId: approver.userId, approverName: approver.fullName };
  }
}
