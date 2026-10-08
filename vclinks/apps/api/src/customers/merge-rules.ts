import {
  NEW_IDENTITY_HOURS,
  NEW_IDENTITY_MAX_MESSAGES,
  foldVi,
  verifyRank,
  type ContactPointKind,
  type ContactPointState,
  type MergeBlock,
  type MergeOutcome,
  type MergeSignalCode,
  type MergeSignalView,
  type VerifyLevel,
} from '@vclinks/shared';

/*
 * Merge rules (docs 02 §4.4 signals, §4.5 thresholds, DK-05…DK-08; BA D8-05, QĐ-57 default A).
 * Pure functions: no I/O, so every rule has a table test (merge-rules.spec.ts).
 *
 * Automatic merge only when all of D8-05 hold (and the stricter §4.5 wording):
 *   1. a verified match: T1 / T4 / T6, or T2 when both sides have the same person in charge (QĐ-57 A);
 *   2. one side is a "new identity" (≤ 72 h, no ERP code, no owner other than the other side's, < 20 messages);
 *   3. same person in charge on both sides (owner / nick holder), or nobody in charge of the new side yet;
 * score ≥ 90 and no DK-08 block. Everything else is a suggestion for a person, or nothing.
 */

export interface SidePoint {
  kind: ContactPointKind;
  value: string;
  level: VerifyLevel;
  state: ContactPointState;
  lastActivityAt?: Date | null;
}

export interface MergeSide {
  contactId: string;
  accountId: string;
  name: string | null;
  gender?: 'male' | 'female' | null;
  points: SidePoint[];
  /** Confirmed ERP links of the account. */
  erpCodes: { erp: string; customerId: string }[];
  /** Account owners (all divisions). */
  owners: { division: string; userId: string }[];
  /** People in charge in the pair's division: owners there, else the nick holder of a fresh identity. */
  responsibleIds: string[];
  isInternal?: boolean;
  webChat?: boolean;
  erased?: boolean;
  /** First time VClinks saw the person (identity / ERP record). */
  firstSeenAt: Date;
  messageCount: number;
  mergeLocks?: string[];
}

export interface MergeEvaluation {
  score: number;
  signals: MergeSignalView[];
  blocks: MergeBlock[];
  outcome: MergeOutcome;
  /** The side that is a new identity (absorbed on an automatic merge), if any. */
  newSide: 'a' | 'b' | null;
}

const DAY = 86_400_000;
const DORMANT_MS = 365 * DAY;
/** Words that say nothing about who the customer is. */
const GENERIC = new Set(['garage', 'gara', 'anh', 'chi', 'em', 'co', 'chu', 'ong', 'ba', 'cong', 'ty', 'cty', 'dai', 'ly', 'shop', 'xuong']);

export const nameTokens = (s: string | null | undefined) =>
  new Set(
    foldVi(s ?? '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !GENERIC.has(t)),
  );

/** Jaccard similarity of meaningful name tokens (0…1). */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const t of x) if (y.has(t)) common++;
  return common / (x.size + y.size - common);
}

/** "Danh tính mới" (DK-06, §4.5). */
export function isNewSide(s: MergeSide, other: MergeSide, division: string | null, now: Date): boolean {
  if (now.getTime() - s.firstSeenAt.getTime() > NEW_IDENTITY_HOURS * 3_600_000) return false;
  if (s.erpCodes.length) return false;
  if (s.messageCount >= NEW_IDENTITY_MAX_MESSAGES) return false;
  const otherOwners = new Set(other.owners.filter((o) => !division || o.division === division).map((o) => o.userId));
  return s.owners.filter((o) => !division || o.division === division).every((o) => otherOwners.has(o.userId));
}

const BLOCKING_STATES: Partial<Record<ContactPointState, MergeBlock>> = {
  retired: 'shared_or_retired',
  shared_account: 'shared_or_retired',
  shared_many: 'unverified_point',
  unverified: 'unverified_point',
};

