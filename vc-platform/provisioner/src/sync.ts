/**
 * Rules of vc-provisioner (thiết kế SSO mục 5.6, VH-BR-26, D-BA-37…40). `plan()` is pure so every rule is unit-tested;
 * `execute()` turns the plan into Keycloak Admin API calls.
 */
import type { KcAdmin } from '@vc/realm-apply/kc';
import type { GoogleUser } from './google.js';

export type Status = 'du_dieu_kien' | 'chua_bat_2_buoc' | 'loai_tru';

export interface KcUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  attributes: Record<string, string[]>;
  groups: string[];
}

export interface Exclusion {
  email: string;
  loai: 'hop_thu_chung' | 'dich_vu' | 'thu' | 'chua_ro_chu';
  ly_do?: string;
  nguoi_them?: string;
}

export type Action =
  | { kind: 'tao_user'; email: string; google: GoogleUser; groups: string[] }
  | { kind: 'them_nhom'; userId: string; email: string; groups: string[] }
  | { kind: 'go_nhom'; userId: string; email: string; groups: string[]; reason: Status }
  | { kind: 'dat_trang_thai'; userId: string; email: string; value: Status }
  | { kind: 'khoa_google'; userId: string; email: string; reason: 'suspended' | 'archived' | 'deleted' }
  | { kind: 'bao_mo_lai'; userId: string; email: string };

export interface PlanOptions {
  defaultGroups: string[];
  companyDomains: string[];
  /** Google user count of the previous successful run (safety stop below 50 %). */
  previousGoogleCount?: number;
  /** More than this many people losing app groups in one run waits for an admin (khớp VH-BR-25). */
  bulkRemoveLimit?: number;
  confirmBulk?: boolean;
}

export interface Plan {
  actions: Action[];
  /** Set when the run must not change anything (abnormal Google list). */
  stop?: string;
  /** Set when group removals were held back for confirmation; other actions still run. */
  held?: string;
  statuses: Record<string, Status | 'bi_khoa'>;
}

export const LOCK_ATTR = 'vc_khoa';
export const STATUS_ATTR = 'vc_trang_thai';

const isServiceAccount = (u: KcUser) => u.username.startsWith('service-account-');
const domainOf = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';

export function statusOf(g: GoogleUser, excluded: Set<string>): Status {
  if (excluded.has(g.email)) return 'loai_tru';
  if (!g.isEnrolledIn2Sv) return 'chua_bat_2_buoc';
  return 'du_dieu_kien';
}

export function plan(google: GoogleUser[], kc: KcUser[], exclusions: Exclusion[], o: PlanOptions): Plan {
  const statuses: Plan['statuses'] = {};
  if (google.length === 0) return { actions: [], stop: 'Google trả danh sách rỗng', statuses };
  if (o.previousGoogleCount && google.length < o.previousGoogleCount * 0.5) {
    return { actions: [], stop: `Google trả ${google.length} tài khoản, ít hơn 50% lần trước (${o.previousGoogleCount})`, statuses };
  }
  const excluded = new Set(exclusions.map((e) => e.email.toLowerCase()));
  const kcByEmail = new Map(kc.filter((u) => u.email && !isServiceAccount(u)).map((u) => [u.email!.toLowerCase(), u]));
  const actions: Action[] = [];

  for (const g of google) {
    if (!o.companyDomains.includes(g.domain)) continue;
    const u = kcByEmail.get(g.email);
    if (g.suspended || g.archived) {
      statuses[g.email] = 'bi_khoa';
      if (u?.enabled) actions.push({ kind: 'khoa_google', userId: u.id, email: g.email, reason: g.suspended ? 'suspended' : 'archived' });
      continue;
    }
    const st = statusOf(g, excluded);
    statuses[g.email] = st;
    if (!u) {
      // Only eligible people are created ahead (D-BA-37); others get a user at their first login, without app groups.
      if (st === 'du_dieu_kien') actions.push({ kind: 'tao_user', email: g.email, google: g, groups: o.defaultGroups });
      continue;
    }
    if (u.attributes[STATUS_ATTR]?.[0] !== st) actions.push({ kind: 'dat_trang_thai', userId: u.id, email: g.email, value: st });
    if (!u.enabled) {
      // Never re-enable on our own: unlocking is a person's decision (thiết kế SSO 5.6).
      if ((u.attributes[LOCK_ATTR] ?? []).includes('google')) actions.push({ kind: 'bao_mo_lai', userId: u.id, email: g.email });
      continue;
    }
    if (st === 'du_dieu_kien') {
      const missing = o.defaultGroups.filter((x) => !u.groups.includes(x));
      if (missing.length) actions.push({ kind: 'them_nhom', userId: u.id, email: g.email, groups: missing });
    } else {
      const present = o.defaultGroups.filter((x) => u.groups.includes(x));
      if (present.length) actions.push({ kind: 'go_nhom', userId: u.id, email: g.email, groups: present, reason: st });
    }
  }

  // Users of the company domains that Google no longer lists were deleted on Google.
  const onGoogle = new Set(google.map((g) => g.email));
  for (const u of kcByEmail.values()) {
    const email = u.email!.toLowerCase();
    if (u.enabled && o.companyDomains.includes(domainOf(email)) && !onGoogle.has(email)) {
      statuses[email] = 'bi_khoa';
      actions.push({ kind: 'khoa_google', userId: u.id, email, reason: 'deleted' });
    }
  }

  const limit = o.bulkRemoveLimit ?? 20;
  const removals = actions.filter((a) => a.kind === 'go_nhom');
  if (removals.length > limit && !o.confirmBulk) {
    return {
      actions: actions.filter((a) => a.kind !== 'go_nhom'),
      held: `${removals.length} người sẽ mất nhóm app (quá ${limit}); chạy lại với --confirm-bulk sau khi quản trị xem danh sách`,
      statuses,
    };
  }
  return { actions, statuses };
}

