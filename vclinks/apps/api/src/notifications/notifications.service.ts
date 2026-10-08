import { Injectable, Optional } from '@nestjs/common';
import type { NotificationList } from '@vclinks/shared';
import { DbService } from '../db/db.service';
import { RealtimeService } from '../realtime/realtime.service';

interface NotificationDoc {
  _id: string;
  userId: string;
  title: string;
  link?: string;
  kind: string;
  at: Date;
  readAt?: Date | null;
}

/**
 * Minimal in-app notices (MH-UI-03) written by M1b-10 (grant approvals, covers, 18:00 summaries).
 * M1c-07 pushes each notice to its user over SSE (RealtimeService). Titles never contain message text.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: DbService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  private get col() {
    return this.db.col<NotificationDoc>('notifications');
  }

  async notify(userIds: (string | null | undefined)[], kind: string, title: string, link?: string): Promise<void> {
    const ids = [...new Set(userIds.filter((x): x is string => !!x))];
    if (!ids.length) return;
    const at = new Date();
    const docs = ids.map((userId) => ({ _id: `ntf_${at.getTime().toString(36)}${Math.random().toString(36).slice(2, 10)}`, userId, kind, title, at, ...(link ? { link } : {}) }));
    await this.col.insertMany(docs);
    // Realtime push (M1c-07): only the id and kind travel; the client reads the title through GET /notifications.
    for (const d of docs) void this.realtime?.publish({ type: 'notification', id: d._id, kind, userId: d.userId });
  }

  async list(userId: string): Promise<NotificationList> {
    const rows = await this.col.find({ userId }).sort({ at: -1 }).limit(50).toArray();
    return {
      items: rows.map((r) => ({ id: r._id, title: r.title, at: r.at.toISOString(), read: !!r.readAt, ...(r.link ? { link: r.link } : {}) })),
      unread: await this.col.countDocuments({ userId, readAt: { $exists: false } }),
    };
  }

  /** Whether a notice of `kind` with `title` already went to the user since `since` (once-a-day jobs). */
  async sentSince(userId: string, kind: string, since: Date): Promise<boolean> {
    return (await this.col.countDocuments({ userId, kind, at: { $gte: since } }, { limit: 1 })) > 0;
  }
}
