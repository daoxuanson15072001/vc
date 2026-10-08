import { z } from 'zod';
import { ROLE_KEYS, ROLE_LABELS, SENSITIVE_ROLES, type RoleKey } from './org';
import { PERMISSION_INFO, PERMISSION_KEYS, ROLE_MATRIX, SCOPE_CODES, SCOPE_LABELS, type PermCell, type PermissionKey, type ScopeCode } from './permissions';

/**
 * Custom roles (docs 01 PQ-06, MH-PQ-05): a copy of one system role whose cells may only lose scopes.
 * Stored as the picks that differ from the base role; the row the engine uses is rebuilt from the
 * current system matrix every time, so a custom role can never be wider than its base (NT6).
 */

/** Scopes a cell may be narrowed to, widest first (MH-PQ-05 #7: TĐ ⊃ DV ⊃ TỔ ⊃ CT; NH ⊃ CT). Others only themselves. */
const NARROWER: Partial<Record<ScopeCode, readonly ScopeCode[]>> = {
  TD: ['TD', 'DV', 'TO', 'CT'],
  DV: ['DV', 'TO', 'CT'],
  TO: ['TO', 'CT'],
  NH: ['NH', 'CT'],
};

export const narrowerScopes = (s: ScopeCode): readonly ScopeCode[] => NARROWER[s] ?? [s];

/**
 * Part of a cell a custom role edits: for `cust.phone_full` only the "Hiện +NK" scopes, because the
 * always-shown number follows the relation with the customer whatever the role (PQ-45).
 */
export const customField = (key: PermissionKey): 's' | 'reveal' => (key === 'cust.phone_full' ? 'reveal' : 's');

/** Scopes of the base cell a custom role may keep, in SCOPE_CODES order (empty: only ✖). */
export function allowedScopes(base: PermCell | undefined, key: PermissionKey): ScopeCode[] {
  const own = base?.[customField(key)] ?? [];
  return SCOPE_CODES.filter((c) => own.some((s) => narrowerScopes(s).includes(c)));
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Picks of a custom role: key → scopes kept ([] = ✖). Keys left out keep the base cell. */
export type CustomRolePicks = Partial<Record<PermissionKey, ScopeCode[]>>;

/** "Vượt quyền của vai trò gốc NVKD." (MH-PQ-05 #7). */
export const ceilingMessage = (base: RoleKey) => `Vượt quyền của vai trò gốc ${roleShortName(base)}.`;

/** Short role name of the messages (NVKD instead of "Nhân viên kinh doanh", as the spec writes it). */
export const roleShortName = (r: RoleKey) => (r === 'nvkd' ? 'NVKD' : ROLE_LABELS[r]);

/**
 * Checks and normalises the picks against the base role: every kept scope must be the base scope or a
 * narrower one; picks equal to the base cell are dropped. Returns the first error in spec order.
 */
export function normalisePicks(base: RoleKey, picks: CustomRolePicks): { picks: CustomRolePicks; error?: string } {
  const row = ROLE_MATRIX[base] ?? {};
  const out: CustomRolePicks = {};
  for (const key of PERMISSION_KEYS) {
    const want = picks[key];
    if (!want) continue;
    const cell = row[key];
    const allowed = allowedScopes(cell, key);
    const bad = want.find((s) => !allowed.includes(s));
    if (bad) return { picks: out, error: `${ceilingMessage(base)} (${PERMISSION_INFO[key].label}: ${SCOPE_LABELS[bad]})` };
    const kept = SCOPE_CODES.filter((c) => want.includes(c));
    if (!sameSet(kept, cell?.[customField(key)] ?? [])) out[key] = kept;
  }
  return { picks: out };
}

/**
 * The matrix row of a custom role: the base row with the picks applied. Picks are clamped again here,
 * so a later narrowing of the system matrix also narrows every custom role built on it.
 */
export function customRoleRow(base: RoleKey, picks: CustomRolePicks): Partial<Record<PermissionKey, PermCell>> {
  const row = ROLE_MATRIX[base] ?? {};
  const out: Partial<Record<PermissionKey, PermCell>> = {};
  for (const [key, cell] of Object.entries(row) as [PermissionKey, PermCell][]) {
    const want = picks[key];
    if (!want) {
      out[key] = cell;
      continue;
    }
    const field = customField(key);
    const allowed = allowedScopes(cell, key);
    const kept = want.filter((s) => allowed.includes(s));
    const next: PermCell = { ...cell, [field]: kept };
    if (field === 'reveal' && !kept.length) delete next.reveal;
    if (!next.s.length && !next.reveal?.length) continue;
    out[key] = next;
  }
  return out;
}

/** A custom role based on one of these needs a second person to approve each assignment (PQ-42). */
export const isSensitiveBase = (base: RoleKey) => SENSITIVE_ROLES.includes(base);

/** Id (also the code of the `vai_tro` import column, MH-PQ-15): `tc_` + the folded name. */
export const CUSTOM_ROLE_PREFIX = 'tc_';
export const isCustomRoleId = (v: string) => v.startsWith(CUSTOM_ROLE_PREFIX);

export const customRoleInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Tên vai trò 2–60 ký tự.').max(60, 'Tên vai trò 2–60 ký tự.'),
    baseRole: z.enum(ROLE_KEYS),
    description: z.string().trim().max(300, 'Mô tả tối đa 300 ký tự.').default(''),
    picks: z.record(z.enum(PERMISSION_KEYS), z.array(z.enum(SCOPE_CODES)).max(SCOPE_CODES.length)).default({}),
  })
  .strict();
export type CustomRoleInput = z.infer<typeof customRoleInputSchema>;

/** One column of the roles screen (`GET /api/admin/roles`). */
export interface RoleColumn {
  /** System role key, or custom role id (`tc_…`). */
  roleKey: string;
  label: string;
  system: boolean;
  permissions: Partial<Record<PermissionKey, PermCell>>;
  /** Custom roles only. */
  baseRole?: RoleKey;
  description?: string;
  picks?: CustomRolePicks;
  /** People holding it (assignments and requests waiting for approval). */
  assignedCount?: number;
  updatedAt?: string;
}

/** Custom role as offered by the role pickers (`GET /api/admin/meta`). */
export interface CustomRoleOption {
  id: string;
  name: string;
  baseRole: RoleKey;
}
