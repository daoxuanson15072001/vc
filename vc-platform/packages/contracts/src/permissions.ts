/**
 * Permissions of VC Home (02 mục 3; kế hoạch GĐ B mục 5.4). Shared by the API (`@Can`) and the SPA (menus), so both
 * decide the same way. Scope checks ((p): legal entity, division, subtree) are done by the API services.
 */

/** Roles a viewer can hold. `hcns`, `qtht`, `kiem_soat`, `bgd` are assigned (VC ID client roles of `vchome` in GĐ B);
 * `nhan_vien`, `quan_ly`, `truong_dv` are derived from the profile; `chu_app` comes in GĐ C. */
export const ROLES = ['nhan_vien', 'quan_ly', 'truong_dv', 'hcns', 'qtht', 'chu_app', 'kiem_soat', 'bgd'] as const;
export type Role = (typeof ROLES)[number];

/** ✓ all · p: within the role's scope · d: read only · m: own data only (02 mục 3). */
export type Access = 'all' | 'p' | 'd' | 'm';

export const PERMISSIONS = {
  'ho_so.xem_cua_minh': { nhan_vien: 'm' },
  'ho_so.de_nghi_sua': { nhan_vien: 'm' },
  'ho_so.tu_sua': { nhan_vien: 'm' },
  'danh_ba.xem': { nhan_vien: 'all' },
  'danh_ba.xuat': { hcns: 'p' },
  'ho_so.xem_c1': { quan_ly: 'p', truong_dv: 'p', hcns: 'p', qtht: 'd', kiem_soat: 'd' },
  'nhan_su.xem': { hcns: 'p', qtht: 'd' },
  'nhan_su.sua': { hcns: 'p' },
  'de_nghi.xu_ly': { hcns: 'p' },
  'co_cau.sua': { hcns: 'p' },
  'nhap.excel': { hcns: 'p' },
  'nhap.xac_nhan': { qtht: 'all' },
  'doi_chieu.chay': { hcns: 'p', qtht: 'all' },
  'loai_tru.sua': { qtht: 'all' },
  'khoi_tao.tai_tep': { qtht: 'all' },
  'tai_khoan.xem': { qtht: 'all', kiem_soat: 'd' },
  'tai_khoan.khoa': { qtht: 'all' },
  'tai_khoan.gan_lai': { qtht: 'all' },
  'app.xem': { qtht: 'all', kiem_soat: 'd' },
  'app.sua': { qtht: 'all' },
  'nhat_ky.xem': { nhan_vien: 'm', hcns: 'p', qtht: 'all', kiem_soat: 'd' },
  'nhat_ky.xuat': { hcns: 'p', qtht: 'all', kiem_soat: 'all' },
  'he_thong.dong_ho_thu': { qtht: 'all' },
} as const satisfies Record<string, Partial<Record<Role, Access>>>;

export type Permission = keyof typeof PERMISSIONS;

export function isPermission(p: string): p is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, p);
}

/** Which access the roles give for a permission (the widest), or undefined when none. */
export function accessFor(permission: Permission, roles: Iterable<Role>): Access | undefined {
  const table = PERMISSIONS[permission] as Partial<Record<Role, Access>>;
  const order: Access[] = ['all', 'p', 'd', 'm'];
  let best: Access | undefined;
  for (const r of roles) {
    const a = table[r];
    if (a && (!best || order.indexOf(a) < order.indexOf(best))) best = a;
  }
  return best;
}

export function permissionsOf(roles: Iterable<Role>): Permission[] {
  const set = [...roles];
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => accessFor(p, set) !== undefined);
}

/** Assigned VC Home roles (client roles of `vchome`): `hcns` (whole group) or `hcns@<legal entity or division code>`. */
export const HOME_ROLE = /^(hcns(@[A-Z0-9][A-Z0-9_-]{0,29})?|qtht|kiem_soat|bgd)$/;

/** Pairs nobody may hold together (02 mục 6, VH-BR-17). */
export const FORBIDDEN_PAIRS: [string, string][] = [
  ['hcns', 'qtht'],
  ['kiem_soat', 'qtht'],
];

/** Separation-of-duty conflicts among assigned roles (`hcns@X` counts as `hcns`). */
export function roleConflicts(assigned: string[]): [string, string][] {
  const base = new Set(assigned.map((r) => r.split('@')[0]));
  return FORBIDDEN_PAIRS.filter(([a, b]) => base.has(a) && base.has(b));
}
