/**
 * Daily seal and chain check (VH-ADM-01 bước 6): at 00:10 a row `audit.daily_seal` chains the hashes of the previous
 * day's rows with the previous seal; at 00:20 the chain and every row hash are checked again.
 */
import { addDays, toEffectiveAt, ymdInVn } from '@vc/contracts';
import type { Db } from 'mongodb';
import { withTx } from '../common/tx';
import { C } from '../db/collections';
import { SYSTEM, type AuditRow, type AuditService } from './audit.service';
import { rowHash, sha256 } from './canonical';

export const SEAL_ACTION = 'audit.daily_seal';
/** Days checked row by row each night; older seals are checked only for their links. */
export const VERIFY_DAYS = 35;

const col = (db: Db) => db.collection<AuditRow>(C.auditLog);

async function dayRows(db: Db, day: string): Promise<AuditRow[]> {
  return col(db)
    .find({ at: { $gte: toEffectiveAt(day), $lt: toEffectiveAt(addDays(day, 1)) }, action: { $ne: SEAL_ACTION } })
    .sort({ at: 1, _id: 1 })
    .toArray();
}

export function chain(prev: string | null, rows: { hash: string }[]): string {
  return sha256(`${prev ?? 'goc'}\n${rows.map((r) => r.hash).join('\n')}`);
}

async function lastSeal(db: Db): Promise<AuditRow | null> {
  return col(db).findOne({ action: SEAL_ACTION }, { sort: { 'seal.day_on': -1 } });
}

/** Seals every day from the day after the last seal up to `upTo` (inclusive). Returns the days sealed. */
export async function sealDays(db: Db, client: Parameters<typeof withTx>[0], audit: AuditService, upTo: string, correlationId: string): Promise<string[]> {
  const last = await lastSeal(db);
  let day: string;
  if (last?.seal) day = addDays(last.seal.day_on, 1);
  else {
    const first = await col(db).findOne({ action: { $ne: SEAL_ACTION } }, { sort: { at: 1 } });
    if (!first) return [];
    day = ymdInVn(first.at);
  }
  const sealed: string[] = [];
  let prev = last?.seal?.chain_hash ?? null;
  for (; day <= upTo && sealed.length < 62; day = addDays(day, 1)) {
    const rows = await dayRows(db, day);
    const chainHash = chain(prev, rows);
    const d = day;
    const p = prev;
    await withTx(client, async (session) => {
      await audit.record(session, {
        actor: SYSTEM,
        action: SEAL_ACTION,
        target: { type: 'audit_day', id: d, label: d },
        correlation_id: correlationId,
        source: { type: 'job', ref: 'audit.daily-seal' },
        seal: { day_on: d, row_count: rows.length, chain_hash: chainHash, prev_chain_hash: p },
      });
    });
    sealed.push(day);
    prev = chainHash;
  }
  return sealed;
}

export interface ChainProblem {
  day_on: string;
  problem: 'hash_dong' | 'chuoi' | 'noi_niem_phong';
  detail: string;
}

/** Checks seal links, and for the last VERIFY_DAYS days every row hash and the chain. */
export async function verifyChain(db: Db, today: string): Promise<ChainProblem[]> {
  const problems: ChainProblem[] = [];
  const seals = await col(db).find({ action: SEAL_ACTION }).sort({ 'seal.day_on': 1 }).toArray();
  const from = addDays(today, -VERIFY_DAYS);
  let prevChain: string | null | undefined;
  for (const s of seals) {
    const seal = s.seal!;
    if (rowHash(s as unknown as Record<string, unknown>) !== s.hash) problems.push({ day_on: seal.day_on, problem: 'hash_dong', detail: 'dòng niêm phong bị sửa' });
    if (prevChain !== undefined && seal.prev_chain_hash !== prevChain) problems.push({ day_on: seal.day_on, problem: 'noi_niem_phong', detail: 'không nối với niêm phong ngày trước' });
    prevChain = seal.chain_hash;
    if (seal.day_on < from) continue;
    const rows = await dayRows(db, seal.day_on);
    for (const r of rows) {
      if (rowHash(r as unknown as Record<string, unknown>) !== r.hash) problems.push({ day_on: seal.day_on, problem: 'hash_dong', detail: `dòng ${String(r._id)} bị sửa` });
    }
    if (chain(seal.prev_chain_hash, rows) !== seal.chain_hash || rows.length !== seal.row_count) {
      problems.push({ day_on: seal.day_on, problem: 'chuoi', detail: `chuỗi lệch (đếm ${rows.length}, niêm phong ${seal.row_count})` });
    }
  }
  return problems;
}
