import { ROLE_KEYS, ROLE_LABELS, ROLE_MATRIX, type MePermissions, type PermissionKey, type ScopeCode } from '@vclinks/shared';

/**
 * Button rule of docs 01 MH-PQ-11 / 00 §5.5 (D8-02):
 * - the key is absent from `GET /api/me/permissions` (no role ever has it)  -> hide;
 * - the key is there but a condition is still missing (mode, `conds`, or a reason the caller knows,
 *   such as "nick not assigned") -> show disabled with a tooltip;
 * - otherwise show.
 */
export type ButtonState = { state: 'show' } | { state: 'hide' } | { state: 'lock'; reason: string };

/** Texts of the engine's unchecked conditions (`PermCell.cond`) shown as tooltips. */
const COND_TEXT: Record<string, string> = {
  ticket_open: 'Chỉ dùng được khi khách đang có ticket mở với bạn.',
  no_messages: 'Chỉ dùng được cho khách chưa có tin nhắn.',
  tag_note_only: 'Bạn chỉ được sửa thẻ và ghi chú.',
  note_only: 'Bạn chỉ được sửa ghi chú.',
  to_own_team: 'Chỉ chuyển được về tổ của bạn.',
  on_behalf: 'Chỉ dùng khi trả lời thay.',
};

const MODE_TEXT = {
  view: 'Bạn chỉ có quyền xem.',
  propose: 'Bạn chỉ được đề xuất, chờ người có quyền duyệt.',
  request: 'Bạn chỉ được gửi yêu cầu, chờ người có quyền duyệt.',
} as const;

export function buttonState(
  me: MePermissions | undefined,
  key: PermissionKey,
  opts: { lockReason?: string | null; needFull?: boolean } = {},
): ButtonState {
  // Not loaded yet: keep gated actions hidden rather than flashing them.
  if (!me) return { state: 'hide' };
  if (me.legacy) return opts.lockReason ? { state: 'lock', reason: opts.lockReason } : { state: 'show' };
  const p = me.permissions[key];
  if (!p) return { state: 'hide' };
  if (opts.lockReason) return { state: 'lock', reason: opts.lockReason };
  if (p.conds?.length) return { state: 'lock', reason: COND_TEXT[p.conds[0]] ?? 'Chưa đủ điều kiện để dùng thao tác này.' };
  if (opts.needFull && p.mode !== 'full') return { state: 'lock', reason: MODE_TEXT[p.mode] };
  return { state: 'show' };
}

/** The user has the key at all (route / menu level). Legacy tokens have everything. */
export function hasPermission(me: MePermissions | undefined, key: PermissionKey): boolean {
  return !!me && (me.legacy || !!me.permissions[key]);
}

export function hasAnyPermission(me: MePermissions | undefined, keys: PermissionKey[]): boolean {
  return keys.some((k) => hasPermission(me, k));
}

/** Scopes wide enough to see technical details (UID, raw content): not only the user's own nick / customers. */
const TECH_SCOPES: ScopeCode[] = ['TD', 'DV', 'TO', 'ALL'];

/**
 * "Technical view" of 03 §8 D17: UID and "Xem nội dung gốc" are for supervisors and above. A sales rep
 * (sync.view only on his own NICK) never sees them.
 */
/**
 * Signed in with a company address but no role yet (PQ-10): the app shows the waiting page instead of the
 * (empty) screens. Unknown permissions, legacy tokens and tokens without a user never wait.
 */
export function waitingForRole(me: MePermissions | undefined): boolean {
  return !!me && !me.legacy && !!me.userId && me.roles.length === 0;
}

export function canSeeTechnical(me: MePermissions | undefined): boolean {
  if (!me) return false;
  if (me.legacy) return true;
  return !!me.permissions['sync.view']?.scopes.some((s) => TECH_SCOPES.includes(s));
}

/** Roles that hold `key` with at least one of `scopes` (all scopes when omitted), in spec order. */
export function rolesWithKey(key: PermissionKey, scopes?: ScopeCode[]): string[] {
  return ROLE_KEYS.filter((r) => ROLE_MATRIX[r]?.[key]?.s?.some((s) => !scopes || scopes.includes(s))).map((r) => ROLE_LABELS[r]);
}
