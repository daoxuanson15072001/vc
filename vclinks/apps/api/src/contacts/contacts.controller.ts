import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  contactDomBatchSchema,
  contactGroupsQuerySchema,
  contactListQuerySchema,
  uidSchema,
  type ContactDomResult,
  type ContactGroupsResponse,
  type ContactListResponse,
  type ContactProfile,
} from '@vclinks/shared';
import { z } from 'zod';
import { Scopes } from '../auth/auth.guard';
import { parseOr400 } from '../common/zod';
import { ContactsService } from './contacts.service';

const id = z.string().trim().min(1).max(128);
const profileQuery = z.object({ threadId: id.optional() });

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  /** Danh bạ page: friends of one account (03 MH-SZ-09). */
  @Get()
  list(@Query() query: unknown): Promise<ContactListResponse> {
    return this.contacts.list(parseOr400(contactListQuerySchema, query));
  }

  /** Danh bạ tab "Nhóm": groups and communities of one account. */
  @Get('groups')
  groups(@Query() query: unknown): Promise<ContactGroupsResponse> {
    return this.contacts.groups(parseOr400(contactGroupsQuerySchema, query));
  }

  /** Extension ContactReader: rows of the Zalo Web friend list. */
  @Post(':uid/dom')
  @HttpCode(200)
  @Scopes('ingest')
  dom(@Param('uid') uid: string, @Body() body: unknown): Promise<ContactDomResult> {
    return this.contacts.ingestDom(parseOr400(uidSchema, uid), parseOr400(contactDomBatchSchema, body));
  }

  /** Profile of `userId` as seen from account `uid`; `threadId` adds the in-thread message count. */
  @Get(':uid/:userId')
  profile(@Param('uid') uid: string, @Param('userId') userId: string, @Query() query: unknown): Promise<ContactProfile> {
    const q = parseOr400(profileQuery, query);
    return this.contacts.profile(parseOr400(id, uid), parseOr400(id, userId), q.threadId);
  }
}
