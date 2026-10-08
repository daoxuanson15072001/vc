import { Injectable } from '@nestjs/common';
import { maskEmail, maskPhone, type CommerceLevel, type CustomerDetail } from '@vclinks/shared';
import { AuthzService } from '../authz/authz.service';
import type { PermissionKey } from '@vclinks/shared';
import { decide, phoneVisibility, type Subject, type Target } from '../authz/engine';

export type PhoneVisibility = 'full' | 'reveal' | 'masked';
const RANK: Record<PhoneVisibility, number> = { masked: 0, reveal: 1, full: 2 };
const defaultDivision = () => process.env.AUTHZ_DEFAULT_DIVISION?.trim() || null;

/**
 * Who sees what of a customer (M1b-13, DK-44, DK-15, 01 `cust.phone_full` / `cust.commerce`).
 *
 * The permission engine already decides phone visibility per channel (`phoneVisibility`); a customer spans
 * several channels and owners, so the targets are built from the customer: one per owner division
 * ("khách của tôi": CT, TỔ of the owner, DV) and one per channel identity (the nick holder, NICK).
 * The best answer over the targets wins. No engine rule is widened: this only feeds it customer targets.
 * Without a user (legacy token, tests) everything shows in full, as `POST /api/reveal` does.
 */
@Injectable()
export class CustomerPrivacyService {
  constructor(private readonly authz: AuthzService) {}

  /** Engine targets of a customer: its owners' divisions and its channel identities. */
  async targets(d: Pick<CustomerDetail, 'owners' | 'contacts'>): Promise<Target[]> {
    const out: Target[] = [];
    const byDivision = new Map<string, string[]>();
    for (const o of d.owners) byDivision.set(o.division, [...(byDivision.get(o.division) ?? []), o.userId]);
    const unitsOf = async (ids: string[]) => [...new Set((await Promise.all(ids.map((i) => this.authz.unitsOf(i)))).flat())];
    for (const [divisionId, ids] of byDivision) out.push({ divisionId, responsibleIds: ids, unitIds: await unitsOf(ids) });
    if (!byDivision.size) out.push({ divisionId: defaultDivision() });
    const uids = [...new Set(d.contacts.flatMap((c) => c.identities.map((i) => i.uid)))];
    for (const uid of uids) {
      const ct = await this.authz.channelTarget(uid);
      const ids = byDivision.get(ct.divisionId ?? '') ?? [];
      out.push({ ...ct, ...(ids.length ? { responsibleIds: ids, unitIds: [...new Set([...(ct.unitIds ?? []), ...(await unitsOf(ids))])] } : {}) });
    }
    return out;
  }

  async phoneVisibility(u: Subject | undefined, d: Pick<CustomerDetail, 'owners' | 'contacts'>): Promise<PhoneVisibility> {
    if (!u) return 'full';
    let best: PhoneVisibility = 'masked';
    for (const t of await this.targets(d)) {
      const v = phoneVisibility(u, t);
      if (RANK[v] > RANK[best]) best = v;
      if (best === 'full') break;
    }
    return best;
  }

  /**
   * Commercial block level: `full` with cust.commerce, else `none`. The CS "orders only" cell
   * (`cust.commerce` CS, condition `orders_only`) stays closed as in docs/04-ky-thuat/api/phan-quyen.md §4
   * until tickets exist (M2): no condition is passed here, so no rule is widened.
   */
  async commerceLevel(u: Subject | undefined, d: Pick<CustomerDetail, 'owners' | 'contacts'>): Promise<CommerceLevel> {
    return (await this.allowed(u, 'cust.commerce', d)) ? 'full' : 'none';
  }

  /** `key` is allowed on the customer (any target: its owners' scope or one of its channel identities). */
  async allowed(u: Subject | undefined, key: PermissionKey, d: Pick<CustomerDetail, 'owners' | 'contacts'>): Promise<boolean> {
    if (!u) return true;
    for (const t of await this.targets(d)) if (decide(u, key, t).allowed) return true;
    return false;
  }

  /** The viewer is one of the customer's owners (an owner the viewer is not turns the owner line orange). */
  isOwner(u: Subject | undefined, d: Pick<CustomerDetail, 'owners'>): boolean {
    return !!u && d.owners.some((o) => o.userId === u.userId);
  }

  /** Masks every phone / email of the view in place unless `vis` is `full`. */
  mask<T extends Pick<CustomerDetail, 'contacts' | 'points'>>(d: T, vis: PhoneVisibility): T {
    if (vis === 'full') return d;
    const points = [...d.points, ...d.contacts.flatMap((c) => c.points)];
    for (const p of points) {
      if (p.phone) p.phone = maskPhone(p.phone);
      if (p.email) p.email = maskEmail(p.email);
      p.masked = true;
      p.revealable = vis === 'reveal';
    }
    return d;
  }
}
