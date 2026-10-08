import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CHANNEL_INFO,
  SELF_EDIT_MESSAGE,
  channelOfUid,
  type ChannelAccessInput,
  type ChannelAssignRow,
  type PendingNickRow,
  type RoleKey,
} from '@vclinks/shared';
import { TokenService, type Principal } from '../auth/token.service';
import { AUTHZ_C, type ChannelAccessDoc } from '../authz/authz.types';
import { AuthzService } from '../authz/authz.service';
import { C, CHANNEL_SCOPED, DbService } from '../db/db.service';
import { runUnscoped } from '../db/tenant-context';
import { ORG_C, type OrgUnitDoc, type RoleAssignmentDoc } from '../org/org.types';
import type { UserDoc } from '../users/users.service';
import type { AccountDoc } from '../accounts/accounts.service';

/** Levels a role may receive (docs 01 §2.5). Roles absent here receive none. */
const LEVELS_OF_ROLE: Partial<Record<RoleKey, string[]>> = {
  nvkd: ['giu_nick'],
  giam_sat_bh: ['giu_nick'],
  cskh: ['gui', 'xem'],
  marketing: ['lead', 'xem'],
  ke_toan: ['gui'],
  nv_thi_truong: ['giu_nick', 'gui'],
};

const isOfficial = (uid: string) => CHANNEL_INFO[channelOfUid(uid)].sendMode === 'api';
const accessId = (uid: string, type: string, id: string, level: string) => `${uid}:${type}:${id}:${level}`;

/**
 * Channel assignment (MH-PQ-06): who holds a personal nick, who works an official channel. Writes
 * `channel_access`, which the permission engine reads (M1b-04). Nicks registered by an unknown device
 * wait in `accounts.status = cho_xac_nhan` until an Admin confirms or rejects them (PQ-52 d).
 */
