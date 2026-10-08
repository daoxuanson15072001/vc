import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ingestBatchSchema,
  messageContentBatchSchema,
  messageStatusBatchSchema,
  streamSchema,
  syncReportSchema,
  threadNamesBatchSchema,
  typingSchema,
  uidSchema,
} from '@vclinks/shared';
import { Scopes } from '../auth/auth.guard';
import { parseOr400 } from '../common/zod';
import { IngestService } from './ingest.service';

@Controller()
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  // Declared before `ingest/:stream` so the literal path is not captured as a stream.
  @Post('ingest/message-content')
  @HttpCode(200)
  @Scopes('ingest')
  content(@Body() body: unknown) {
    const { uid, items } = parseOr400(messageContentBatchSchema, body);
    return this.ingest.ingestContent(uid, items);
  }

  /** Direct (zca-js) nicks: delivered / seen state of own messages, and threads read on another device. */
  @Post('ingest/message-status')
  @HttpCode(200)
  @Scopes('ingest')
  status(@Body() body: unknown) {
    const { uid, items } = parseOr400(messageStatusBatchSchema, body);
    return this.ingest.ingestMessageStatus(uid, items);
  }

  /** Direct (zca-js) nicks: someone is typing; the open chat shows "đang soạn tin…". Nothing is stored. */
  @Post('ingest/typing')
  @HttpCode(200)
  @Scopes('ingest')
  typing(@Body() body: unknown) {
    const t = parseOr400(typingSchema, body);
    return this.ingest.typing(t.uid, t.threadId, t.who);
  }

  /** Fetch requests: content of the open conversation, creating messages IndexedDB no longer has. */
  @Post('ingest/dom-messages')
  @HttpCode(200)
  @Scopes('ingest')
  domMessages(@Body() body: unknown) {
    return this.ingest.ingestDomMessages(body);
  }

  @Post('ingest/thread-names')
  @HttpCode(200)
  @Scopes('ingest')
  threadNames(@Body() body: unknown) {
    const { uid, items } = parseOr400(threadNamesBatchSchema, body);
    return this.ingest.updateThreadNames(uid, items);
  }

  @Post('ingest/:stream')
  @HttpCode(200)
  @Scopes('ingest')
  run(@Param('stream') stream: string, @Body() body: unknown) {
    const s = parseOr400(streamSchema, stream);
    const { uid, items } = parseOr400(ingestBatchSchema, body);
    return this.ingest.ingest(s, uid, items);
  }

  @Get('checkpoints/:uid/:stream')
  @Scopes('ingest', 'mcp')
  checkpoint(@Param('uid') uid: string, @Param('stream') stream: string) {
    return this.ingest.getCheckpoint(parseOr400(uidSchema, uid), parseOr400(streamSchema, stream));
  }

  @Post('sync/report')
  @HttpCode(200)
  @Scopes('ingest')
  async report(@Body() body: unknown) {
    await this.ingest.report(parseOr400(syncReportSchema, body));
    return { ok: true };
  }
}
