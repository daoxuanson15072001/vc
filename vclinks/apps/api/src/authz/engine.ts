import {
  GROUP_LEAD_ROLES,
  ROLE_MATRIX,
  type ChannelAccessLevel,
  type EffectivePermission,
  type GrantRight,
  type GrantType,
  type PermCell,
  type PermMode,
  type PermissionKey,
  type RoleKey,
  type ScopeCode,
} from '@vclinks/shared';

/*
 * Pure permission engine (docs 01 §2.9). No I/O: the AuthzService loads the subject and the target facts,
 * this file decides. One function for REST, MCP and list queries (list queries use the same scope rules
 * through AuthzService.channelScope, which mirrors `decide` on whole channels).
 */

/** One role assignment, with the org facts the engine needs. */
export interface SubjectRole {
  roleKey: RoleKey;
  unitId: string;
  /** Division of the unit (null for the root). */
  divisionId: string | null;
  /** The unit and every unit below it. */
  subtree: ReadonlySet<string>;
  /** The user is the manager of `unitId` ("Trưởng nhóm" flag for group roles: CT → NH). */
  isManager: boolean;
  /** Custom role of the assignment (MH-PQ-05): its row, never wider than the system row of `roleKey` (PQ-06). */
  custom?: { id: string; name: string; row: RoleRow };
}

export type RoleRow = Partial<Record<PermissionKey, PermCell>>;

/** Matrix row of one assignment: the custom role's own row, else the system role's. */
export const rowOf = (r: SubjectRole): RoleRow => r.custom?.row ?? ROLE_MATRIX[r.roleKey] ?? {};

export interface SubjectGrant {
  type: GrantType;
  /** `${targetType}:${targetId}` (account | conversation | org_unit | channel | user). */
  target: string;
  rights: GrantRight[];
}

export interface Subject {
  userId: string;
  active: boolean;
  roles: SubjectRole[];
  /** Personal channels the user holds (giu_nick) or covers with an active "Trực nick". */
  nicks: ReadonlySet<string>;
  /** Official-channel access of the user or of one of his units. */
  channelLevels: ReadonlyMap<string, ReadonlySet<ChannelAccessLevel>>;
  grants: SubjectGrant[];
  /**
   * Personal channels the user covers with an active "Trực nick" (PQ-32), with the absent holder and
   * the end of the cover. Also present in `nicks`; kept apart so the UI and the outbox can say
   * "trực thay {người vắng}". Optional: subjects built in unit tests may omit it.
   */
  covers?: ReadonlyMap<string, { absentUserId: string | null; until: Date | null }>;
}

/** What is known about the object of an action. Missing facts never widen access. */
export interface Target {
  divisionId?: string | null;
  channelId?: string;
  channelKind?: 'personal' | 'official';
  /** Units the object belongs to: owner's / assignee's / nick holder's units, or the unit itself. */
  unitIds?: string[];
  /** Owner (in the conversation's division) or assignee: CT. */
  responsibleIds?: string[];
  /** Author / subject person: SELF ("Của tôi", "Tin mình gửi"); for user targets the user himself. */
  selfIds?: string[];
  /** Target user of user.* keys (for notSelf). */
  userId?: string;
  ticketAssigneeIds?: string[];
  isLead?: boolean;
  routeOwnerIds?: string[];
  /** Grant targets covering the object, e.g. `conversation:<id>`, `account:<id>`, `channel:<uid>`. */
  grantTargets?: string[];
}

export interface Decision {
  allowed: boolean;
  /** Scope that allowed it (TĐ, NICK, YC…) or why it was refused. */
  via: string;
  log?: boolean;
}

export interface DecideOptions {
  /** Mode the action needs (default full). */
  need?: PermMode;
  /** Conditions the caller has checked (PermCell.cond). */
  conditions?: string[];
}

const MODE_RANK: Record<PermMode, number> = { request: 0, view: 1, propose: 2, full: 3 };

/** True when a cell of mode `has` satisfies an action needing `need`. */
export function modeSatisfies(has: PermMode, need: PermMode): boolean {
  if (need === 'request') return has === 'request' || has === 'full';
  if (has === 'request') return false;
  return MODE_RANK[has] >= MODE_RANK[need];
}

