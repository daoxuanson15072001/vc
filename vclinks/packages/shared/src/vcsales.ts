/**
 * Quản trị → "Kết nối VCsales" (plan docs/01-quan-ly-du-an/ke-hoach-ket-noi-vcsales.md, C5 + C6): the state of the
 * connection to VCsales and the matching of VCsales salespersons with VClinks users by company e-mail (D8-06).
 */

/** Last connection check. `ok: null` until the first check of this API process. */
export interface VcsalesHealthView {
  mode: 'mock' | 'http';
  ok: boolean | null;
  checkedAt: string | null;
  /** How long the last check took (ms). */
  latencyMs: number | null;
  version: string | null;
  /** Why VCsales cannot be used, from the last check; null when ok. */
  error: string | null;
  /** Since when VCsales has not answered (first failed check of the outage); null while ok. */
  downSince: string | null;
  lastOkAt: string | null;
  /** Minutes between two checks while ok (a failed check retries sooner). */
  everyMinutes: number;
}

/**
 * Why a VCsales salesperson is or is not matched with a VClinks user:
 * `matched` same e-mail; `no_user` nobody in VClinks has that e-mail yet; `no_email` VCsales has no e-mail for
 * the person; `duplicated_email` several VCsales staff share the e-mail (not matched, to stay safe).
 */
export const VCSALES_STAFF_STATES = ['matched', 'no_user', 'no_email', 'duplicated_email'] as const;
export type VcsalesStaffState = (typeof VCSALES_STAFF_STATES)[number];

export const VCSALES_STAFF_STATE_LABELS: Record<VcsalesStaffState, string> = {
  matched: 'Đã ghép',
  no_user: 'Chưa có tài khoản VClinks',
  no_email: 'Thiếu email trên VCsales',
  duplicated_email: 'Email trùng trên VCsales',
};

export interface VcsalesStaffRow {
  id: string;
  fullName: string;
  email: string | null;
  active: boolean;
  positionName: string | null;
  departmentName: string | null;
  state: VcsalesStaffState;
  /** The VClinks user with the same e-mail (only when `matched`). */
  user: { id: string; fullName: string; status: string } | null;
}

export interface VcsalesStaffMatching {
  /** When the staff list was read from VCsales; null when it never could be. */
  fetchedAt: string | null;
  /** ERR-ERP text when this read failed (the last list, if any, is shown). */
  error: string | null;
  rows: VcsalesStaffRow[];
  /** Counts of the people still working (inactive staff are listed but not counted). */
  counts: { total: number } & Record<VcsalesStaffState, number>;
}

export interface VcsalesStatusResponse {
  health: VcsalesHealthView;
  staff: VcsalesStaffMatching;
}