/** Executes a plan against realm `realm`. Returns notable events for the admin notifier. */
export async function execute(kc: KcAdmin, realm: string, p: Plan, groupIds: Map<string, string>): Promise<string[]> {
  const r = `/${realm}`;
  const notes: string[] = [];
  const gid = (name: string) => {
    const id = groupIds.get(name);
    if (!id) throw new Error(`Realm ${realm} không có nhóm ${name}`);
    return id;
  };
  const putAttrs = async (userId: string, change: (u: any) => void) => {
    const u = await kc.get<any>(`${r}/users/${userId}`);
    u.attributes = u.attributes ?? {};
    change(u);
    await kc.put(`${r}/users/${userId}`, u);
  };

  for (const a of p.actions) {
    switch (a.kind) {
      case 'tao_user':
        await kc.post(`${r}/users`, {
          username: a.email,
          email: a.email,
          emailVerified: true,
          enabled: true,
          firstName: a.google.givenName,
          lastName: a.google.familyName,
          attributes: { hd: [a.google.domain], [STATUS_ATTR]: ['du_dieu_kien'] },
          federatedIdentities: [{ identityProvider: 'google', userId: a.google.id, userName: a.email }],
          groups: a.groups,
        });
        break;
      case 'them_nhom':
        for (const g of a.groups) await kc.put(`${r}/users/${a.userId}/groups/${gid(g)}`);
        break;
      case 'go_nhom':
        for (const g of a.groups) await kc.del(`${r}/users/${a.userId}/groups/${gid(g)}`);
        // Sessions end now so apps lose access at once; the next login gets a token without the group.
        await kc.post(`${r}/users/${a.userId}/logout`);
        break;
      case 'dat_trang_thai':
        await putAttrs(a.userId, (u) => (u.attributes[STATUS_ATTR] = [a.value]));
        break;
      case 'khoa_google':
        await putAttrs(a.userId, (u) => {
          u.enabled = false;
          u.attributes[LOCK_ATTR] = [...new Set([...(u.attributes[LOCK_ATTR] ?? []), 'google'])];
        });
        await kc.post(`${r}/users/${a.userId}/logout`);
        notes.push(`Đã khoá ${a.email} trên VC ID vì tài khoản Google ${a.reason === 'deleted' ? 'đã bị xoá' : a.reason === 'archived' ? 'đã lưu trữ' : 'bị khoá'}.`);
        break;
      case 'bao_mo_lai':
        notes.push(`${a.email}: Google hoạt động lại nhưng VC ID vẫn khoá. Mở khoá là quyết định của quản trị (vc-provisioner enable).`);
        break;
    }
  }
  return notes;
}

/** Emergency lock (VH-AUT-06): disable + log out everywhere in ≤ 1 minute. */
export async function disableUser(kc: KcAdmin, realm: string, userId: string, reason: string): Promise<void> {
  const u = await kc.get<any>(`/${realm}/users/${userId}`);
  u.attributes = u.attributes ?? {};
  u.enabled = false;
  u.attributes[LOCK_ATTR] = [...new Set([...(u.attributes[LOCK_ATTR] ?? []), 'khan_cap'])];
  u.attributes.vc_khoa_ly_do = [reason];
  await kc.put(`/${realm}/users/${userId}`, u);
  await kc.post(`/${realm}/users/${userId}/logout`);
}

/** Removes the emergency lock; the user stays disabled while Google still has it locked. */
export async function enableUser(kc: KcAdmin, realm: string, userId: string, alsoGoogle = false): Promise<{ enabled: boolean; remaining: string[] }> {
  const u = await kc.get<any>(`/${realm}/users/${userId}`);
  u.attributes = u.attributes ?? {};
  // `alsoGoogle`: the admin checked that Google is active again and decides to reopen (thiết kế SSO 5.6).
  const remaining = (u.attributes[LOCK_ATTR] ?? []).filter((x: string) => x !== 'khan_cap' && !(alsoGoogle && x === 'google'));
  u.attributes[LOCK_ATTR] = remaining;
  delete u.attributes.vc_khoa_ly_do;
  u.enabled = remaining.length === 0;
  await kc.put(`/${realm}/users/${userId}`, u);
  return { enabled: u.enabled, remaining };
}
