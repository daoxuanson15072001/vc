import { Controller, Get, Query } from '@nestjs/common';
import { searchMessagesQuerySchema, type SearchMessagesResponse } from '@vclinks/shared';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { SearchService } from './search.service';

/** `GET /api/search/messages` (MH-SZ-14; with `uid` + `threadId` it is "tìm trong hội thoại"). Permission: search.global. */
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('messages')
  messages(@Query() query: unknown, @CurrentSubject() u?: Subject): Promise<SearchMessagesResponse> {
    return this.search.search(parseOr400(searchMessagesQuerySchema, query), u);
  }
}
