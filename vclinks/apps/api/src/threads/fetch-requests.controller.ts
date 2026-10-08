import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { fetchPresenceQuerySchema, uidSchema, type FetchRequest } from '@vclinks/shared';
import { z } from 'zod';
import { CurrentPrincipal, Scopes } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { CurrentSubject } from '../authz/authz.guard';
import { AuthzService } from '../authz/authz.service';
import type { Subject } from '../authz/engine';
import { DbService } from '../db/db.service';
import { FetchRequestsService } from './fetch-requests.service';

const fetchBody = z.object({ onBehalf: z.boolean().optional() }).strict();

const pendingQuery = fetchPresenceQuerySchema.extend({
  uid: uidSchema,
  /** Long-poll: hold the call up to this many seconds until a request is queued. */
  wait: z.coerce.number().int().min(0).max(25).default(0),
});

/** Dashboard side: ask for / watch a conversation fetch (scope dashboard). */
@Controller('conversations')
export class ConversationFetchController {
  constructor(
    private readonly fetches: FetchRequestsService,
    private readonly authz: AuthzService,
    private readonly db: DbService,
  ) {}

  /**
   * SZ-23 / D24: fetching opens the thread on Zalo Web, so the customer sees "Đã xem" and the holder loses
   * the unread badge. Only the nick holder (or the active cover) asks automatically; a GS / GĐ may ask on
   * purpose with `onBehalf: true` (confirmed in the UI), logged as `conversation.fetch_on_behalf`.
   * `onBehalf: true` is also the explicit confirmation to open the thread although it has unread messages
   * (`allowUnread` for the extension); an automatic request never does.
   */
  @Post(':id/fetch')
  @HttpCode(200)
  async request(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<FetchRequest> {
    if (u) {
      const access = await this.authz.conversationAccess(p, id);
      if (!access.autoFetch) {
        const { onBehalf } = parseOr400(fetchBody, body ?? {});
        if (!onBehalf || !access.canFetchOnBehalf) {
          throw new ForbiddenException('Bạn không giữ nick này: mở hội thoại không lấy nội dung từ Zalo Web để khách không thấy "Đã xem".');
        }
        await this.db.audit(`user:${u.userId}`, 'conversation.fetch_on_behalf', id);
      }
    }
    const confirmed = fetchBody.safeParse(body ?? {});
    return this.fetches.request(id, p.name, { allowUnread: confirmed.success && confirmed.data.onBehalf === true });
  }

  @Get(':id/fetch')
  get(@Param('id') id: string) {
    return this.fetches.get(id);
  }
}

/** Extension side: poll (doubles as heartbeat), claim, report (scope ingest). */
@Controller('fetch-requests')
export class FetchRequestsController {
  constructor(private readonly fetches: FetchRequestsService) {}

  @Get('pending')
  @Scopes('ingest')
  async pending(@Query() q: unknown, @CurrentPrincipal() p: Principal): Promise<FetchRequest[]> {
    const { uid, wait, ...presence } = parseOr400(pendingQuery, q);
    await this.fetches.heartbeat(uid, presence, p.name);
    // Only the tab logged in to this account can open its conversations.
    if (presence.loggedIn === '0') return [];
    const items = await this.fetches.pendingWait(uid, wait * 1000);
    // A long wait would age the heartbeat past PRESENCE_ONLINE_MS: refresh it.
    if (wait) await this.fetches.heartbeat(uid, presence, p.name);
    return items;
  }

  @Post(':id/claim')
  @HttpCode(200)
  @Scopes('ingest')
  claim(@Param('id') id: string, @CurrentPrincipal() p: Principal): Promise<FetchRequest> {
    return this.fetches.claim(id, p.name);
  }

  @Post(':id/result')
  @HttpCode(200)
  @Scopes('ingest')
  result(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal): Promise<FetchRequest> {
    return this.fetches.result(id, body, p.name);
  }
}
