import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import {
  foldVi,
  maskPhone,
  type MePermissions,
  type MeProfile,
  type NotificationList,
  type PresenceInput,
  type PresenceStatus,
  type QuickSearchItem,
  type QuickSearchResponse,
} from '@vclinks/shared';
import type { Document } from 'mongodb';
import type { Principal } from '../auth/token.service';
import type { Subject } from '../authz/engine';
import { CustomersService } from '../customers/customers.service';
import { C, DbService } from '../db/db.service';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface PresenceDoc {
  status: PresenceStatus;
  until?: Date;
  setAt: Date;
}

/** App shell backend (M1b-08): quick search, own profile and presence status, notification list skeleton. */
@Injectable()
export class ShellService {
  constructor(
    private readonly db: DbService,
    @Optional() private readonly customers?: CustomersService,
  ) {}

  /**
   * Ctrl+K search (MH-UI-04) over contacts by name, phone digits or customer code. The read goes through
   * the scoped collection, so a user only finds contacts of channels inside their data scope. Phones are
   * always returned masked. Customer accounts (M1b-13) are a second source: found by name, phone or VCsales
   * code inside the accounts the viewer may see, listed before the contacts.
   */
  async quickSearch(q: string, limit: number, u?: Subject): Promise<QuickSearchResponse> {
    const t0 = Date.now();
    const digits = q.replace(/\D/g, '');
    const or: Document[] = [{ domNameFold: { $regex: `^${escapeRe(foldVi(q))}` } }, { domNameFold: { $regex: `\\b${escapeRe(foldVi(q))}` } }];
    if (digits.length >= 3 && digits.length === q.replace(/[\s.+-]/g, '').length) or.push({ phone: { $regex: escapeRe(digits) } });
    or.push({ customerCode: q.toUpperCase() });
    const docs = await this.db
      .col(C.contacts)
      .find({ $or: or }, { projection: { uid: 1, userId: 1, domName: 1, phone: 1, encrypted: 1, customerCode: 1 } })
      .limit(limit)
      .toArray();
    const convIds = docs.map((d) => d._id);
    const convs = await this.db.col(C.conversations).find({ _id: { $in: convIds } }, { projection: { _id: 1 } }).toArray();
    const have = new Set(convs.map((c) => String(c._id)));
    const items: QuickSearchItem[] = docs.map((d) => ({
      kind: 'contact',
      conversationId: have.has(String(d._id)) ? String(d._id) : null,
      uid: String(d.uid),
      userId: String(d.userId),
      name: typeof d.domName === 'string' ? d.domName : '',
      phone: d.encrypted || typeof d.phone !== 'string' ? null : maskPhone(d.phone),
      customerCode: typeof d.customerCode === 'string' ? d.customerCode : null,
    }));
    const customers = this.customers ? await this.customers.quickSearch(q, Math.min(limit, 10), u).catch(() => []) : [];
    return { items: [...customers, ...items], tookMs: Date.now() - t0 };
  }

  async profile(p: Principal, perms: MePermissions): Promise<MeProfile> {
    const user = p.userId ? await this.db.col(C.users).findOne({ _id: p.userId as never }) : null;
    const pres = this.effectivePresence(user?.presence as PresenceDoc | undefined);
    return {
      userId: p.userId ?? null,
      name: typeof user?.fullName === 'string' ? user.fullName : p.name,
      email: typeof user?.email === 'string' ? user.email : null,
      status: pres.status,
      until: pres.until ? pres.until.toISOString() : null,
      roles: perms.roles.map((r) => ({
        roleKey: r.roleKey,
        ...(r.customRoleId ? { customRoleId: r.customRoleId, customRoleName: r.customRoleName } : {}),
        orgUnitName: r.orgUnitName,
      })),
    };
  }

  /** Manual status. `field` / `away` may carry an end time; after it the status falls back to online. */
  async setPresence(p: Principal, input: PresenceInput): Promise<{ status: PresenceStatus; until: string | null }> {
    if (!p.userId) throw new BadRequestException('Chỉ người dùng đăng nhập mới đổi được trạng thái');
    const until = input.until ? new Date(input.until) : undefined;
    if (until && until.getTime() <= Date.now()) throw new BadRequestException('Thời hạn phải ở tương lai');
    if (until && input.status !== 'field' && input.status !== 'away') throw new BadRequestException('Chỉ "Đi thị trường" và "Vắng" có thời hạn');
    const doc: PresenceDoc = { status: input.status, ...(until ? { until } : {}), setAt: new Date() };
    await this.db.col(C.users).updateOne({ _id: p.userId as never }, { $set: { presence: doc } });
    return { status: doc.status, until: until ? until.toISOString() : null };
  }

  /** Hand-set statuses with an end time expire back to online (MH-UI-05); no record means online. */
  private effectivePresence(d: PresenceDoc | undefined): { status: PresenceStatus; until?: Date } {
    if (!d) return { status: 'online' };
    if (d.until && d.until.getTime() <= Date.now()) return { status: 'online' };
    return { status: d.status, until: d.until };
  }

  /** Skeleton until M1c-07 (realtime) feeds notifications. */
  notifications(): NotificationList {
    return { items: [], unread: 0 };
  }
}
