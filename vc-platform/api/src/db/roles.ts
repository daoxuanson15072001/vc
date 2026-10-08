/**
 * MongoDB role of the API login (`vchome_api`, kế hoạch GĐ B mục 3.3 điểm 15): read and write on every collection
 * except `audit_log`, where it may only `find` and `insert`. Privileges are listed per collection (MongoDB has no
 * "deny"), so the role is brought up to date at every start by the migration login.
 */
import type { Db } from 'mongodb';
import { C } from './collections';

export const API_ROLE = 'vchome_api_rw';

interface Privilege {
  resource: { db: string; collection: string };
  actions: string[];
}

export function desiredPrivileges(dbName: string): Privilege[] {
  return [
    ...Object.values(C)
      .filter((c) => c !== C.auditLog)
      .map((collection) => ({ resource: { db: dbName, collection }, actions: ['find', 'insert', 'update', 'remove'] })),
    { resource: { db: dbName, collection: C.auditLog }, actions: ['find', 'insert'] },
    { resource: { db: dbName, collection: '' }, actions: ['listCollections', 'listIndexes'] },
  ];
}

/** Creates the role, or grants what is missing and revokes what is extra (a login with userAdmin cannot updateRole). */
export async function ensureAccessRoles(db: Db): Promise<void> {
  const want = desiredPrivileges(db.databaseName);
  const info = await db.command({ rolesInfo: API_ROLE, showPrivileges: true });
  const role = (info.roles as { privileges: Privilege[] }[])[0];
  if (!role) {
    await db.command({ createRole: API_ROLE, privileges: want, roles: [] });
    return;
  }
  const key = (p: Privilege) => `${p.resource.db}\u0000${p.resource.collection}`;
  const cur = new Map(role.privileges.map((p) => [key(p), p]));
  const wanted = new Map(want.map((p) => [key(p), p]));
  const grant: Privilege[] = [];
  const revoke: Privilege[] = [];
  for (const [k, p] of wanted) {
    const has = new Set(cur.get(k)?.actions ?? []);
    const missing = p.actions.filter((a) => !has.has(a));
    if (missing.length) grant.push({ resource: p.resource, actions: missing });
  }
  for (const [k, p] of cur) {
    const ok = new Set(wanted.get(k)?.actions ?? []);
    const extra = p.actions.filter((a) => !ok.has(a));
    if (extra.length) revoke.push({ resource: p.resource, actions: extra });
  }
  if (revoke.length) await db.command({ revokePrivilegesFromRole: API_ROLE, privileges: revoke });
  if (grant.length) await db.command({ grantPrivilegesToRole: API_ROLE, privileges: grant });
}
