import type { ChannelAccessLevel, GrantRight, GrantStatus, GrantType } from '@vclinks/shared';

/** Collections of the permission engine (docs 01 §2.8). Tenant-scoped. */
export const AUTHZ_C = {
  channelAccess: 'channel_access',
  accessGrants: 'access_grants',
  leaveRequests: 'leave_requests',
  notifications: 'notifications',
} as const;

/** Who uses which channel (§2.5). Written by M1b-06 (screens) and the seed; read here. */
export interface ChannelAccessDoc {
  _id: string;
  /** Account uid of the channel. */
  channelId: string;
  principalType: 'user' | 'org_unit';
  principalId: string;
  level: ChannelAccessLevel;
  from?: Date;
  to?: Date | null;
  createdBy: string;
  note?: string;
  tenant_id?: string;
}

/** Temporary grant (§2.6). Requests and approvals are M1b-05 / M1b-10; the engine reads active ones. */
export interface AccessGrantDoc {
  _id: string;
  userId: string;
  type: GrantType;
  targetType: 'account' | 'conversation' | 'org_unit' | 'channel' | 'user';
  targetId: string;
  rights: GrantRight[];
  from?: Date;
  to?: Date;
  reason: string;
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  status: GrantStatus;
  /** truc_thay: the absent person whose nick is covered (PQ-32). */
  absentUserId?: string;
  /** cho_duyet: approver computed by PQ-30 when the request was made. */
  approverId?: string;
  /** Hours asked for (cho_duyet); the approver may shorten (MH-PQ-07 #9). */
  durationHours?: number;
  createdAt?: Date;
  rejectReason?: string;
  revokedBy?: string;
  revokedAt?: Date;
  /** Leave request ("Đăng ký vắng") this cover was created from. */
  leaveRequestId?: string;
  /** Backdated cover: reason (PQ-32 v1.4.2, report only). */
  backdateReason?: string;
  tenant_id?: string;
}

/** "Đăng ký vắng" (PQ-32, MH-PQ-07 #6c): waits for the supervisor, who agrees by creating the cover. */
export interface LeaveRequestDoc {
  _id: string;
  userId: string;
  from: Date;
  to: Date;
  reason: string;
  proposedCoverId?: string | null;
  note?: string;
  approverId: string | null;
  status: 'cho_duyet' | 'dong_y' | 'tu_choi' | 'huy';
  createdAt: Date;
  decidedBy?: string;
  decidedAt?: Date;
  rejectReason?: string;
  backdateReason?: string;
  tenant_id?: string;
}
