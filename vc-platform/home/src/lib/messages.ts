/** Vietnamese wording of VH-MH-01, VH-MH-02 (06 màn hình). Pure functions, unit-tested. */

export interface ErrorText {
  title: string;
  detail: string;
  /** Secondary button besides "Thử lại". */
  secondary?: 'select_account' | 'home';
}

/** Error codes shared with every app (thiết kế SSO mục 5.2). */
export const ERRORS: Record<string, ErrorText> = {
  outside_domain: { title: 'Tài khoản này không thuộc công ty', detail: 'Hãy chọn tài khoản @vcprosperous.com hoặc @vcpart.vn.', secondary: 'select_account' },
  app_not_granted: { title: 'Bạn chưa được cấp ứng dụng này', detail: 'Xin quyền trên VC Home hoặc liên hệ quản lý trực tiếp.', secondary: 'home' },
  not_granted: { title: 'Bạn chưa có tài khoản trong ứng dụng này', detail: 'Liên hệ quản trị viên của ứng dụng.', secondary: 'home' },
  locked: { title: 'Tài khoản đã bị khoá', detail: 'Liên hệ quản trị viên.' },
  identity_conflict: { title: 'Tài khoản đang gắn với một định danh khác', detail: 'Quản trị viên đã được báo. Bạn chưa cần làm gì thêm.' },
  state_invalid: { title: 'Liên kết đăng nhập đã hết hạn', detail: 'Bấm Thử lại để đăng nhập từ đầu.' },
  idp_unreachable: { title: 'Không kết nối được máy chủ đăng nhập', detail: 'Phiên đang mở ở các app vẫn dùng được. Thử lại sau ít phút.' },
  cancelled: { title: 'Bạn đã huỷ đăng nhập', detail: 'Bấm Thử lại khi sẵn sàng.' },
};
const GENERIC: ErrorText = { title: 'Có lỗi khi đăng nhập', detail: 'Bấm Thử lại. Nếu vẫn lỗi, gửi mã bên dưới cho bộ phận IT.' };

export function errorText(code: string | null | undefined): ErrorText {
  return (code && ERRORS[code]) || GENERIC;
}

/** Turns an oidc-client-ts error into one of the shared codes. */
export function authErrorCode(e: unknown): string {
  const err = e as { error?: string; message?: string; name?: string } | undefined;
  if (err?.error === 'access_denied') return 'cancelled';
  if (err?.error === 'temporarily_unavailable') return 'idp_unreachable';
  if (/No matching state|state/i.test(err?.message ?? '') && !err?.error) return 'state_invalid';
  if (err?.name === 'TypeError' || /Failed to fetch|NetworkError|Network Error|Load failed/i.test(err?.message ?? '')) return 'idp_unreachable';
  return 'loi_chung';
}

export const LOGIN_REQUIRED = new Set(['login_required', 'interaction_required', 'invalid_grant']);

/** Notice for people who have no app tile yet (claim vc_trang_thai, D-BA-37). */
export function statusNotice(status: string | undefined, supportEmail: string): { type: 'warning' | 'info'; text: string } | undefined {
  switch (status) {
    case 'du_dieu_kien':
      return undefined;
    case 'chua_bat_2_buoc':
      return {
        type: 'warning',
        text: 'Tài khoản của bạn chưa bật xác thực 2 bước nên chưa vào được ứng dụng. Bật tại myaccount.google.com/security, sau 15 phút tải lại trang.',
      };
    case 'loai_tru':
      return {
        type: 'info',
        text: 'Tài khoản này là tài khoản dùng chung hoặc tài khoản dịch vụ, không dùng để vào ứng dụng. Hãy đăng nhập bằng tài khoản cá nhân.',
      };
    default:
      return { type: 'info', text: `Tài khoản của bạn đang được kiểm tra. Thử lại sau 15 phút hoặc liên hệ ${supportEmail}.` };
  }
}

const VN = 'Asia/Ho_Chi_Minh';

export function greeting(now: Date, name: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: VN }).format(now));
  const part = hour < 12 ? 'sáng' : hour < 18 ? 'chiều' : 'tối';
  return name ? `Chào buổi ${part}, ${name}` : `Chào buổi ${part}`;
}

/** "HH:mm dd/mm/yyyy", Vietnam time. */
export function stamp(now: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: VN, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return `${p.hour}:${p.minute} ${p.day}/${p.month}/${p.year}`;
}

/** Only paths inside VC Home; anything else goes home (VH-MH-01 "Kiểm tra nhập liệu"). */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  if (/^\/(callback|silent|da-dang-xuat|loi)(\/|\?|$)/.test(next)) return '/';
  return next;
}

export function initials(name: string | undefined, email: string | undefined): string {
  const src = (name || email || '?').trim();
  const words = src.split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : src[0]).toUpperCase();
}
