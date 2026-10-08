import { NAV_ITEMS } from './nav';

export const APP_NAME = 'VClinks';

/** Unread badge the realtime bridge prefixes while the tab is hidden: "(3) ...". */
const BADGE_RE = /^\(\d+\+?\) /;

/** Static titles of routes that are not (or not exactly) a menu item. Longest prefix wins. */
const EXTRA: [string, string][] = [
  ['/login', 'Đăng nhập'],
  ['/search', 'Tìm kiếm tin nhắn'],
  ['/contacts/requests', 'Lời mời kết bạn'],
  ['/admin/users', 'Người dùng'],
  ['/me', 'Tài khoản của tôi'],
  ['/settings/activity', 'Hoạt động của tôi'],
  ['/settings/tokens', 'Token của tôi'],
  ['/notifications', 'Thông báo'],
];

/** Default title part of a pathname: menu label or a known extra route; `null` when unknown. */
export function pageTitleOf(pathname: string): string | null {
  const candidates: [string, string][] = [...EXTRA, ...NAV_ITEMS.map((i): [string, string] => [i.path, i.label])];
  const hit = candidates.filter(([p]) => pathname === p || pathname.startsWith(`${p}/`)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? null;
}

/** "Tin nhắn · VClinks", or just "VClinks" when there is no part. */
export const formatTitle = (part: string | null | undefined): string => (part ? `${part} · ${APP_NAME}` : APP_NAME);

/** The title without the unread badge. */
export const baseTitle = (title: string): string => title.replace(BADGE_RE, '') || APP_NAME;

/** Set the document title for a page, keeping the unread badge the realtime bridge may have added. */
export function applyDocumentTitle(part: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  const badge = document.title.match(BADGE_RE)?.[0] ?? '';
  document.title = badge + formatTitle(part);
}
