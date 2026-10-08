import type { CustomRolePicks, OrgUnitType, RoleKey } from '@vclinks/shared';

/** Collections added by M1b-03 (docs 01 §2.8). All are tenant-scoped. */
export const ORG_C = {
  orgUnits: 'org_units',
  roleAssignments: 'role_assignments',
  roleChangeRequests: 'role_change_requests',
  scheduledChanges: 'scheduled_changes',
  securitySettings: 'security_settings',
  customRoles: 'custom_roles',
} as const;

/** Custom role (MH-PQ-05): a system role with fewer scopes. `_id` (`tc_…`) is also its import code. */
export interface CustomRoleDoc {
  _id: string;
  name: string;
  /** foldVi(name): names are unique without accents or case. */
  nameKey: string;
  baseRole: RoleKey;
  description: string;
  /** Scopes kept per key where they differ from the base role ([] = ✖). */
  picks: CustomRolePicks;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  tenant_id?: string;
}

export interface OrgUnitDoc {
  /** Same as `code`. */
  _id: string;
  code: string;
  type: OrgUnitType;
  name: string;
  parentId: string | null;
  /** Division the unit belongs to (itself for a division); null for the root. */
  divisionId: string | null;
  managerUserId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  tenant_id?: string;
}

export interface RoleAssignmentDoc {
  /** `${userId}:${roleKey}:${orgUnitId}` */
  _id: string;
  userId: string;
  roleKey: RoleKey;
  /** Custom role built on `roleKey` (then `_id` is `${userId}:${customRoleId}:${orgUnitId}`). */
  customRoleId?: string;
  orgUnitId: string;
  from?: Date;
  to?: Date;
  createdBy: string;
  createdAt: Date;
  tenant_id?: string;
}

export interface RoleChangeRequestDoc {
  _id: string;
  targetUserId: string;
  change: { op: 'add' | 'remove'; roleKey: RoleKey; customRoleId?: string; orgUnitId: string; lead?: boolean; from?: Date; to?: Date };
  requestedBy: string;
  approverRule: 'quan_sat' | 'nguoi_duyet_tap_doan';
  status: 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'huy';
  reason: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  tenant_id?: string;
}

export interface ScheduledChangeDoc {
  _id: string;
  userId: string;
  kind: 'change_unit';
  payload: { fromOrgUnitId: string; toOrgUnitId: string };
  effectiveAt: Date;
  status: 'cho' | 'xong' | 'loi';
  createdBy: string;
  createdAt: Date;
  note?: string;
  tenant_id?: string;
}

export const assignmentId = (userId: string, roleKey: string, orgUnitId: string) => `${userId}:${roleKey}:${orgUnitId}`;
