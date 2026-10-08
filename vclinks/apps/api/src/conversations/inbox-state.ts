import { DEFAULT_SLA_CONFIG, addWorkingMinutes, type SlaConfig } from '@vclinks/shared';
import type { Document } from 'mongodb';
import { C, type DbService } from '../db/db.service';
import { currentTenant } from '../db/tenant-context';

/*
 * Stored inbox state of a conversation (M1b-09, SZ-21): `unansweredSince`, `slaDueAt`, `slaMinutes`.
 * Recomputed whenever messages of the thread are ingested (IngestService.refreshConversations), so a reply
 * typed on the phone app ends the wait as soon as it syncs.
 */

/** Collection of per-division SLA settings: `_id` = division org-unit id, or `default`. */
export const SLA_SETTINGS = 'sla_settings';

interface SlaSettingsDoc extends Partial<Omit<SlaConfig, 'calendar'>> {
  _id: string;
  calendar?: SlaConfig['calendar'];
}

/** Uids Zalo / the channels write in `fromUid` for the nick's own messages (docs 03 SZ-21 a). */
export const ownSenders = (uid: string): string[] => ['0', '-1', uid];

const CACHE_MS = () => Number(process.env.SLA_CACHE_MS ?? 30_000);
const cache = new Map<string, { at: number; cfg: SlaConfig }>();

/** SLA settings of a division: its own doc, else `default`, else the built-in calendar (Mon-Fri, Sat morning, 15 min). */
export async function slaConfigFor(db: DbService, divisionId: string | null): Promise<SlaConfig> {
  const key = `${currentTenant()}:${divisionId ?? ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS()) return hit.cfg;
  const docs = await db.col<SlaSettingsDoc>(SLA_SETTINGS).find({ _id: { $in: [divisionId ?? '', 'default'] } }).toArray();
  const doc = docs.find((d) => d._id === divisionId) ?? docs.find((d) => d._id === 'default');
  let divisionName: string | undefined;
  if (divisionId) {
    const unit = await db.col<{ _id: string; name?: string }>('org_units').findOne({ _id: divisionId });
    divisionName = unit?.name;
  }
  const cfg: SlaConfig = {
    slaMinutes: doc?.slaMinutes ?? DEFAULT_SLA_CONFIG.slaMinutes,
    warnRatio: doc?.warnRatio ?? DEFAULT_SLA_CONFIG.warnRatio,
    calendar: doc?.calendar ?? DEFAULT_SLA_CONFIG.calendar,
    ...(divisionName ?? doc?.divisionName ? { divisionName: divisionName ?? doc?.divisionName } : {}),
  };
  cache.set(key, { at: Date.now(), cfg });
  return cfg;
}

/** Drops cached SLA settings (tests, after the division edits its calendar). */
export function clearSlaCache() {
  cache.clear();
}

/** Division of an account (accounts.divisionId, else AUTHZ_DEFAULT_DIVISION as the permission engine does). */
export async function divisionOfAccount(db: DbService, uid: string): Promise<string | null> {
  const a = await db.col<{ _id: string; divisionId?: string | null }>(C.accounts).findOne({ _id: uid }, { projection: { divisionId: 1 } });
  return a?.divisionId ?? process.env.AUTHZ_DEFAULT_DIVISION?.trim() ?? null;
}

/**
 * Recomputes the inbox state of the given threads of one account from `messages`. 1-1 conversations only
 * (groups wait for QĐ-50, SZ-21 j). System events are ignored; time is the real send time (`sentAt`).
 */
export async function refreshInboxState(db: DbService, uid: string, threadIds: string[]): Promise<void> {
  if (!threadIds.length) return;
  const own = ownSenders(uid);
  const stats = await db
    .col(C.messages)
    .aggregate<{ _id: string; lastOwn: Date | null; lastCustomer: Date | null; first: { sentAt: Date }[] }>([
      { $match: { uid, threadId: { $in: threadIds }, 'systemEvent.act': { $exists: false } } },
      {
        $group: {
          _id: '$threadId',
          lastOwn: { $max: { $cond: [{ $in: ['$fromUid', own] }, '$sentAt', null] } },
          lastCustomer: { $max: { $cond: [{ $in: ['$fromUid', own] }, null, '$sentAt'] } },
        },
      },
      {
        // The first customer message after the nick's last one (uses the (uid, threadId, sentAt) index).
        $lookup: {
          from: C.messages,
          let: { t: '$_id', lo: '$lastOwn' },
          as: 'first',
          pipeline: [
            {
              $match: {
                $expr: { $and: [{ $eq: ['$uid', uid] }, { $eq: ['$threadId', '$$t'] }, { $gt: ['$sentAt', { $ifNull: ['$$lo', new Date(0)] }] }] },
                fromUid: { $nin: own },
                'systemEvent.act': { $exists: false },
              },
            },
            { $sort: { sentAt: 1 } },
            { $limit: 1 },
            { $project: { sentAt: 1 } },
          ],
        },
      },
    ])
    .toArray();
  const types = new Map(
    (await db.col(C.conversations).find({ uid, threadId: { $in: threadIds } }, { projection: { threadId: 1, type: 1 } }).toArray()).map((c) => [c.threadId as string, c.type as string]),
  );
  const cfg = await slaConfigFor(db, await divisionOfAccount(db, uid));
  const ops = stats
    .filter((s) => types.has(s._id))
    .map((s) => {
      const since = types.get(s._id) === 'group' ? null : (s.first[0]?.sentAt ?? null);
      const set: Document = {
        unansweredSince: since,
        lastOwnMsgAt: s.lastOwn ?? null,
        lastCustomerMsgAt: s.lastCustomer ?? null,
        slaDueAt: since ? new Date(addWorkingMinutes(since.getTime(), cfg.slaMinutes, cfg.calendar)) : null,
        slaMinutes: cfg.slaMinutes,
      };
      // A customer message after "Xong" reopens the conversation (plan B2); pipeline update to compare with doneAt.
      const status = s.lastCustomer
        ? { $cond: [{ $and: [{ $eq: ['$status', 'done'] }, { $gt: [s.lastCustomer, { $ifNull: ['$doneAt', new Date(0)] }] }] }, 'open', '$status'] }
        : '$status';
      return { updateOne: { filter: { _id: `${uid}:${s._id}` as never }, update: [{ $set: { ...set, status } }] } };
    });
  if (ops.length) await db.col(C.conversations).bulkWrite(ops as never, { ordered: false });
}
