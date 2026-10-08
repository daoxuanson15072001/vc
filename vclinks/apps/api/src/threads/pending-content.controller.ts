import { Controller, Get, Param, Query } from '@nestjs/common';
import { uidSchema } from '@vclinks/shared';
import { z } from 'zod';
import { Scopes } from '../auth/auth.guard';
import { parseOr400 } from '../common/zod';
import { C, DbService } from '../db/db.service';

/** Upper bound on returned ids; the extension only uses them as a stop condition. */
const MAX_PENDING = 5000;

const query = z.object({ uid: uidSchema });
const threadIdSchema = z.string().trim().min(1).max(128);

export interface PendingContentResponse {
  threadId: string;
  cliMsgIds: string[];
  /** True when more than MAX_PENDING messages are pending (list was cut). */
  truncated: boolean;
}

/**
 * Lists cliMsgIds of a thread whose content is still missing (metadata ingested,
 * DOM content not captured yet). Used by the extension's backfill (scroll up the
 * conversation the user has open) to know when it can stop. Ids only — never text.
 */
@Controller('threads')
export class PendingContentController {
  constructor(private readonly db: DbService) {}

  @Get(':threadId/pending-content')
  @Scopes('ingest')
  async pending(@Param('threadId') rawThreadId: string, @Query() q: unknown): Promise<PendingContentResponse> {
    const threadId = parseOr400(threadIdSchema, rawThreadId);
    const { uid } = parseOr400(query, q);
    // The Zalo sidebar prefixes group ids with "g"; stored threadIds may not.
    const ids = /^g\d+$/.test(threadId) ? [threadId, threadId.slice(1)] : [threadId];
    // Messages older than Zalo Web's history start never render: waiting for them
    // would make every later backfill scroll to the very top.
    const conv = await this.db
      .col(C.conversations)
      .findOne({ uid, threadId: { $in: ids }, webHistoryFrom: { $exists: true } }, { projection: { webHistoryFrom: 1 } });
    const from = conv?.webHistoryFrom instanceof Date ? conv.webHistoryFrom : null;
    const docs = await this.db
      .col(C.messages)
      .find(
        {
          uid,
          threadId: { $in: ids },
          contentStatus: { $in: ['pending', 'partial'] },
          cliMsgId: { $nin: [null, ''] },
          ...(from ? { sentAt: { $gte: from } } : {}),
        },
        { projection: { _id: 0, cliMsgId: 1 } },
      )
      .sort({ sentAt: -1 })
      .limit(MAX_PENDING + 1)
      .toArray();
    const cliMsgIds = [...new Set(docs.map((d) => String(d.cliMsgId)))];
    return { threadId, cliMsgIds: cliMsgIds.slice(0, MAX_PENDING), truncated: cliMsgIds.length > MAX_PENDING };
  }
}
