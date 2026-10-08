import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { channelSchema, conversationDoneSchema, inboxQuerySchema } from '@vclinks/shared';
import { z } from 'zod';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { DebtFlagsService } from '../quotes/debt-flags.service';
import { ConversationsService } from './conversations.service';

const listQuery = inboxQuerySchema.extend({
  uid: z.string().min(1).optional(),
  channel: channelSchema.optional(),
  q: z.string().trim().max(200).optional(),
  /** `unread=1`: only conversations with unread messages. */
  unread: z
    .enum(['0', '1', 'true', 'false'])
    .transform((v) => v === '1' || v === 'true')
    .optional(),
  /** `overdueDebt=1`: only conversations of customers with overdue debt on VCsales (needs cust.debt, M1c-02). */
  overdueDebt: z
    .enum(['0', '1'])
    .transform((v) => v === '1')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

const messagesQuery = z.object({
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Message id to open the window on (`?msg=` of a search hit). */
  around: z.string().trim().min(1).max(100).optional(),
});

const sharedQuery = messagesQuery.extend({ kind: z.enum(['media', 'file', 'link']) });

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly debt: DebtFlagsService,
  ) {}

  @Get()
  async list(@Query() query: unknown, @CurrentSubject() subject?: Subject) {
    const { overdueDebt, ...q } = parseOr400(listQuery, query);
    const onlyIds = overdueDebt ? (await this.debt.flags(subject)).ids : undefined;
    return this.conversations.list({ ...q, q: q.q || undefined, ...(onlyIds ? { onlyIds } : {}) }, subject);
  }

  /** Conversations whose customer owes overdue debt, for the chip "Nợ quá hạn" (flag only, no amount). */
  @Get('overdue-debt')
  overdueDebt(@CurrentSubject() subject?: Subject) {
    return this.debt.flags(subject);
  }

  /** Scopes the caller may pick and the counters of the supervisor bar (declared before `:id`). */
  @Get('inbox')
  inbox(@CurrentSubject() subject?: Subject) {
    return this.conversations.summary(subject);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.conversations.get(id);
  }

  @Get(':id/messages')
  messages(@Param('id') id: string, @Query() query: unknown) {
    const q = parseOr400(messagesQuery, query);
    return this.conversations.messages(id, q.before, q.limit, q.around);
  }

  /** "Xong" (plan B2): closes the conversation with an optional one-tap outcome. */
  @Post(':id/done')
  @HttpCode(200)
  done(@Param('id') id: string, @Body() body: unknown, @CurrentSubject() subject?: Subject) {
    const b = parseOr400(conversationDoneSchema, body ?? {});
    return this.conversations.setDone(id, true, b.outcome, subject);
  }

  /** "Mở lại": back to the inbox without waiting for the customer. */
  @Post(':id/reopen')
  @HttpCode(200)
  reopen(@Param('id') id: string, @CurrentSubject() subject?: Subject) {
    return this.conversations.setDone(id, false, undefined, subject);
  }

  /** Info panel tabs Media / File / Link (M1c-08): same access as the messages of the conversation. */
  @Get(':id/shared')
  shared(@Param('id') id: string, @Query() query: unknown) {
    const q = parseOr400(sharedQuery, query);
    return this.conversations.sharedContent(id, q.kind, q.before, q.limit);
  }
}
