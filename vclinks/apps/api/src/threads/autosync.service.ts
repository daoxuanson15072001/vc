import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AUTOSYNC_PLAN_LIMIT,
  AUTOSYNC_RETRY_MS,
  autoSyncResultSchema,
  channelOfUid,
  type AutoSyncMode,
  type AutoSyncOutcome,
  type AutoSyncPlanItem,
} from '@vclinks/shared';
import { parseOr400 } from '../common/zod';
import { C, DbService } from '../db/db.service';
import { conversationOpenHints } from './fetch-requests.service';

/** Backfill stop reasons that mean "Zalo Web has nothing older to show". */
const HISTORY_START_REASONS = new Set(['reached_start', 'web_history_start']);

/** Run bookkeeping kept on the conversation document (`conversations.autoSync`). */
interface AutoSyncState {
  lastRunAt?: Date;
  lastMode?: AutoSyncMode;
  lastOutcome?: AutoSyncOutcome;
  reason?: string;
  posted?: number;
  /** Reachable pending messages right after the run: a deep pass is not repeated while this is unchanged. */
  pendingAfter?: number;
  retryAt?: Date;
  /** A deep pass (automatic or Dashboard fetch) reached the start of Zalo Web history. */
  deepDoneAt?: Date;
}

interface ConversationDoc {
  _id: string;
  threadId: string;
  name?: string;
  lastMsgAt?: Date;
  /** Zalo Web shows nothing older than this ("use Zalo PC before <date>"). */
  webHistoryFrom?: Date;
  autoSync?: AutoSyncState;
}

const PENDING = { $in: ['pending', 'partial'] };

/** Messages of a thread still missing content that Zalo Web can still show. */
function reachablePending(db: DbService, uid: string, threadId: string, from?: Date | null): Promise<number> {
  return db.col(C.messages).countDocuments({
    uid,
    threadId,
    contentStatus: PENDING,
    ...(from ? { sentAt: { $gte: from } } : {}),
  });
}

/**
 * Records what a content run found (automatic sync or Dashboard fetch): Zalo
 * Web's history start, and whether a deep pass reached it. Content-free.
 */
export async function recordContentRun(
  db: DbService,
  r: {
    uid: string;
    threadId: string;
    mode: AutoSyncMode;
    outcome: AutoSyncOutcome;
    reason?: string;
    posted?: number;
    webHistoryFrom?: number;
  },
  now = new Date(),
): Promise<void> {
  const convs = db.col<ConversationDoc>(C.conversations);
  const _id = `${r.uid}:${r.threadId}`;
  const conv = await convs.findOne({ _id }, { projection: { webHistoryFrom: 1 } });
  const from = r.webHistoryFrom != null ? new Date(r.webHistoryFrom) : (conv?.webHistoryFrom ?? null);
  const pendingAfter = await reachablePending(db, r.uid, r.threadId, from);
  const set: Record<string, unknown> = {
    'autoSync.lastRunAt': now,
    'autoSync.lastMode': r.mode,
    'autoSync.lastOutcome': r.outcome,
    'autoSync.pendingAfter': pendingAfter,
    'autoSync.retryAt': new Date(now.getTime() + AUTOSYNC_RETRY_MS[r.outcome]),
    'autoSync.reason': r.reason ?? null,
    'autoSync.posted': r.posted ?? 0,
  };
  if (r.webHistoryFrom != null) set.webHistoryFrom = new Date(r.webHistoryFrom);
  if (r.mode === 'deep' && r.outcome === 'done' && HISTORY_START_REASONS.has(r.reason ?? '')) {
    set['autoSync.deepDoneAt'] = now;
  }
  await convs.updateOne({ _id }, { $set: set });
}

/** True once a deep pass reached the start of Zalo Web history for this conversation. */
export async function deepDone(db: DbService, uid: string, threadId: string): Promise<boolean> {
  const c = await db
    .col<ConversationDoc>(C.conversations)
    .findOne({ _id: `${uid}:${threadId}` }, { projection: { 'autoSync.deepDoneAt': 1 } });
  return !!c?.autoSync?.deepDoneAt;
}

/**
 * Plan of the automatic content sync (shared/autosync.ts): the conversations of
 * one account still missing content, newest first. Leaves out threads waiting
 * for a retry (unread, not found, error) and threads whose last deep pass found
 * nothing more to capture since. Ids and counts only, never text.
 */
@Injectable()
export class AutoSyncService {
  constructor(private readonly db: DbService) {}

  async plan(uid: string, limit = 20, now = new Date()): Promise<AutoSyncPlanItem[]> {
    if (channelOfUid(uid) !== 'zalo') throw new BadRequestException('Chỉ hỗ trợ kênh Zalo cá nhân');
    const n = Math.min(Math.max(1, limit), AUTOSYNC_PLAN_LIMIT);
    const groups = await this.db
      .col(C.messages)
      .aggregate<{ _id: string; pending: number; newest: Date | null }>([
        { $match: { uid, contentStatus: PENDING } },
        { $group: { _id: '$threadId', pending: { $sum: 1 }, newest: { $max: '$sentAt' } } },
      ])
      .toArray();
    if (!groups.length) return [];
    const convs = await this.db
      .col<ConversationDoc>(C.conversations)
      .find(
        { uid, threadId: { $in: groups.map((g) => g._id) } },
        { projection: { threadId: 1, name: 1, lastMsgAt: 1, webHistoryFrom: 1, autoSync: 1 } },
      )
      .toArray();
    const byThread = new Map(convs.map((c) => [c.threadId, c]));

    const candidates: { g: (typeof groups)[number]; c?: ConversationDoc; pending: number; at: number }[] = [];
    for (const g of groups) {
      if (!g._id) continue;
      const c = byThread.get(g._id);
      const s = c?.autoSync;
      // Messages that arrived after the last pass are always worth a look (new content), whatever that pass decided.
      const newSinceRun = !!g.newest && (!s?.lastRunAt || g.newest > s.lastRunAt);
      if (!newSinceRun && s?.retryAt && s.retryAt > now) continue;
      const pending = c?.webHistoryFrom ? await reachablePending(this.db, uid, g._id, c.webHistoryFrom) : g.pending;
      if (!pending) continue;
      // The last deep pass left this much (or more, since captured passively) behind:
      // nothing new to capture. Only new messages without content bring it back.
      if (!newSinceRun && s?.lastMode === 'deep' && s.lastOutcome === 'done' && s.pendingAfter != null && pending <= s.pendingAfter) continue;
      candidates.push({ g, c, pending, at: (c?.lastMsgAt ?? g.newest)?.getTime() ?? 0 });
    }
    candidates.sort((a, b) => b.at - a.at);

    return Promise.all(
      candidates.slice(0, n).map(async ({ g, c, pending, at }) => {
        const hints = await conversationOpenHints(this.db, uid, g._id);
        return {
          threadId: g._id,
          ...(hints.name ? { name: hints.name } : {}),
          pending,
          lastMsgAt: at ? new Date(at).toISOString() : null,
          deepDone: !!c?.autoSync?.deepDoneAt,
          recentCliMsgIds: hints.recentCliMsgIds,
          newestPendingAt: g.newest ? g.newest.toISOString() : null,
        };
      }),
    );
  }

  async result(body: unknown): Promise<{ ok: true }> {
    const r = parseOr400(autoSyncResultSchema, body);
    await recordContentRun(this.db, r);
    return { ok: true };
  }
}
