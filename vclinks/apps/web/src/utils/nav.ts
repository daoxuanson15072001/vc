import type { MePermissions, PermissionKey, ScopeCode } from '@vclinks/shared';
import { hasPermission } from './permissions';

/**
 * Menu of the app shell (00 §2.1 / §2.2, M1b-08). One table: label, route, the keys of 01 that show the item
 * and which scopes of the key count. Only routes that exist are listed; later sessions add a line here.
 * "YC" (request only) never shows an item: it opens by link while a temporary grant is active (00 §2.2).
 */
export type NavId =
  | 'conversations'
  | 'outbox'
  | 'approvals'
  | 'workitems'
  | 'reports'
  | 'customers'
  | 'erpMatching'
  | 'erpTasks'
  | 'erpCatalog'
  | 'contacts'
  | 'channels'
  | 'sync'
  | 'admin';

export interface NavItem {
  id: NavId;
  group: 'work' | 'customers' | 'admin';
  label: string;
  /** Label under the icon in the nav rail (≤ 9 characters, the rail is 80 px wide). */
  short: string;
  path: string;
  /** Any of these keys opens the item. */
  keys: PermissionKey[];
  /** Only these scopes of the key count (default: any scope but YC). */
  scopes?: ScopeCode[];
  /** Also shown to a team lead (`lead` flag of a role assignment) who holds the key at all (00 ⁽¹⁶⁾). */
  orLead?: boolean;
  /** Also shown to a nick holder or the holder of an open máy Zalo slot, to scan the QR of his nick (00 ⁽¹³⁾). */
  orNick?: boolean;
}

const WIDE: ScopeCode[] = ['ALL', 'TD', 'DV', 'TO'];

export const NAV_ITEMS: NavItem[] = [
  { id: 'conversations', group: 'work', label: 'Tin nhắn', short: 'Hộp thư', path: '/conversations', keys: ['conv.view'] },
  // CSKH works the shared inbox, not nick-by-nick command queues: KENH / TK do not open "Lệnh gửi".
  { id: 'outbox', group: 'work', label: 'Lệnh gửi', short: 'Lệnh gửi', path: '/outbox', keys: ['conv.reply'], scopes: ['ALL', 'TD', 'DV', 'TO', 'CT', 'NICK', 'TUYEN'] },
  // Phiếu CSKH soạn – NVKD duyệt (M1c-03): the approver's tray (MH-SZ-15) and the CSKH queues (MH-OA-20).
  { id: 'approvals', group: 'work', label: 'Chờ tôi duyệt', short: 'Chờ duyệt', path: '/approvals', keys: ['workitem.approve', 'workitem.return'] },
  { id: 'workitems', group: 'work', label: 'Hàng việc CSKH', short: 'Phiếu', path: '/workitems', keys: ['workitem.submit', 'workitem.queue_config'], scopes: ['ALL', 'TD', 'DV', 'TK'] },
  // Báo cáo (M1c-09): NVKD, GS, GĐ, XEM hold report.performance; the NH scope of CSKH has no figures yet, so it is left out.
  { id: 'reports', group: 'work', label: 'Báo cáo', short: 'Báo cáo', path: '/reports', keys: ['report.performance'], scopes: ['ALL', 'TD', 'DV', 'TO', 'CT'] },
  { id: 'customers', group: 'customers', label: 'Khách hàng', short: 'Khách', path: '/customers', keys: ['cust.view'] },
  // MH-DK-13: sale admin confirms, GĐ division reads (D8-17); the key follows the matrix (GS has none).
  { id: 'erpMatching', group: 'customers', label: 'Đối chiếu mã KH', short: 'Mã KH', path: '/customers/erp-matching', keys: ['cust.erp_link'] },
  // MH-DK-12: sale admin processes, NVKD queues his customers, GS / GĐ read (the keys of those roles, D8-02).
  { id: 'erpTasks', group: 'customers', label: 'Việc VCsales', short: 'Việc VCs', path: '/customers/erp-tasks', keys: ['cust.erp_link', 'cust.transfer_request', 'cust.transfer_approve'] },
  // Plan C11: the catalogue load and sync, for sale admins and sales directors.
  { id: 'erpCatalog', group: 'customers', label: 'Danh mục VCsales', short: 'Danh mục', path: '/customers/erp-catalog', keys: ['cust.erp_link'] },
  { id: 'contacts', group: 'customers', label: 'Danh bạ', short: 'Danh bạ', path: '/contacts', keys: ['friend.respond'] },
  { id: 'channels', group: 'admin', label: 'Kênh kết nối', short: 'Kênh', path: '/channels', keys: ['channel.connect', 'channel.device', 'channel.status'], scopes: WIDE, orLead: true, orNick: true },
  { id: 'sync', group: 'admin', label: 'Đồng bộ', short: 'Đồng bộ', path: '/sync', keys: ['sync.view', 'mapping.approve'], scopes: WIDE },
  { id: 'admin', group: 'admin', label: 'Quản trị', short: 'Quản trị', path: '/admin', keys: ['org.view', 'user.view', 'role.view'] },
];

export const NAV_GROUPS: { id: NavItem['group']; label: string }[] = [
  { id: 'work', label: 'LÀM VIỆC' },
  { id: 'customers', label: 'KHÁCH HÀNG' },
  { id: 'admin', label: 'QUẢN TRỊ' },
];

/** `failed`: GET /me/permissions failed; the API still enforces everything, so show the menu. */
export function isNavItemVisible(item: NavItem, me: MePermissions | undefined, failed = false): boolean {
  if (failed) return true;
  if (!me) return false;
  if (me.legacy) return true;
  if (item.orNick && (me.heldChannels.length > 0 || me.zaloSlotHolder)) return true;
  const lead = me.roles.some((r) => r.lead);
  return item.keys.some((k) => {
    if (!hasPermission(me, k)) return false;
    const have = me.permissions[k]!.scopes;
    if (item.orLead && lead) return true;
    return have.some((s) => s !== 'YC' && (!item.scopes || item.scopes.includes(s)));
  });
}

export function visibleNavItems(me: MePermissions | undefined, failed = false): NavItem[] {
  return NAV_ITEMS.filter((i) => isNavItemVisible(i, me, failed));
}

/** Which item a pathname belongs to; `/` and unknown paths fall to nothing. */
export function navIdOf(pathname: string): NavId | null {
  if (pathname.startsWith('/conversations')) return 'conversations';
  // Longest path wins: /customers/erp-matching is its own item, other /customers/... belong to "Khách hàng".
  const hit = NAV_ITEMS.filter((i) => i.id !== 'conversations' && (pathname === i.path || pathname.startsWith(`${i.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return hit?.id ?? null;
}

/** Ctrl+K hint: "⌘ K" on macOS, "Ctrl K" elsewhere (MH-UI-01 #7). */
export function searchHint(platform: string): string {
  return /mac|iphone|ipad/i.test(platform) ? '⌘ K' : 'Ctrl K';
}