/** Grant types that open data for a key family. */
const VIEW_GRANTS: readonly GrantType[] = ['xem_ngoai_pham_vi', 'xem_noi_dung_chat', 'ho_tro_ky_thuat'];

const isReplyKey = (key: PermissionKey) => key === 'conv.reply' || key === 'msg.react' || key === 'conv.status';

/** Does scope `s` of role `r` cover target `t` for subject `u`? */
export function scopeCovers(s: ScopeCode, r: SubjectRole, u: Subject, t: Target, key: PermissionKey): boolean {
  const inSubtree = () => (t.unitIds ?? []).some((id) => r.subtree.has(id));
  switch (s) {
    case 'ALL':
    case 'TD':
      return true;
    case 'DV':
      return !!r.divisionId && t.divisionId === r.divisionId;
    case 'TO':
      return inSubtree();
    case 'NH':
      // Group scope only for the group's manager; otherwise it is the person's own scope.
      if (r.isManager) return inSubtree();
      return (t.responsibleIds ?? []).includes(u.userId);
    case 'CT':
      if (r.isManager && GROUP_LEAD_ROLES.includes(r.roleKey) && inSubtree()) return true;
      return (t.responsibleIds ?? []).includes(u.userId);
    case 'SELF':
      return (t.selfIds ?? []).includes(u.userId);
    case 'NICK':
      return !!t.channelId && t.channelKind !== 'official' && u.nicks.has(t.channelId);
    case 'KENH': {
      if (!t.channelId || t.channelKind !== 'official') return false;
      const levels = u.channelLevels.get(t.channelId);
      return !!levels && (levels.has('gui') || (!isReplyKey(key) && levels.has('xem')));
    }
    case 'TK':
      return (t.ticketAssigneeIds ?? []).includes(u.userId);
    case 'LEAD':
      return !!t.isLead && !!t.channelId && !!u.channelLevels.get(t.channelId)?.has('lead');
    case 'TUYEN':
      return (t.routeOwnerIds ?? []).includes(u.userId);
    case 'YC':
      return grantCovers(u, t, key);
    default:
      return false;
  }
}

/** An active temporary grant covering the target, with the right the key needs. */
export function grantCovers(u: Subject, t: Target, key: PermissionKey): boolean {
  const targets = new Set(t.grantTargets ?? []);
  if (!targets.size) return false;
  const right: GrantRight = isReplyKey(key) ? 'tra_loi' : key === 'conv.note' ? 'ghi_chu' : 'xem';
  return u.grants.some((g) => VIEW_GRANTS.includes(g.type) && targets.has(g.target) && g.rights.includes(right));
}

/**
 * `can(user, key, object)` (docs 01 §2.4). Union of the user's role assignments; each assignment only
 * reaches inside its own unit (§2.1 "Một người nhiều vai trò").
 */
export function decide(u: Subject, key: PermissionKey, t: Target = {}, opts: DecideOptions = {}): Decision {
  if (!u.active) return { allowed: false, via: 'tai_khoan_khong_hoat_dong' };
  const need = opts.need ?? 'full';
  const conditions = new Set(opts.conditions ?? []);
  let reason = 'khong_co_quyen';
  for (const r of u.roles) {
    const cell = rowOf(r)[key];
    if (!cell || !cell.s.length) continue;
    if (!modeSatisfies(cell.mode ?? 'full', need)) {
      reason = 'chi_duoc_' + (cell.mode ?? 'full');
      continue;
    }
    if (cell.cond && !conditions.has(cell.cond)) {
      reason = `thieu_dieu_kien:${cell.cond}`;
      continue;
    }
    if (cell.notSelf && t.userId && t.userId === u.userId) {
      reason = 'khong_ap_dung_cho_chinh_minh';
      continue;
    }
    for (const s of cell.s) {
      if (scopeCovers(s, r, u, t, key)) return { allowed: true, via: s, log: cell.log || s === 'YC' };
    }
    reason = 'ngoai_pham_vi';
  }
  // §2.9 step 4: the nick holder (or "Trực nick") always sees and answers on his nick, whatever the role (PQ-44).
  if ((key === 'conv.view' || key === 'conv.reply') && t.channelId && t.channelKind !== 'official' && u.nicks.has(t.channelId)) {
    return { allowed: true, via: 'NICK' };
  }
  // §2.9 step 6: a temporary grant covering the object.
  if ((key === 'conv.view' || key === 'conv.reply' || key === 'conv.note' || key === 'cust.view') && grantCovers(u, t, key)) {
    return { allowed: true, via: 'YC', log: true };
  }
  return { allowed: false, via: reason };
}

