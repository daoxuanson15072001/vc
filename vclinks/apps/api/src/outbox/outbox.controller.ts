import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CHANNEL_INFO, NO_ACCESS_TEXT, channelOfUid, isFriendAction, outboxCreateSchema, outboxListQuerySchema, type OutboxCounts, type OutboxItem } from '@vclinks/shared';
import { z } from 'zod';
import { CurrentPrincipal, Scopes } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { AccountsService } from '../accounts/accounts.service';
import { CurrentSubject } from '../authz/authz.guard';
import { AuthzService } from '../authz/authz.service';
import type { Subject } from '../authz/engine';
import { DbService } from '../db/db.service';
import { OutboxDispatcher } from './outbox.dispatcher';
import { OutboxService, approverOf } from './outbox.service';

const countsQuery = outboxListQuerySchema.pick({ uid: true, threadId: true, mine: true });

const pendingQuery = z.object({
  uid: z.string().trim().min(1).max(128).optional(),
  /** '1' = this client performs outbox commands (see OutboxService.pending). */
  commands: z.enum(['0', '1']).optional(),
  /** Seconds to hold the request while nothing is pending (long-poll); 0 = answer at once. */
  wait: z.coerce.number().int().min(0).max(25).default(0),
  /** Comma-separated send allowlist the extension runs with (test phase, SZ-14); empty = no limit. */
  onlyThreads: z.string().max(2000).optional(),
});

/**
 * Dashboard → channel outbox. The Dashboard (scope dashboard) creates approved
 * items; for extension channels the extension (scope ingest) polls, claims and
 * reports results, for API channels the OutboxDispatcher sends right away.
 */
@Controller('outbox')
export class OutboxController {
  constructor(
    private readonly outbox: OutboxService,
    private readonly dispatcher: OutboxDispatcher,
    private readonly accounts: AccountsService,
    private readonly authz: AuthzService,
    private readonly db: DbService,
  ) {}

  /**
   * "Thử lại", "Gửi ngay", "Bỏ lệnh" act on an item, not on a conversation, so the route guard cannot see
   * the object. They get the same check as creating the item (POST /outbox): `canSend` on its nick and
   * thread, so a team lead cannot retry or cancel a command on another person's personal nick.
   * Tokens without a user are decided by the guard (legacy / dev tokens).
   */
  private async assertMayAct(id: string, subject: Subject | undefined): Promise<void> {
    if (!subject) return;
    const target = await this.outbox.targetOf(id);
    if (!target) return; // the service answers 404
    const d = await this.authz.canSend(subject, target.uid, target.threadId);
    if (!d.allowed) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    if (d.log) await this.db.audit(`user:${subject.userId}`, 'conversation.reply', `${target.uid}:${target.threadId}`, { via: d.via });
  }

