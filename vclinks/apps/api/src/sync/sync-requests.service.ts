import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CHANNEL_INFO, SYNC_REQUEST_TTL_MS, channelOfUid, type SyncRequestCreate, type SyncRequestStatus, type SyncRequestView } from '@vclinks/shared';
import { C, DbService } from '../db/db.service';

interface SyncRequestDoc {
  _id: string;
  uid: string;
  status: SyncRequestStatus;
  full: boolean;
  requestedAt: Date;
  requestedBy: string;
  claimedAt?: Date;
  claimedBy?: string;
}

const view = (d: SyncRequestDoc): SyncRequestView => ({
  uid: d.uid,
  status: d.status,
  full: d.full,
  requestedAt: d.requestedAt.toISOString(),
  requestedBy: d.requestedBy,
  ...(d.claimedAt ? { claimedAt: d.claimedAt.toISOString() } : {}),
});

/**
 * "Đồng bộ ngay" requests (M1a-06): one document per nick (`_id` = uid) in
 * `sync_requests`. The Dashboard opens or refreshes it; the extension claims
 * it with its fetch heartbeat and starts the same IndexedDB sync as the popup.
 */
@Injectable()
export class SyncRequestsService {
  constructor(private readonly db: DbService) {}

  private get col() {
    return this.db.col<SyncRequestDoc>(C.syncRequests);
  }

  async request(input: SyncRequestCreate, actor: string): Promise<SyncRequestView> {
    const { uid } = input;
    // Only extension channels have an IndexedDB sync; API channels receive by webhook.
    if (CHANNEL_INFO[channelOfUid(uid)].sendMode !== 'extension') {
      throw new BadRequestException('Kênh này nhận tin qua webhook, không có đồng bộ từ tiện ích');
    }
    if (!(await this.db.col(C.accounts).countDocuments({ _id: uid as never }, { limit: 1 }))) {
      throw new NotFoundException(`Không tìm thấy tài khoản ${uid}`);
    }
    const now = new Date();
    const doc = await this.col.findOneAndUpdate(
      { _id: uid },
      { $set: { uid, status: 'pending', full: !!input.full, requestedAt: now, requestedBy: actor }, $unset: { claimedAt: '', claimedBy: '' } },
      { upsert: true, returnDocument: 'after' },
    );
    await this.db.audit(actor, 'sync.request', uid, { full: !!input.full });
    return view(doc!);
  }

  async get(uid: string): Promise<{ request: SyncRequestView | null }> {
    const doc = await this.col.findOne({ _id: uid });
    return { request: doc ? view(doc) : null };
  }

  /** Extension: takes the nick's open request, if any (pending → claimed, atomically). */
  async claim(uid: string, actor: string, now = new Date()): Promise<{ request: SyncRequestView | null }> {
    const doc = await this.col.findOneAndUpdate(
      { _id: uid, status: 'pending', requestedAt: { $gte: new Date(now.getTime() - SYNC_REQUEST_TTL_MS) } },
      { $set: { status: 'claimed', claimedAt: now, claimedBy: actor } },
      { returnDocument: 'after' },
    );
    if (doc) await this.db.audit(actor, 'sync.request_claimed', uid, { full: doc.full });
    return { request: doc ? view(doc) : null };
  }
}