/** Effective permissions of a subject (GET /api/me/permissions): union over role assignments. */
export function effectivePermissions(u: Subject): Partial<Record<PermissionKey, EffectivePermission>> {
  const out: Partial<Record<PermissionKey, EffectivePermission>> = {};
  if (!u.active) return out;
  for (const r of u.roles) {
    for (const [k, cell] of Object.entries(rowOf(r)) as [PermissionKey, PermCell][]) {
      if (!cell.s.length && !cell.reveal?.length) continue;
      const scopes = cell.s.map((s) => (s === 'CT' && r.isManager && GROUP_LEAD_ROLES.includes(r.roleKey) ? 'NH' : s));
      const cur = out[k];
      const mode = cell.mode ?? 'full';
      const conds = cell.cond ? [cell.cond] : [];
      if (!cur) {
        out[k] = { scopes: [...new Set(scopes)], mode, ...(cell.log ? { log: true } : {}), ...(conds.length ? { conds } : {}), ...(cell.reveal ? { reveal: [...cell.reveal] } : {}) };
        continue;
      }
      cur.scopes = [...new Set([...cur.scopes, ...scopes])];
      if (MODE_RANK[mode] > MODE_RANK[cur.mode]) cur.mode = mode;
      if (cell.log) cur.log = true;
      // An unconditional role clears the condition.
      cur.conds = cur.conds && conds.length ? [...new Set([...cur.conds, ...conds])] : undefined;
      if (!cur.conds) delete cur.conds;
      if (cell.reveal) cur.reveal = [...new Set([...(cur.reveal ?? []), ...cell.reveal])];
    }
  }
  return out;
}

/** True when the subject has the key in some scope (route-level check, before object checks). */
export function hasKey(u: Subject, key: PermissionKey, opts: { need?: PermMode; scopes?: ScopeCode[] } = {}): boolean {
  if (!u.active) return false;
  const need = opts.need ?? 'full';
  for (const r of u.roles) {
    const cell = rowOf(r)[key];
    if (!cell || !cell.s.length || cell.cond) continue;
    if (!modeSatisfies(cell.mode ?? 'full', need)) continue;
    if (opts.scopes && !cell.s.some((s) => opts.scopes!.includes(s))) continue;
    return true;
  }
  // The holder of a nick may always read and answer on it (PQ-44); grants open single objects.
  if ((key === 'conv.view' || key === 'conv.reply') && !opts.scopes && u.nicks.size) return true;
  if ((key === 'conv.view' || key === 'cust.view') && !opts.scopes && u.grants.length) return true;
  return false;
}

/**
 * How a customer phone shows to the subject (cust.phone_full, MH-PQ-12): `full` always shown,
 * `reveal` masked with a "Hiện" button (each click logged), `masked` never.
 */
export function phoneVisibility(u: Subject, t: Target, opts: DecideOptions = {}): 'full' | 'reveal' | 'masked' {
  if (!u.active) return 'masked';
  const conditions = new Set(opts.conditions ?? []);
  let best: 'full' | 'reveal' | 'masked' = 'masked';
  for (const r of u.roles) {
    const cell = rowOf(r)['cust.phone_full'];
    if (!cell || (cell.cond && !conditions.has(cell.cond))) continue;
    if (cell.s.some((s) => scopeCovers(s, r, u, t, 'cust.phone_full'))) return 'full';
    if ((cell.reveal ?? []).some((s) => scopeCovers(s, r, u, t, 'cust.phone_full'))) best = 'reveal';
  }
  // The nick holder sees the full number of identities on his nick (§2.5 giu_nick).
  if (t.channelId && t.channelKind !== 'official' && u.nicks.has(t.channelId)) return 'full';
  return best;
}
