import { channelOfUid, normalizeEmail, normalizePhone, type VerifyLevel } from '@vclinks/shared';
import type { VcsaleCustomer } from '@vclinks/vcsale-client';
import { stableHash, type ContactPointDoc, type CustomerAccountDoc, type CustomerContactDoc, type IdentityLinkDoc } from './customers.types';

/*
 * Pure builders of customer records, shared by CustomersService (sweep, import) and the
 * migrate-customers script. Ids are derived from the source key, so building twice gives the same
 * documents (idempotent upserts: re-running never creates duplicates).
 */

/** Ids of the fresh profile of one identity (F5.1: a new identity gets its own contact and account). */
export const profileIdsOf = (identityId: string) => {
  const h = stableHash(`identity:${identityId}`);
  return { accountId: `ca_${h}`, contactId: `cc_${h}` };
};

/** Ids of the profile created for one ERP customer. */
export const erpProfileIdsOf = (erp: string, code: string) => {
  const h = stableHash(`erp:${erp}:${code}`);
  return { accountId: `ca_${h}`, contactId: `cc_${h}` };
};

export const pointIdOf = (owner: string, kind: string, value: string) => `cp_${stableHash(`${owner}|${kind}|${value}`)}`;

/** Fields of a `contacts` (channel identity) record used to build its profile. */
export interface IdentitySource {
  _id: string;
  uid: string;
  userId: string;
  domName?: unknown;
  displayName?: unknown;
  zaloName?: unknown;
  phone?: unknown;
  encrypted?: unknown;
  gender?: unknown;
  role?: unknown;
  orgEmail?: unknown;
  ingestedAt?: unknown;
  lastActionTime?: unknown;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Level of a phone read from a platform profile (DK-04): OA "chia sẻ thông tin" is V3; a phone shown on
 * a Zalo / Facebook profile is V2; anything typed by the customer (Fanpage text, web form) is V1.
 */
export function profilePhoneLevel(uid: string): VerifyLevel {
  const ch = channelOfUid(uid);
  if (ch === 'zalo_oa') return 'V3';
  if (ch === 'zalo' || ch === 'fb_personal') return 'V2';
  return 'V1';
}

export const identityName = (c: IdentitySource) =>
  str(c.domName) ?? (c.encrypted ? null : (str(c.displayName) ?? str(c.zaloName)));

export interface BuiltProfile {
  account: CustomerAccountDoc;
  contact: CustomerContactDoc;
  link: IdentityLinkDoc;
  points: ContactPointDoc[];
}

/** Profile of one identity that has no link yet. `firstSeenAt` defaults to its ingest time. */
export function buildIdentityProfile(c: IdentitySource, now: Date, opts: { migrationRunId?: string } = {}): BuiltProfile {
  const { accountId, contactId } = profileIdsOf(c._id);
  const name = identityName(c) ?? 'Khách chưa có tên';
  const run = opts.migrationRunId ? { migrationRunId: opts.migrationRunId } : {};
  const firstSeenAt = c.ingestedAt instanceof Date ? c.ingestedAt : now;
  const role = str(c.role);
  const points: ContactPointDoc[] = [];
  const phone = c.encrypted ? null : normalizePhone(str(c.phone));
  if (phone) {
    points.push({
      _id: pointIdOf(c._id, 'phone', phone),
      contactId,
      accountId,
      kind: 'phone',
      value: phone,
      level: profilePhoneLevel(c.uid),
      state: 'active',
      source: { channel: channelOfUid(c.uid), identityId: c._id },
      lastActivityAt: c.lastActionTime instanceof Date ? c.lastActionTime : null,
      createdAt: now,
      ...run,
    });
  }
  return {
    account: {
      _id: accountId,
      name,
      type: null,
      region: null,
      status: 'active',
      mergedInto: null,
      owners: [],
      erpLinks: [],
      tags: [],
      createdFrom: 'identity',
      createdAt: now,
      updatedAt: now,
      ...run,
    },
    contact: {
      _id: contactId,
      accountId,
      name,
      orgRole: null,
      status: 'active',
      mergedInto: null,
      mergeLocks: [],
      gender: c.gender === 'male' || c.gender === 'female' ? c.gender : null,
      isInternal: role === 'nhan_vien' || role === 'quan_ly' || !!str(c.orgEmail),
      createdAt: now,
      updatedAt: now,
      ...run,
    },
    link: {
      _id: c._id,
      identityId: c._id,
      uid: c.uid,
      userId: c.userId,
      channel: channelOfUid(c.uid),
      contactId,
      accountId,
      state: 'new',
      linkedBy: 'system',
      linkedAt: now,
      firstSeenAt,
      mergeOpId: null,
      ...run,
    },
    points,
  };
}

/** Normalised phones / emails of an ERP customer. */
export function erpPoints(x: VcsaleCustomer) {
  const phones = [...new Set(x.phones.map((p) => normalizePhone(p)).filter((p): p is string => !!p))];
  const emails = [...new Set(x.emails.map((e) => normalizeEmail(e)).filter((e): e is string => !!e))];
  return { phones, emails };
}
