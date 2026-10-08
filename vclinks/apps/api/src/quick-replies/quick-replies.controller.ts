import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { quickReplyInputSchema, quickReplyPatchSchema, type QuickReply } from '@vclinks/shared';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { QuickRepliesService } from './quick-replies.service';

/** Dashboard CRUD of quick replies (scope dashboard, the default). */
@Controller('quick-replies')
export class QuickRepliesController {
  constructor(private readonly replies: QuickRepliesService) {}

  @Get()
  list(): Promise<QuickReply[]> {
    return this.replies.list();
  }

  @Post()
  create(@Body() body: unknown, @CurrentPrincipal() p: Principal): Promise<QuickReply> {
    return this.replies.create(parseOr400(quickReplyInputSchema, body), p.name);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal): Promise<QuickReply> {
    return this.replies.update(id, parseOr400(quickReplyPatchSchema, body), p.name);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string, @CurrentPrincipal() p: Principal): Promise<{ ok: true }> {
    await this.replies.remove(id, p.name);
    return { ok: true };
  }
}
