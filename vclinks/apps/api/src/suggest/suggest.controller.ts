import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { aiDraftRejectSchema, aiDraftSentSchema, type AiDraftMetrics, type AiDraftView } from '@vclinks/shared';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { approverOf } from '../outbox/outbox.service';
import { SuggestService } from './suggest.service';

/** Same actor id the outbox records in approvedBy (signed-in user id), so a sent item can be matched. */
const actorOf = (p: Principal) => approverOf(p).id;

/**
 * AI reply drafts under a conversation (M1c-06, KD-10). Permission `ai.draft` on the conversation
 * (route-permissions.ts). There is deliberately no route that sends: sending is the outbox create route only (conv.reply, canSend).
 */
@Controller('conversations/:id/ai-draft')
export class SuggestController {
  constructor(private readonly suggest: SuggestService) {}

  @Get()
  latest(@Param('id') id: string): Promise<AiDraftView | null> {
    return this.suggest.latest(id);
  }

  @Post()
  @HttpCode(200)
  generate(@Param('id') id: string, @CurrentPrincipal() p: Principal): Promise<AiDraftView> {
    return this.suggest.generate(id, actorOf(p));
  }

  @Post(':draftId/reject')
  @HttpCode(200)
  reject(@Param('id') id: string, @Param('draftId') draftId: string, @Body() body: unknown, @CurrentPrincipal() p: Principal): Promise<AiDraftView> {
    return this.suggest.reject(id, draftId, actorOf(p), parseOr400(aiDraftRejectSchema, body ?? {}).reason);
  }

  @Post(':draftId/sent')
  @HttpCode(200)
  sent(@Param('id') id: string, @Param('draftId') draftId: string, @Body() body: unknown, @CurrentPrincipal() p: Principal): Promise<AiDraftView> {
    return this.suggest.linkSent(id, draftId, parseOr400(aiDraftSentSchema, body).outboxId, actorOf(p));
  }
}

@Controller('ai-drafts')
export class AiDraftMetricsController {
  constructor(private readonly suggest: SuggestService) {}

  /** Own approval rate without edits (CLAUDE.md §8). */
  @Get('metrics')
  metrics(@CurrentPrincipal() p: Principal): Promise<AiDraftMetrics> {
    return this.suggest.metrics(actorOf(p));
  }
}