@Injectable()
export class ChannelAccessService {
  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    private readonly tokens: TokenService,
  ) {}

  private defaultDivision() {
    return process.env.AUTHZ_DEFAULT_DIVISION?.trim() || null;
  }

  private async names(userIds: string[], unitIds: string[]) {
    const [users, units] = await runUnscoped(() =>
      Promise.all([
        userIds.length ? this.db.col<UserDoc>(C.users).find({ _id: { $in: userIds } as never }).toArray() : [],
        unitIds.length ? this.db.col<OrgUnitDoc>(ORG_C.orgUnits).find({ _id: { $in: unitIds } as never }).toArray() : [],
      ]),
    );
    return {
      user: new Map(users.map((u) => [String(u._id), (u as unknown as { fullName: string }).fullName])),
      unit: new Map(units.map((u) => [u._id, u.name])),
    };
  }

  /** Channels of the caller's data scope (the account collection is scoped by the guard) with their assignments. */
  async list(q: { division?: string; channel?: string; search?: string }): Promise<{ items: ChannelAssignRow[]; pendingCount: number }> {
    const accounts = await this.db.col<AccountDoc & { divisionId?: string | null }>(C.accounts).find({}).sort({ label: 1 }).toArray();
    const live = accounts.filter((a) => a.status !== 'cho_xac_nhan');
    const pendingCount = await runUnscoped(() => this.db.col(C.accounts).countDocuments({ status: 'cho_xac_nhan' }));
    const dflt = this.defaultDivision();
    const uids = live.map((a) => a._id);
    const access = await this.db.col<ChannelAccessDoc>(AUTHZ_C.channelAccess).find({ channelId: { $in: uids } }).toArray();
    const n = await this.names(
      access.filter((x) => x.principalType === 'user').map((x) => x.principalId),
      access.filter((x) => x.principalType === 'org_unit').map((x) => x.principalId),
    );
    const now = Date.now();
    const rows = live
      .map<ChannelAssignRow>((a) => {
        const mine = access.filter((x) => x.channelId === a._id && (!x.to || x.to.getTime() > now));
        const holder = mine.find((x) => x.level === 'giu_nick' && x.principalType === 'user');
        return {
          uid: a._id,
          label: a.label,
          channel: channelOfUid(a._id),
          divisionId: a.divisionId ?? dflt,
          holderUserId: holder?.principalId ?? null,
          holderName: holder ? (n.user.get(holder.principalId) ?? holder.principalId) : null,
          unsafe: !!a.unsafe,
          access: mine.map((x) => ({
            id: x._id,
            principalType: x.principalType,
            principalId: x.principalId,
            principalName: (x.principalType === 'user' ? n.user.get(x.principalId) : n.unit.get(x.principalId)) ?? x.principalId,
            level: x.level as ChannelAssignRow['access'][number]['level'],
            from: x.from?.toISOString() ?? null,
            to: x.to?.toISOString() ?? null,
            note: x.note ?? null,
          })),
        };
      })
      .filter((r) => (!q.division || r.divisionId === q.division) && (!q.channel || r.channel === q.channel))
      .filter((r) => !q.search || `${r.label} ${r.uid} ${r.holderName ?? ''}`.toLowerCase().includes(q.search.toLowerCase()));
    // Personal nicks without a holder first (MH-PQ-06 #3).
    rows.sort((a, b) => Number(!!a.holderUserId || isOfficial(a.uid)) - Number(!!b.holderUserId || isOfficial(b.uid)));
    return { items: rows, pendingCount };
  }

  private async account(uid: string) {
    // Admin rights come from the route's channel.access check; the chat data scope (conv.view) does not apply here.
    const a = await runUnscoped(() => this.db.col<AccountDoc & { divisionId?: string | null }>(C.accounts).findOne({ _id: uid }));
    if (!a || a.status === 'cho_xac_nhan') throw new NotFoundException('Không tìm thấy kênh');
    return a;
  }

  /** Active role keys and divisions of a user. */
  private async rolesOf(userId: string) {
    const now = Date.now();
    const as = await runUnscoped(() => this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments).find({ userId }).toArray());
    const live = as.filter((a) => (!a.from || a.from.getTime() <= now) && (!a.to || a.to.getTime() > now));
    const units = await runUnscoped(() => this.db.col<OrgUnitDoc>(ORG_C.orgUnits).find({ _id: { $in: live.map((a) => a.orgUnitId) } as never }).toArray());
    const byId = new Map(units.map((u) => [u._id, u]));
    return { roles: live.map((a) => a.roleKey), divisions: [...new Set(live.map((a) => byId.get(a.orgUnitId)?.divisionId).filter((d): d is string => !!d))] };
  }

  async add(uid: string, input: ChannelAccessInput, replace: boolean, p: Principal) {
    const acc = await this.account(uid);
    const official = isOfficial(uid);
    if (input.principalType === 'user' && input.principalId === p.userId) throw new ForbiddenException(SELF_EDIT_MESSAGE);
    if (input.level === 'giu_nick' && (official || input.principalType !== 'user')) throw new BadRequestException('Chỉ kênh cá nhân có người giữ nick, và phải là một người.');
    if (official && input.level === 'giu_nick') throw new BadRequestException('Kênh chính thức không có người giữ nick.');
    if (!official && input.level !== 'giu_nick') throw new BadRequestException('Kênh cá nhân chỉ gán mức "Người giữ nick"; người khác gửi qua nick bằng trực thay hoặc trả lời thay.');
    const division = acc.divisionId ?? this.defaultDivision();

    let name = input.principalId;
    if (input.principalType === 'user') {
      const user = await runUnscoped(() => this.db.col<UserDoc>(C.users).findOne({ _id: input.principalId as never }));
      if (!user) throw new NotFoundException('Không tìm thấy người dùng');
      name = (user as unknown as { fullName: string }).fullName;
      const { roles, divisions } = await this.rolesOf(input.principalId);
      const ok = roles.some((r) => LEVELS_OF_ROLE[r]?.includes(input.level));
      if (!ok) throw new BadRequestException(`Vai trò của ${name} không nhận mức "${input.level}".`);
      if (division && divisions.length && !divisions.includes(division)) {
        throw new ConflictException(`${name} thuộc division khác. Gán chéo division cần người duyệt thứ hai (PQ-42), chưa có ở bản này.`);
      }
    } else {
      const unit = await runUnscoped(() => this.db.col<OrgUnitDoc>(ORG_C.orgUnits).findOne({ _id: input.principalId as never }));
      if (!unit || unit.active === false) throw new NotFoundException('Không tìm thấy đơn vị');
      name = unit.name;
      if (division && unit.divisionId && unit.divisionId !== division) {
        throw new ConflictException(`${unit.name} thuộc division khác. Gán chéo division cần người duyệt thứ hai (PQ-42), chưa có ở bản này.`);
      }
    }

    const col = this.db.col<ChannelAccessDoc>(AUTHZ_C.channelAccess);
    if (input.level === 'giu_nick') {
      const current = await col.find({ channelId: uid, level: 'giu_nick' }).toArray();
      if (current.some((c) => c.principalId === input.principalId)) throw new ConflictException('Người này đang giữ nick rồi.');
      if (current.length) {
        if (!replace) throw new ConflictException('Nick đã có người giữ. Dùng "Đổi người giữ nick".');
        if ((input.note ?? '').length < 10) throw new BadRequestException('Cần ghi lý do đổi người giữ nick (ít nhất 10 ký tự).');
        await col.deleteMany({ channelId: uid, level: 'giu_nick' });
        await this.db.audit(p.name, 'channel.holder_change', uid, { from: current.map((c) => c.principalId), to: input.principalId });
      }
    }
    const doc: ChannelAccessDoc = {
      _id: accessId(uid, input.principalType, input.principalId, input.level),
      channelId: uid,
      principalType: input.principalType,
      principalId: input.principalId,
      level: input.level,
      from: input.from ? new Date(input.from) : new Date(),
      to: input.to ? new Date(input.to) : null,
      createdBy: p.name,
      ...(input.note ? { note: input.note } : {}),
    };
    await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
    this.authz.invalidate();
    await this.db.audit(p.name, 'channel.access_add', uid, { principalType: input.principalType, principalId: input.principalId, level: input.level });
    return { id: doc._id, message: `Đã gán ${acc.label} cho ${name} (mức ${input.level}).` };
  }

  async update(uid: string, id: string, patch: { from?: string; to?: string | null; note?: string }, p: Principal) {
    await this.account(uid);
    const set: Record<string, unknown> = {};
    if (patch.from) set.from = new Date(patch.from);
    if (patch.to !== undefined) set.to = patch.to ? new Date(patch.to) : null;
    if (patch.note !== undefined) set.note = patch.note;
    const r = await this.db.col<ChannelAccessDoc>(AUTHZ_C.channelAccess).updateOne({ _id: id, channelId: uid }, { $set: set });
    if (!r.matchedCount) throw new NotFoundException('Không tìm thấy dòng gán');
    this.authz.invalidate();
    await this.db.audit(p.name, 'channel.access_update', uid, { id });
    return { ok: true };
  }

  async remove(uid: string, id: string, p: Principal) {
    await this.account(uid);
    const col = this.db.col<ChannelAccessDoc>(AUTHZ_C.channelAccess);
    const row = await col.findOne({ _id: id, channelId: uid });
    if (!row) throw new NotFoundException('Không tìm thấy dòng gán');
    if (row.level === 'giu_nick') throw new ConflictException('Chọn người giữ nick mới thay vì gỡ.');
    if (row.principalType === 'user' && row.principalId === p.userId) throw new ForbiddenException(SELF_EDIT_MESSAGE);
    await col.deleteOne({ _id: id });
    this.authz.invalidate();
    await this.db.audit(p.name, 'channel.access_remove', uid, { principalType: row.principalType, principalId: row.principalId, level: row.level });
    return { ok: true };
  }

  /** Nicks waiting for an Admin: counts only, never content (MH-PQ-06 #10). */
  async pending(): Promise<PendingNickRow[]> {
    const rows = await runUnscoped(() => this.db.col<AccountDoc>(C.accounts).find({ status: 'cho_xac_nhan' }).toArray());
    return Promise.all(
      rows.map(async (a) => ({
        uid: a._id,
        label: a.label,
        channel: channelOfUid(a._id),
        deviceName: a.pendingDevice ?? null,
        registeredAt: a.createdAt.toISOString(),
        records: await runUnscoped(() => this.db.col(C.messages).countDocuments({ uid: a._id })),
      })),
    );
  }

  /** Admin confirms a pending nick into a division, optionally naming its holder. */
  async confirm(uid: string, input: { divisionId: string; holderUserId?: string }, p: Principal) {
    const a = await runUnscoped(() => this.db.col<AccountDoc>(C.accounts).findOne({ _id: uid, status: 'cho_xac_nhan' }));
    if (!a) throw new NotFoundException('Không có nick chờ xác nhận này');
    const unit = await runUnscoped(() => this.db.col<OrgUnitDoc>(ORG_C.orgUnits).findOne({ _id: input.divisionId as never, type: 'division' } as never));
    if (!unit) throw new BadRequestException('Chọn một division hợp lệ');
    await runUnscoped(() => this.db.col<AccountDoc>(C.accounts).updateOne({ _id: uid }, { $set: { divisionId: input.divisionId } as never, $unset: { status: '', pendingDevice: '' } }));
    this.authz.invalidate();
    await this.db.audit(p.name, 'channel.confirm', uid, { divisionId: input.divisionId });
    if (input.holderUserId) await this.add(uid, { principalType: 'user', principalId: input.holderUserId, level: 'giu_nick', note: 'Xác nhận nick chờ' }, false, p);
    return { message: `Đã xác nhận nick ${a.label} vào ${unit.name}.` };
  }

  /**
   * Máy Zalo (connect by QR): may this user hold a personal nick of the division? Same checks as add() with level
   * giu_nick, run when the Admin creates the slot, so the binding after the scan cannot fail on them.
   */
  async assertCanHold(userId: string, divisionId: string): Promise<string> {
    const user = await runUnscoped(() => this.db.col<UserDoc>(C.users).findOne({ _id: userId as never }));
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    const name = (user as unknown as { fullName: string }).fullName;
    const { roles, divisions } = await this.rolesOf(userId);
    if (!roles.some((r) => LEVELS_OF_ROLE[r]?.includes('giu_nick'))) throw new BadRequestException(`Vai trò của ${name} không nhận mức "Người giữ nick".`);
    if (divisions.length && !divisions.includes(divisionId)) throw new ConflictException(`${name} thuộc division khác.`);
    return name;
  }

  /**
   * Máy Zalo: the nick that just logged in by QR joins the division chosen by the Admin when the slot was created,
   * with that holder unless the nick already has one (as confirm() + add() do, logged under the Admin's name).
   */
  async attachConnectedNick(uid: string, divisionId: string, holderUserId: string, actor: string): Promise<{ holderSet: boolean }> {
    const accounts = this.db.col<AccountDoc & { divisionId?: string | null }>(C.accounts);
    const a = await runUnscoped(() => accounts.findOne({ _id: uid }));
    if (!a) throw new NotFoundException('Không tìm thấy kênh');
    if (!a.divisionId || a.status === 'cho_xac_nhan') {
      await runUnscoped(() => accounts.updateOne({ _id: uid }, { $set: { divisionId } as never, $unset: { status: '', pendingDevice: '' } }));
      await this.db.audit(actor, 'channel.confirm', uid, { divisionId, via: 'may_zalo' });
    }
    const col = this.db.col<ChannelAccessDoc>(AUTHZ_C.channelAccess);
    let holderSet = false;
    if (!(await col.countDocuments({ channelId: uid, level: 'giu_nick' }, { limit: 1 }))) {
      const doc: ChannelAccessDoc = {
        _id: accessId(uid, 'user', holderUserId, 'giu_nick'),
        channelId: uid,
        principalType: 'user',
        principalId: holderUserId,
        level: 'giu_nick',
        from: new Date(),
        to: null,
        createdBy: actor,
        note: 'Kết nối bằng mã QR (máy Zalo)',
      };
      await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
      await this.db.audit(actor, 'channel.access_add', uid, { principalType: 'user', principalId: holderUserId, level: 'giu_nick', via: 'may_zalo' });
      holderSet = true;
    }
    this.authz.invalidate();
    return { holderSet };
  }

  /** Reject: delete what the device sent for this nick and cut the device's right to it. */
  async reject(uid: string, reason: string, p: Principal) {
    if (reason.trim().length < 10) throw new BadRequestException('Cần ghi lý do (ít nhất 10 ký tự).');
    const a = await runUnscoped(() => this.db.col<AccountDoc>(C.accounts).findOne({ _id: uid, status: 'cho_xac_nhan' }));
    if (!a) throw new NotFoundException('Không có nick chờ xác nhận này');
    let deleted = 0;
    await runUnscoped(async () => {
      for (const [col, field] of Object.entries(CHANNEL_SCOPED)) {
        if (col === C.accounts) continue;
        const r = await this.db.col(col).deleteMany({ [field]: uid });
        if (col === C.messages) deleted += r.deletedCount;
      }
      await this.db.col(C.accounts).deleteOne({ _id: uid } as never);
      await this.db.col(C.apiTokens).updateMany({ uids: uid } as never, { $pull: { uids: uid } } as never);
    });
    this.authz.invalidate();
    this.tokens.forgetCache();
    // The audit keeps ids and counts only, never content.
    await this.db.audit(p.name, 'channel.reject', uid, { messages: deleted, reasonLength: reason.length });
    return { message: `Đã từ chối nick ${a.label} và xóa ${deleted} bản ghi đã nhận.` };
  }
}