export function evaluatePair(a: MergeSide, b: MergeSide, ctx: { division: string | null; now: Date }): MergeEvaluation {
  const signals = new Map<MergeSignalCode, MergeSignalView>();
  const blocks = new Set<MergeBlock>();
  const add = (code: MergeSignalCode, points: number, detail?: string) => {
    const cur = signals.get(code);
    if (!cur || Math.abs(points) > Math.abs(cur.points)) signals.set(code, { code, points, ...(detail ? { detail } : {}) });
  };

  // Person-level matches on phone / email (T1–T5, T7) and dormant numbers (A6).
  for (const pa of a.points) {
    for (const pb of b.points) {
      if (pa.kind !== pb.kind || pa.value !== pb.value) continue;
      const block = BLOCKING_STATES[pa.state] ?? BLOCKING_STATES[pb.state];
      if (pa.state === 'retired' || pb.state === 'retired') {
        add('T7', 50, pa.kind);
        blocks.add('shared_or_retired');
        continue;
      }
      if (block) {
        // Shared numbers create no person signal (DK-57); they only block.
        blocks.add(block);
        continue;
      }
      const ra = verifyRank(pa.level);
      const rb = verifyRank(pb.level);
      if (Math.min(ra, rb) < 1) continue; // V0: guesses never match
      const hi = Math.max(ra, rb);
      const lo = Math.min(ra, rb);
      if (pa.kind === 'phone') {
        if (lo >= 2) add('T1', 100, 'phone');
        else if (hi >= 2) add('T2', 70, 'phone');
        else add('T3', 50, 'phone');
      } else if (lo >= 2) add('T4', 100, 'email');
      else add('T5', 60, 'email');
      const last = [pa.lastActivityAt, pb.lastActivityAt].filter((d): d is Date => !!d).sort((x, y) => y.getTime() - x.getTime())[0];
      if (last && ctx.now.getTime() - last.getTime() > DORMANT_MS) {
        add('A6', -30, pa.kind);
        blocks.add('dormant');
      }
    }
  }
  // Same ERP code on both sides (T6) / two different codes in one ERP (DK-08 #2).
  for (const ea of a.erpCodes) {
    for (const eb of b.erpCodes) {
      if (ea.erp !== eb.erp) continue;
      if (ea.customerId === eb.customerId) add('T6', 100, ea.erp);
      else blocks.add('two_erp_codes');
    }
  }

  const strong = (['T1', 'T2', 'T3', 'T4', 'T5'] as const).some((c) => signals.has(c));
  const shared = a.responsibleIds.some((id) => b.responsibleIds.includes(id));
  if (strong && shared) add('T12', 20);
  const sim = nameSimilarity(a.name, b.name);
  if (strong && sim >= 0.5) add('T14', 10);
  // A1: names share no meaningful word at all (similarity 0 < 0.3).
  if (strong && nameTokens(a.name).size && nameTokens(b.name).size && sim === 0) add('A1', -20);
  // A2: both have verified phones, none in common, and different names.
  const verifiedPhones = (s: MergeSide) => new Set(s.points.filter((p) => p.kind === 'phone' && verifyRank(p.level) >= 2).map((p) => p.value));
  const va = verifiedPhones(a);
  const vb = verifiedPhones(b);
  if (va.size && vb.size && ![...va].some((v) => vb.has(v)) && sim < 0.3) add('A2', -30);
  if (a.gender && b.gender && a.gender !== b.gender) {
    add('A4', -20);
    blocks.add('gender');
  }

  // DK-08 blocks on the people themselves.
  const ownersIn = (s: MergeSide) => new Set(s.owners.filter((o) => !ctx.division || o.division === ctx.division).map((o) => o.userId));
  const oa = ownersIn(a);
  const ob = ownersIn(b);
  if (oa.size && ob.size && ![...oa].some((x) => ob.has(x))) blocks.add('two_owners');
  if (a.mergeLocks?.includes(b.contactId) || b.mergeLocks?.includes(a.contactId)) blocks.add('split_before');
  if (a.isInternal || b.isInternal) blocks.add('internal_staff');
  if (a.webChat || b.webChat) blocks.add('web_chat');
  if (a.erased || b.erased) blocks.add('erased');

  const list = [...signals.values()];
  const score = Math.max(0, Math.min(100, list.reduce((s, x) => s + x.points, 0)));
  const newA = isNewSide(a, b, ctx.division, ctx.now);
  const newB = !newA && isNewSide(b, a, ctx.division, ctx.now);
  const newSide = newA ? 'a' : newB ? 'b' : null;
  // D8-05 condition 1: a verified match. T2 (V2 ↔ V1) counts only with the same person in charge (QĐ-57 A).
  const verified = signals.has('T1') || signals.has('T4') || signals.has('T6') || (signals.has('T2') && shared);
  // D8-05 condition 3: same person in charge on both sides, or nobody in charge of the new side yet.
  const fresh = newSide === 'a' ? a : b;
  const samePerson = shared || !fresh.responsibleIds.length;
  let outcome: MergeOutcome;
  if (blocks.has('erased')) outcome = 'none';
  else if (score >= 90 && verified && newSide && samePerson && !blocks.size) outcome = 'auto_merge';
  else if (score >= 90) outcome = 'suggest_high';
  else if (score >= 50) outcome = 'suggest';
  else outcome = 'none';
  return { score, signals: list, blocks: [...blocks], outcome, newSide };
}
