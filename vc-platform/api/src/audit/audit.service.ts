/**
 * Audit log (VH-ADM-01, VH-BR-18; 05 mục 3.18). Every change writes its row with `record(session, …)` inside the same
 * transaction: if the row cannot be written, the change is not saved. Rows are only inserted, never updated or removed
 * (the API's MongoDB role has only `find` and `insert` on `audit_log`).
 */
import { Inject, Injectable } from '@nestjs/common';
import type { ClientSession, Db, ObjectId } from 'mongodb';
import { CLOCK, type Clock } from '../common/clock';
import { C } from '../db/collections';
import { DB } from '../db/mongo';
import type { Viewer } from '../auth/viewer';
import { rowHash, stripUndefined } from './canonical';

export type ActorType = 'nguoi' | 'he_thong' | 'app' | 'vc_id';
export type SourceType = 'man_hinh' | 'job' | 'api' | 'nhap_excel' | 'script';

export interface Actor {
  type: ActorType;
  person_id: string | null;
  employee_code: string | null;
  app_key: string | null;
  on_behalf_of_person_id: string | null;
  /** VC ID account; set even before the account is linked to a profile. */
  sub?: string | null;
}

export interface AuditInput {
  actor: Actor;
  action: string;
  target: { type: string; id: string; label: string };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ip_prefix?: string | null;
  correlation_id: string;
  /** Effective date of the change (kế hoạch GĐ B mục 3.4 điểm 14). */
  effective_on?: string;
  source: { type: SourceType; ref?: string };
  seal?: { day_on: string; row_count: number; chain_hash: string; prev_chain_hash: string | null };
}

export interface AuditRow extends AuditInput {
  _id?: ObjectId;
  at: Date;
  hash: string;
  expires_at: Date;
}

/** 24 months (Q-10). */
export function expiresAt(at: Date): Date {
  const d = new Date(at);
  d.setUTCMonth(d.getUTCMonth() + 24);
  return d;
}

export const SYSTEM: Actor = { type: 'he_thong', person_id: null, employee_code: null, app_key: null, on_behalf_of_person_id: null, sub: null };

export function actorOf(v: Viewer): Actor {
  return { type: 'nguoi', person_id: v.personId, employee_code: v.employeeCode, app_key: null, on_behalf_of_person_id: null, sub: v.sub };
}

/** IPv4 without the last group, IPv6 to /48 (05 mục 3.18). */
export function ipPrefix(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const v4 = /^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.\d+$/.exec(ip);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (ip.includes(':')) {
    const groups = ip.split('::')[0].split(':').filter(Boolean).slice(0, 3);
    return `${groups.join(':')}::/48`;
  }
  return null;
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private get col() {
    return this.db.collection<AuditRow>(C.auditLog);
  }

  async record(session: ClientSession, input: AuditInput): Promise<AuditRow> {
    if (input.reason && input.reason.length > 300) throw new Error('Lý do tối đa 300 ký tự');
    const at = this.clock.now();
    const row: AuditRow = stripUndefined({ ...input, at, expires_at: expiresAt(at), hash: '' });
    row.hash = rowHash(row as unknown as Record<string, unknown>);
    await this.col.insertOne(row, { session });
    return row;
  }
}
