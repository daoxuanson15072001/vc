/**
 * People holding VC Home admin roles in GĐ B (VH-ADM-03 bước 2): `keycloak/vchome-roles.yaml`, changed by merge request
 * with a second reviewer, applied to the client roles of `vchome` on VC ID.
 */
import { HOME_ROLE, roleConflicts } from '@vc/contracts';
import { parse } from 'yaml';

export interface RoleHolder {
  email: string;
  roles: string[];
}

export interface RolesCheck {
  holders: RoleHolder[];
  errors: string[];
  warnings: string[];
}

export function checkRolesFile(text: string): RolesCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const doc = (parse(text) ?? {}) as { nguoi?: { email?: unknown; vai_tro?: unknown }[] };
  const holders: RoleHolder[] = [];
  const seen = new Set<string>();
  for (const [i, n] of (doc.nguoi ?? []).entries()) {
    const email = typeof n?.email === 'string' ? n.email.trim().toLowerCase() : '';
    const roles = Array.isArray(n?.vai_tro) ? n.vai_tro.map(String) : [];
    if (!/^[^@\s]+@(vcprosperous\.com|vcpart\.vn)$/.test(email)) errors.push(`Dòng ${i + 1}: email không phải tài khoản công ty: ${String(n?.email)}`);
    if (seen.has(email)) errors.push(`Dòng ${i + 1}: ${email} khai hai lần`);
    seen.add(email);
    for (const r of roles) if (!HOME_ROLE.test(r)) errors.push(`Dòng ${i + 1}: vai trò không hợp lệ: ${r}`);
    for (const [a, b] of roleConflicts(roles)) {
      errors.push(`Không cấp được ${b} cho ${email}: đang giữ ${a}. Hai vai trò này không được giữ cùng lúc (VH-BR-17).`);
    }
    holders.push({ email, roles: [...new Set(roles)] });
  }
  const qtht = holders.filter((h) => h.roles.includes('qtht')).length;
  if (qtht < 2) warnings.push(`Chỉ có ${qtht} người giữ qtht; cần ít nhất 2 (Q-07)`);
  return { holders, errors, warnings };
}
