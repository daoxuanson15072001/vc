/**
 * The person making a request (khung chung mục 7). Assigned roles come from the token (`resource_access.vchome.roles`,
 * GĐ B); the profile link comes from `accounts` (cached 60 seconds); derived roles (manager, head of unit) are added by
 * enrichers that later sessions register (B-05, B-07).
 */
import { Inject, Injectable } from '@nestjs/common';
import { HOME_ROLE, roleConflicts, type Role } from '@vc/contracts';
import type { Db } from 'mongodb';
import { LOGGER, type JsonLogger } from '../common/logger';
import { ENV, type Env } from '../config/env';
import { C } from '../db/collections';
import { DB } from '../db/mongo';
import type { AccessClaims } from './token-verifier';

export interface Viewer {
  sub: string;
  email: string | null;
  personId: string | null;
  employeeCode: string | null;
  /** Assigned VC Home roles kept after the separation-of-duty check, e.g. `qtht`, `hcns@VCPARTS`. */
  assigned: string[];
  /** HC-NS scope: the whole group, some legal entity or division codes, or not HC-NS. */
  hcnsScope: 'all' | string[] | null;
  roles: Set<Role>;
  /** Forbidden pairs found in the token; both roles of a pair are dropped (kế hoạch GĐ B mục 3.4 điểm 6). */
  conflicts: string[];
}

export type ViewerEnricher = (viewer: Viewer, db: Db) => Promise<void>;

interface AccountLink {
  personId: string | null;
  employeeCode: string | null;
}

@Injectable()
export class ViewerService {
  private readonly cache = new Map<string, { at: number; link: AccountLink }>();
  private readonly enrichers: ViewerEnricher[] = [];

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(LOGGER) private readonly log: JsonLogger,
  ) {}

  /** Called by modules in onModuleInit (e.g. people adds `quan_ly`). */
  addEnricher(e: ViewerEnricher): void {
    this.enrichers.push(e);
  }

  /** Forget the cached link of one person (after linking or unlinking an account). */
  forget(sub: string): void {
    this.cache.delete(sub);
  }

  private async link(sub: string): Promise<AccountLink> {
    const hit = this.cache.get(sub);
    if (hit && Date.now() - hit.at < 60_000) return hit.link;
    const acc = await this.db
      .collection<{ _id: string; person_id?: unknown; employee_code?: string }>(C.accounts)
      .findOne({ _id: sub }, { projection: { person_id: 1, employee_code: 1 } });
    const link = { personId: acc?.person_id ? String(acc.person_id) : null, employeeCode: acc?.employee_code ?? null };
    this.cache.set(sub, { at: Date.now(), link });
    return link;
  }

  async fromClaims(claims: AccessClaims): Promise<Viewer> {
    const raw = (claims.resource_access?.[this.env.OIDC_SPA_CLIENT_ID]?.roles ?? []).filter((r) => HOME_ROLE.test(r));
    const pairs = roleConflicts(raw);
    const dropped = new Set(pairs.flat());
    const assigned = raw.filter((r) => !dropped.has(r.split('@')[0]));
    if (pairs.length) this.log.write('warn', 'tach_nhiem_xung_dot', { sub: claims.sub, pairs: pairs.map((p) => p.join('+')) });

    const link = await this.link(claims.sub);
    const hcns = assigned.filter((r) => r.startsWith('hcns'));
    const roles = new Set<Role>();
    if (link.personId) roles.add('nhan_vien');
    for (const r of assigned) roles.add(r.split('@')[0] as Role);
    const viewer: Viewer = {
      sub: claims.sub,
      email: claims.email ?? null,
      ...link,
      assigned,
      hcnsScope: hcns.length === 0 ? null : hcns.includes('hcns') ? 'all' : hcns.map((r) => r.slice(5)),
      roles,
      conflicts: pairs.map((p) => p.join('+')),
    };
    for (const e of this.enrichers) await e(viewer, this.db);
    return viewer;
  }
}
