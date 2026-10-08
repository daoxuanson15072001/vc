import { HEALTH_OFFLINE_MS, type HealthLevel, type SessionLostReason } from '@vclinks/shared';

export const HEALTH_LABELS: Record<HealthLevel, string> = {
  green: 'Đang kết nối',
  yellow: 'Chậm',
  red: 'Mất kết nối',
  unsafe: 'Chưa an toàn',
};

/** Sale-facing sentence per way a session is lost (03 MH-SZ-12a #2). */
const LOST_TEXT: Record<SessionLostReason, string> = {
  qr: 'Zalo Web không đăng nhập nick này. Cần người giữ nick quét mã QR đăng nhập trên điện thoại.',
  tab_missing: 'Chưa mở Zalo Web của nick này trên máy kết nối.',
  cdp_down: 'Trình duyệt của nick này trên máy kết nối đang tắt.',
  extension_silent: 'Zalo Web đang mở nhưng không báo tin về VClinks.',
  duplicate_web: 'Nick đang mở Zalo Web ở nơi khác nên kết nối trực tiếp bị ngắt. Đóng Zalo Web đó rồi bấm "Quét lại QR".',
  direct_down: 'Kết nối trực tiếp của nick tới Zalo bị ngắt, máy Zalo đang thử kết nối lại.',
};

const WAITING_TEXT: Record<string, string> = {
  user_active: 'Zalo Web đang có người thao tác, tin có thể về chậm.',
  tab_hidden: 'Zalo Web đang bị che hoặc ẩn, tin có thể về chậm.',
  busy: 'Zalo Web đang bận, tin có thể về chậm.',
};

export interface HealthInput {
  /** False for API channels (Zalo OA, Fanpage): the server sends, no extension to watch. */
  extensionChannel: boolean;
  unsafe: boolean;
  session: { state: 'ok' | 'lost'; reason: SessionLostReason | null; since: Date } | null;
  presence: { lastSeenAt: Date; loggedIn: boolean | null; waiting: string | null } | null;
  openDrifts: number;
  now: Date;
}

export interface HealthResult {
  level: HealthLevel;
  reason: string | null;
  technical: string | null;
  since: Date | null;
}

/**
 * Pure rule set behind GET /accounts/:uid/health. Red only when something is
 * known to be broken; an extension that never reported is yellow (commands wait).
 */
export function computeHealth(i: HealthInput): HealthResult {
  const res = (level: HealthLevel, reason: string | null, technical: string | null, since: Date | null): HealthResult => ({
    level,
    reason,
    technical,
    since,
  });
  if (i.unsafe) return res('unsafe', 'Nick đang bị đánh dấu "Chưa an toàn", tạm khóa gửi. Hãy báo Admin.', 'accounts.unsafe=true', null);
  if (!i.extensionChannel) return res('green', null, null, null);
  if (i.session?.state === 'lost') {
    const why = i.session.reason ?? 'qr';
    return res('red', LOST_TEXT[why], `session.lost:${why}`, i.session.since);
  }
  const p = i.presence;
  if (p) {
    const silentMs = i.now.getTime() - p.lastSeenAt.getTime();
    if (silentMs > HEALTH_OFFLINE_MS) {
      return res('red', 'VClinks không nhận được tín hiệu từ Zalo Web của nick này. Hãy mở chat.zalo.me trên máy kết nối.', 'extension.offline', p.lastSeenAt);
    }
    if (p.loggedIn === false) {
      return res('red', 'Zalo Web đang không đăng nhập đúng nick này (có thể đã bị đăng xuất).', 'extension.notLoggedIn', p.lastSeenAt);
    }
    if (p.waiting && WAITING_TEXT[p.waiting]) return res('yellow', WAITING_TEXT[p.waiting], `extension.waiting:${p.waiting}`, p.lastSeenAt);
  } else {
    return res('yellow', 'Chưa thấy Zalo Web của nick này báo về. Lệnh gửi sẽ chờ tới khi nick kết nối.', 'extension.neverSeen', null);
  }
  if (i.openDrifts > 0) {
    return res('yellow', 'Dữ liệu của nick này đang chờ Admin xử lý nên tin mới có thể về chậm.', `drift.open:${i.openDrifts}`, null);
  }
  return res('green', null, null, null);
}