  /**
   * The route guard already ran `canSend` on the nick / thread. Friend commands (accept, reject, send a
   * friend request) also need `friend.respond` on that nick (PQ-44: nick holder or "Trực nick"), decided
   * by the same engine. Sending on someone else's nick is recorded as trả lời thay / trực thay (QT-SZ-10).
   */
  @Post()
  async create(@Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() subject?: Subject): Promise<OutboxItem> {
    const input = parseOr400(outboxCreateSchema, body);
    let onBehalf: Parameters<OutboxService['create']>[2];
    if (subject) {
      if (isFriendAction(input.action)) {
        const d = this.authz.decide(subject, 'friend.respond', await this.authz.channelTarget(input.uid));
        if (!d.allowed) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('friend.respond'));
      }
      const mode = await this.authz.sendModeOf(subject, input.uid);
      if (mode.source) {
        const names = await this.authz.userNames([mode.holderId]);
        onBehalf = { source: mode.source, holderId: mode.holderId, holderName: mode.holderId ? (names.get(mode.holderId) ?? null) : null };
      }
    }
    const item = await this.outbox.create(input, approverOf(p), onBehalf);
    this.dispatcher.kick(item);
    return item;
  }

  /**
   * "Duyệt lại" on a `Cần duyệt lại` item (D40, PQ-51): only the nick holder or the active "Trực nick"
   * (official channels: whoever may send there, canSend). A new approval with the presser's id and time.
   */
  @Post(':id/reapprove')
  @HttpCode(200)
  async reapprove(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() subject?: Subject): Promise<OutboxItem> {
    await this.assertHolderOrCover(id, subject);
    const item = await this.outbox.reapprove(id, approverOf(p));
    this.dispatcher.kick(item);
    return item;
  }

  /** Nick holder / "Trực nick" on a personal channel; canSend on an official one (PQ-51). */
  private async assertHolderOrCover(id: string, subject: Subject | undefined): Promise<void> {
    if (!subject) return;
    const target = await this.outbox.targetOf(id);
    if (!target) return;
    const personal = CHANNEL_INFO[channelOfUid(target.uid)].sendMode !== 'api';
    const d = await this.authz.canSend(subject, target.uid, target.threadId);
    if (!d.allowed || (personal && !subject.nicks.has(target.uid))) {
      throw new ForbiddenException('Chỉ người giữ nick hoặc người đang trực nick mới duyệt lại hoặc bỏ được lệnh này.');
    }
  }

  @Get()
  list(@Query() query: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() subject?: Subject): Promise<OutboxItem[]> {
    return this.outbox.list(parseOr400(outboxListQuerySchema, query), p.userId ?? p.name, subject ? [...subject.nicks] : []);
  }

  /** Items per status (MH-SZ-13 filter chips, "Lệnh gửi" badge). */
  @Get('counts')
  counts(@Query() query: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() subject?: Subject): Promise<OutboxCounts> {
    return this.outbox.counts(parseOr400(countsQuery, query), p.userId ?? p.name, undefined, subject ? [...subject.nicks] : []);
  }

  @Get('pending')
  @Scopes('ingest')
  async pending(@Query() query: unknown): Promise<OutboxItem[]> {
    const q = parseOr400(pendingQuery, query);
    if (q.uid && q.onlyThreads !== undefined) {
      await this.accounts.noteSendLimit(q.uid, q.onlyThreads.split(',').map((s) => s.trim()).filter(Boolean));
    }
    return this.outbox.pendingForExtension(q.uid, undefined, { commands: q.commands === '1', waitMs: q.wait * 1000 });
  }

  @Post(':id/claim')
  @HttpCode(200)
  @Scopes('ingest')
  claim(@Param('id') id: string, @CurrentPrincipal() p: Principal): Promise<OutboxItem> {
    return this.outbox.claim(id, p.name);
  }

  @Post(':id/result')
  @HttpCode(200)
  @Scopes('ingest')
  result(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal): Promise<OutboxItem> {
    return this.outbox.result(id, body, p.name);
  }

  /** "Bỏ lệnh" / "Hủy gửi" / "Sao chép và bỏ lệnh" (body `{reason: 'user' | 'copied'}`). */
  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() subject?: Subject): Promise<OutboxItem> {
    // "Cần duyệt lại": only the nick holder / cover may drop it (PQ-51); other statuses as before.
    if ((await this.outbox.statusOf(id)) === 'needs_reapproval') await this.assertHolderOrCover(id, subject);
    else await this.assertMayAct(id, subject);
    return this.outbox.cancel(id, body, p.userId ?? p.name);
  }

  /** "Gửi ngay" on an item held after the nick reconnected (SZ-28 b): re-approval by the original approver. */
  @Post(':id/confirm')
  @HttpCode(200)
  async confirm(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() subject?: Subject): Promise<OutboxItem> {
    await this.assertMayAct(id, subject);
    const item = await this.outbox.confirm(id, approverOf(p));
    this.dispatcher.kick(item);
    return item;
  }

  @Post(':id/retry')
  @HttpCode(200)
  async retry(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() subject?: Subject): Promise<OutboxItem> {
    await this.assertMayAct(id, subject);
    const item = await this.outbox.retry(id, approverOf(p));
    this.dispatcher.kick(item);
    return item;
  }
}
