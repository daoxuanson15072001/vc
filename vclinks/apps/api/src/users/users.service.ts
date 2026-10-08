import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { C, DbService } from '../db/db.service';

export const USER_STATUSES = ['cho_kich_hoat', 'hoat_dong', 'tam_khoa', 'nghi_viec'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** `users` (docs 01 §2.8). Roles, org units and channel access arrive in M1b-03/04. */
export interface UserDoc {
  _id: string;
  email: string;
  fullName: string;
  phone?: string;
  status: UserStatus;
  lastLoginAt?: Date;
  /** Unit shown as the person's place (M1b-03); must be one of the assignment units. */
  primaryOrgUnitId?: string;
  lockReason?: string;
  lockedBy?: string;
  leftAt?: Date;
  /** "Sắp nghỉ" flag set by a supervisor / director (L-05, PQ-82). */
  preLeave?: { date: string; reason: string; by: string; at: Date };
  createdAt?: Date;
  createdBy?: string;
  tenant_id?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  /** Case-insensitive lookup in the current tenant. */
  findByEmail(email: string): Promise<UserDoc | null> {
    return this.db.col<UserDoc>(C.users).findOne({ email: email.trim().toLowerCase() });
  }

  /**
   * First Google login of a company address (docs 01 PQ-10, dev002 06/10/2026): a user without any role, so the
   * person can sign in but sees no customer data until an Admin assigns a role. `created` is false when another
   * login made the record at the same moment (unique tenant + email index).
   */
  async createFromSso(email: string, name: string | undefined): Promise<{ user: UserDoc; created: boolean }> {
    const clean = email.trim().toLowerCase();
    const user: UserDoc = {
      _id: `u_${randomBytes(6).toString('hex')}`,
      email: clean,
      fullName: (name ?? '').trim().slice(0, 120) || clean.split('@')[0],
      status: 'hoat_dong',
      createdAt: new Date(),
      createdBy: 'sso',
    };
    try {
      await this.db.col<UserDoc>(C.users).insertOne(user);
      return { user, created: true };
    } catch (e) {
      const same = (e as { code?: number }).code === 11000 ? await this.findByEmail(clean) : null;
      if (same) return { user: same, created: false };
      throw e;
    }
  }

  /** Marks a successful login; the first login activates a user waiting for activation. */
  async markLogin(user: UserDoc): Promise<void> {
    await this.db.col<UserDoc>(C.users).updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date(), ...(user.status === 'cho_kich_hoat' ? { status: 'hoat_dong' as const } : {}) } },
    );
  }
}
