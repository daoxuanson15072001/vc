import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  friendRequestDomBatchSchema,
  friendRequestListQuerySchema,
  uidSchema,
  type FriendRequestDomResult,
  type FriendRequestListResponse,
} from '@vclinks/shared';
import { Scopes } from '../auth/auth.guard';
import { parseOr400 } from '../common/zod';
import { FriendRequestsService } from './friend-requests.service';

/** Friend requests (MH-SZ-10): the Dashboard lists them, the extension reports what Zalo Web shows. */
@Controller()
export class FriendRequestsController {
  constructor(private readonly requests: FriendRequestsService) {}

  @Get('friend-requests')
  list(@Query() query: unknown): Promise<FriendRequestListResponse> {
    return this.requests.list(parseOr400(friendRequestListQuerySchema, query));
  }

  /** Extension FriendRequestReader: one list (received or sent) of Danh bạ → Lời mời kết bạn. */
  @Post('contacts/:uid/friend-requests/dom')
  @HttpCode(200)
  @Scopes('ingest')
  dom(@Param('uid') uid: string, @Body() body: unknown): Promise<FriendRequestDomResult> {
    return this.requests.ingestDom(parseOr400(uidSchema, uid), parseOr400(friendRequestDomBatchSchema, body));
  }
}
