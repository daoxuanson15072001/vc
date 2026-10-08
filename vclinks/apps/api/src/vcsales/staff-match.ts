import type { VcsalesStaffMatching, VcsalesStaffRow, VcsalesStaffState } from '@vclinks/shared';
import type { VcsaleStaffMember } from '@vclinks/vcsale-client';

export interface MatchUser {
  id: string;
  fullName: string;
  status: string;
}

/** E-mail as VClinks stores it (`users.email` is lower case); null when there is none. */
export const emailKey = (e: string | null | undefined): string | null => (e ?? '').trim().toLowerCase() || null;

const ORDER: Record<VcsalesStaffState, number> = { no_email: 0, no_user: 1, duplicated_email: 2, matched: 3 };

/**
 * VCsales salespersons ↔ VClinks users by company e-mail (D8-06, plan C5). An e-mail shared by several VCsales
 * staff matches nobody, so a customer is never given to the wrong person. Staff still working come first, the
 * ones to fix first among them; counts only take staff still working.
 */
export function matchStaff(staff: VcsaleStaffMember[], users: Map<string, MatchUser>): Pick<VcsalesStaffMatching, 'rows' | 'counts'> {
  const uses = new Map<string, number>();
  for (const s of staff) {
    const k = emailKey(s.email);
    if (k) uses.set(k, (uses.get(k) ?? 0) + 1);
  }
  const rows = staff.map((s): VcsalesStaffRow => {
    const k = emailKey(s.email);
    const user = k ? (users.get(k) ?? null) : null;
    const state: VcsalesStaffState = !k ? 'no_email' : (uses.get(k) ?? 0) > 1 || s.emailDuplicated ? 'duplicated_email' : user ? 'matched' : 'no_user';
    return {
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      active: s.active,
      positionName: s.positionName,
      departmentName: s.departmentName,
      state,
      user: state === 'matched' ? user : null,
    };
  });
  rows.sort((a, b) => Number(b.active) - Number(a.active) || ORDER[a.state] - ORDER[b.state] || a.fullName.localeCompare(b.fullName, 'vi'));
  const counts = { total: 0, matched: 0, no_user: 0, no_email: 0, duplicated_email: 0 };
  for (const r of rows) {
    if (!r.active) continue;
    counts.total++;
    counts[r.state]++;
  }
  return { rows, counts };
}
