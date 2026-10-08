import { BadRequestException, Injectable } from '@nestjs/common';
import { C, DbService } from '../db/db.service';
import type { EventDoc, EventInput } from './event.types';

const MAX_LIMIT = 200;
const NAME = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export interface EventView {
  id: string;
  type: string;
  subject: { kind: string; id: string };
  actor: string;
  at: string;
  data?: Record<string, unknown>;
}

/**
 * Append-only event log of the current tenant (BA §2.2 #10): ingest, outbox,
 * tokens/permissions, mapping, accounts (and, after M1a-01, session loss).
 * There is deliberately no update or delete: corrections are new events.
 */
@Injectable()
export class EventsService {
  constructor(private readonly db: DbService) {}

  /** Records one event. `data` holds ids and counts only, never message content (CLAUDE.md §12.3). */
  async append(e: EventInput): Promise<void> {
    if (!NAME.test(e.type)) throw new Error(`Invalid event type "${e.type}"`);
    if (!e.subject?.kind || !e.subject.id) throw new Error('Event subject is required');
    await this.db.appendEvent(e);
  }

  /** Events about one object, newest first; `before` (ISO time) pages back. */
  async list(q: { kind?: string; id?: string; type?: string; before?: string; limit?: number }): Promise<EventView[]> {
    if (!q.kind) throw new BadRequestException('Thiếu kind (loại đối tượng)');
    const filter: Record<string, unknown> = { 'subject.kind': q.kind };
    if (q.id) filter['subject.id'] = q.id;
    if (q.type) filter.type = q.type;
    if (q.before) {
      const t = new Date(q.before);
      if (Number.isNaN(t.getTime())) throw new BadRequestException('before không hợp lệ');
      filter.at = { $lt: t };
    }
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), MAX_LIMIT);
    const docs = await this.db
      .col<EventDoc>(C.events)
      .find(filter)
      .sort({ at: -1, _id: -1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({
      id: String(d._id),
      type: d.type,
      subject: d.subject,
      actor: d.actor,
      at: d.at.toISOString(),
      ...(d.data ? { data: d.data } : {}),
    }));
  }
}
