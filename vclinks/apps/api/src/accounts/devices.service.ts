import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { C, DbService } from '../db/db.service';
import { runUnscoped } from '../db/tenant-context';
import { TOKEN_TEXT, type ApprovePairing } from '@vclinks/shared';
import { TokenService, type Principal } from '../auth/token.service';

export const PAIRING_TTL_MS = 10 * 60_000;
/** Open pairings allowed at once: the request endpoint is public, so it must stay cheap to abuse. */
const MAX_OPEN_PAIRINGS = 30;
export const DEVICE_COLLECTION = 'device_pairings';

interface PairingDoc {
  _id: string;
  /** 6 digits shown on the extension; an Admin types it on the Dashboard (01 PQ-52). */
  code: string;
  deviceName: string;
  pollKeyHash: string;
  expiresAt: Date;
  createdAt: Date;
  approvedBy?: string;
  usedAt?: Date;
  /**
   * What the Admin approved (M1b-06). The token itself is created only when the extension polls with its
   * secret and is returned once: no token string is ever stored, not even for a moment.
   */
  grant?: { deviceName: string; uids: string[]; holderUserId?: string; shared?: boolean; tenantId: string; approverId?: string };
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Pairing of an extension to the API without copying tokens by hand (01 PQ-52):
 * the extension shows a 6-digit code, an Admin approves it, the extension picks
 * up its device token once. Also rotation of that token.
 * Uses the raw collection: the public request has no tenant yet; the token gets
 * the approving Admin's tenant.
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly db: DbService,
    private readonly tokens: TokenService,
  ) {}

  private get col() {
    return this.db.unscoped<PairingDoc>(DEVICE_COLLECTION);
  }

  async request(deviceName: string) {
    const now = new Date();
    await this.col.deleteMany({ expiresAt: { $lt: new Date(now.getTime() - 60 * 60_000) } });
    if ((await this.col.countDocuments({ expiresAt: { $gt: now }, usedAt: { $exists: false } })) >= MAX_OPEN_PAIRINGS) {
      throw new BadRequestException('Đang có quá nhiều yêu cầu ghép máy, hãy thử lại sau ít phút');
    }
    const pollKey = randomBytes(24).toString('base64url');
    // A 6-digit code can collide: retry a few times against open codes.
    for (let i = 0; i < 5; i++) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      if (await this.col.countDocuments({ code, expiresAt: { $gt: now }, usedAt: { $exists: false } })) continue;
      const doc: PairingDoc = {
        _id: randomBytes(8).toString('hex'),
        code,
        deviceName,
        pollKeyHash: sha(pollKey),
        expiresAt: new Date(now.getTime() + PAIRING_TTL_MS),
        createdAt: now,
      };
      await this.col.insertOne(doc);
      return { id: doc._id, code, pollKey, expiresAt: doc.expiresAt.toISOString() };
    }
    throw new BadRequestException('Không tạo được mã ghép, hãy thử lại');
  }

  /** Extension poll: returns the token exactly once after approval. */
  async poll(id: string, pollKey: string) {
    const doc = await this.col.findOne({ _id: id });
    const a = Buffer.from(sha(pollKey));
    const b = Buffer.from(doc?.pollKeyHash ?? '0'.repeat(64));
    if (!doc || a.length !== b.length || !timingSafeEqual(a, b)) throw new NotFoundException('Không tìm thấy yêu cầu ghép máy');
    if (doc.usedAt) return { status: 'used' as const };
    if (doc.expiresAt.getTime() < Date.now()) return { status: 'expired' as const };
    if (!doc.grant) return { status: 'pending' as const };
    const taken = await this.col.findOneAndUpdate({ _id: id, grant: { $exists: true }, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } }, { returnDocument: 'before' });
    if (!taken?.grant) return { status: 'used' as const };
    const g = taken.grant;
    const name = `device:${g.deviceName}:${doc._id.slice(0, 4)}`;
    const { token } = await this.tokens.createWithId(name, ['ingest'], g.tenantId, {
      kind: 'device',
      uids: g.uids,
      deviceName: g.deviceName,
      ...(g.holderUserId ? { userId: g.holderUserId } : {}),
      createdBy: doc.approvedBy ?? 'admin',
    });
    return { status: 'approved' as const, token };
  }

  /** Admin (Dashboard) types the code: issues a device token (scope ingest). */
  async approve(input: ApprovePairing, p: Principal) {
    const doc = await this.col.findOne({ code: input.code, expiresAt: { $gt: new Date() }, usedAt: { $exists: false }, grant: { $exists: false } });
    if (!doc) throw new NotFoundException(TOKEN_TEXT.pairingBad);
    // Nicks must exist in this tenant; the holder, if any, must be a real user (PQ-52 a).
    if (input.uids.length) {
      const have = await runUnscoped(() => this.db.col<{ _id: string }>(C.accounts).countDocuments({ _id: { $in: input.uids } as never, status: { $exists: false } } as never));
      if (have !== new Set(input.uids).size) throw new BadRequestException('Có nick chưa được khai báo trong hệ thống');
    }
    if (input.holderUserId && input.holderUserId === p.userId) throw new BadRequestException('Không tự ghép máy cho chính mình (PQ-41)');
    if (input.holderUserId && !(await this.db.col(C.users).countDocuments({ _id: input.holderUserId as never }, { limit: 1 }))) {
      throw new BadRequestException('Không tìm thấy người giữ máy');
    }
    const deviceName = input.deviceName ?? doc.deviceName;
    // "Thay máy cũ": the old token stops at once (UAT-PQ-75).
    if (input.replaceTokenId) {
      await this.db
        .col(C.apiTokens)
        .updateOne({ _id: input.replaceTokenId as never, kind: 'device', revokedAt: { $exists: false } } as never, {
          $set: { revokedAt: new Date(), revokedReason: 'thay_may', revokedBy: p.name },
        });
      this.tokens.forgetCache();
    }
    await this.col.updateOne(
      { _id: doc._id },
      {
        $set: {
          approvedBy: p.name,
          grant: {
            deviceName,
            uids: input.uids,
            ...(input.holderUserId ? { holderUserId: input.holderUserId } : {}),
            ...(input.shared ? { shared: true } : {}),
            tenantId: p.tenantId,
          },
        },
      },
    );
    await this.db.audit(p.name, 'device.pair', `device:${deviceName}:${doc._id.slice(0, 4)}`, { deviceName, uids: input.uids, replaced: input.replaceTokenId ?? null });
    return { deviceName, uids: input.uids };
  }

  /** Issues a replacement for the caller's own device token; the old one stays valid until commit. */
  async rotate(p: Principal) {
    const token = await this.tokens.create(p.name, p.scopes.filter((s) => s === 'ingest'), p.tenantId, {
      kind: p.tokenKind === 'device' ? 'device' : undefined,
      uids: p.uids,
      ...(p.tokenKind === 'device' ? { createdBy: p.name } : {}),
    });
    await this.db.audit(p.name, 'device.rotate', p.name);
    return { token };
  }

  /** Called with the NEW token once stored: revokes every older token of the same name. */
  async commitRotation(token: string, p: Principal) {
    const newest = await this.db.col<{ name: string; hash: string; createdAt: Date }>(C.apiTokens)
      .find({ name: p.name, revokedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();
    if (!newest || newest.hash !== sha(token)) throw new UnauthorizedException('Chỉ token mới nhất mới xác nhận được việc đổi token');
    const r = await this.db
      .col(C.apiTokens)
      .updateMany({ name: p.name, hash: { $ne: newest.hash }, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    await this.db.audit(p.name, 'device.rotate_commit', p.name, { revoked: r.modifiedCount });
    return { revoked: r.modifiedCount };
  }
}
