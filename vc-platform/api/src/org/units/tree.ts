/**
 * Rules of the unit tree (02 VH-BR-06; 04 VH-ORG-01 bước 3, 7; kế hoạch GĐ B mục 3.3 điểm 4): placement by type,
 * one root, Tổ / Nhóm nested one level, no cycle, depth ≤ 8, and the fields derived from the parent for a whole branch.
 */
import { MAX_UNIT_DEPTH, UNIT_MSG, UNIT_PARENTS, UNIT_TYPE_LABEL, fillMsg, type UnitType } from '@vc/contracts';
import type { AnyBulkWriteOperation, ClientSession, Db } from 'mongodb';
import { ApiError } from '../../common/api-error';
import { C } from '../../db/collections';
import type { OrgUnitDoc } from './types';

const rule = (message: string, details?: unknown) => new ApiError('rule_violation', { message, details });

export const units = (db: Db) => db.collection<OrgUnitDoc>(C.orgUnits);

/** A unit of this type may sit under this parent (type rule and the one-level nesting of Tổ / Nhóm). */
export function checkPlacement(type: UnitType, parent: Pick<OrgUnitDoc, 'type' | 'parent_code'> | null, parentOfParentType: UnitType | null, hasNestedTeams = false): void {
  if (type === 'tap_doan' || !parent) throw rule(UNIT_MSG.oneRoot);
  if (!UNIT_PARENTS[type].includes(parent.type)) {
    throw rule(fillMsg(UNIT_MSG.placement, { loai: UNIT_TYPE_LABEL[type], loai_cha: UNIT_PARENTS[type].map((t) => UNIT_TYPE_LABEL[t]).join(', ') }));
  }
  // Tổ / Nhóm under a Tổ / Nhóm: only if that one is not itself nested, and the moving one holds no Tổ / Nhóm.
  if (type === 'to_nhom' && parent.type === 'to_nhom' && (parentOfParentType === 'to_nhom' || hasNestedTeams)) throw rule(UNIT_MSG.nested);
}

export function depthOf(u: Pick<OrgUnitDoc, 'ancestors'>): number {
  return u.ancestors.length + 1;
}

/** Fields that follow from the parent (kế hoạch GĐ B mục 3.3 điểm 4). */
export function derive(u: Pick<OrgUnitDoc, '_id' | 'type' | 'legal_entity_code'>, parent: OrgUnitDoc | null): Pick<OrgUnitDoc, 'ancestors' | 'division_code' | 'legal_entity_code'> {
  const ownLegal = u.type === 'phap_nhan' || !parent || parent.type === 'tap_doan';
  return {
    ancestors: parent ? [...parent.ancestors, parent._id] : [],
    division_code: u.type === 'division' ? u._id : (parent?.division_code ?? null),
    legal_entity_code: ownLegal ? u.legal_entity_code : parent.legal_entity_code,
  };
}

/** True when the unit's legal entity is its own choice rather than its parent's. */
export function ownsLegalEntity(type: UnitType, parent: Pick<OrgUnitDoc, 'type'> | null): boolean {
  return type === 'phap_nhan' || !parent || parent.type === 'tap_doan';
}

/** Units under `code` (not deleted), closest first. */
export async function descendants(db: Db, code: string, session?: ClientSession): Promise<OrgUnitDoc[]> {
  const docs = await units(db).find({ ancestors: code, deleted_at: null }, { session }).toArray();
  return docs.sort((a, b) => a.ancestors.length - b.ancestors.length);
}

/** Height of the branch under a unit: 0 for a leaf. */
export function branchHeight(root: OrgUnitDoc, below: OrgUnitDoc[]): number {
  return below.reduce((h, d) => Math.max(h, d.ancestors.length - root.ancestors.length), 0);
}

/** Checks a move of `unit` under `target`: cycle, placement, depth (kế hoạch GĐ B mục 3.3 điểm 4). */
export function checkMove(unit: OrgUnitDoc, target: OrgUnitDoc, targetParentType: UnitType | null, below: OrgUnitDoc[]): void {
  if (target._id === unit._id || target.ancestors.includes(unit._id)) {
    throw rule(fillMsg(UNIT_MSG.cycle, { dich: target.name, don_vi: unit.name }));
  }
  const nestedTeams = unit.type === 'to_nhom' && below.some((d) => d.type === 'to_nhom');
  checkPlacement(unit.type, target, targetParentType, nestedTeams);
  if (depthOf(target) + 1 + branchHeight(unit, below) > MAX_UNIT_DEPTH) throw rule(UNIT_MSG.depth);
}

/**
 * Writes `ancestors`, `division_code`, `legal_entity_code` for a unit (already holding its new parent and own fields)
 * and every unit under it, top-down, in the caller's transaction. Returns the codes that changed.
 */
export async function recomputeBranch(db: Db, code: string, session: ClientSession, now: Date): Promise<string[]> {
  const col = units(db);
  const top = (await col.findOne({ _id: code }, { session })) as OrgUnitDoc;
  const parent = top.parent_code ? await col.findOne({ _id: top.parent_code }, { session }) : null;
  // Descendants are found by the old ancestors, which still hold the top unit's code.
  const below = await descendants(db, code, session);
  const done = new Map<string, OrgUnitDoc>();
  const ops: AnyBulkWriteOperation<OrgUnitDoc>[] = [];
  const changed: string[] = [];
  for (const u of [top, ...below]) {
    const p = u._id === code ? parent : (done.get(u.parent_code as string) ?? null);
    const next = { ...u, ...derive(u, p) };
    done.set(u._id, next);
    if (JSON.stringify([u.ancestors, u.division_code, u.legal_entity_code]) !== JSON.stringify([next.ancestors, next.division_code, next.legal_entity_code])) {
      changed.push(u._id);
      ops.push({
        updateOne: {
          filter: { _id: u._id },
          update: { $set: { ancestors: next.ancestors, division_code: next.division_code, legal_entity_code: next.legal_entity_code, updated_at: now }, ...(u._id === code ? {} : { $inc: { rev: 1, event_seq: 1 } }) },
        },
      });
    }
  }
  if (ops.length) await col.bulkWrite(ops, { session, ordered: true });
  return changed;
}
