/**
 * Error codes of VC Home API (khung chung mục 6; câu theo 06 mục 1.4).
 * Two response shapes share these codes:
 * - internal API for the SPA: `{ code, message, details? }`;
 * - API for apps (07 mục 5.1): `{ error: { code, message, correlation_id } }`, with the app codes below.
 */
export interface ErrorDef {
  status: number;
  /** Vietnamese sentence shown to people; `{maLoi}` is replaced by the first 6 characters of the request id. */
  message: string;
}

export const ERRORS = {
  bad_request: { status: 400, message: 'Dữ liệu gửi lên không hợp lệ.' },
  unauthorized: { status: 401, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' },
  forbidden: { status: 403, message: 'Bạn không có quyền thực hiện thao tác này.' },
  not_found: { status: 404, message: 'Không tìm thấy dữ liệu. Có thể đã bị xoá hoặc bạn không còn quyền xem.' },
  conflict_rev: { status: 409, message: 'Dữ liệu vừa được người khác thay đổi. Tải lại để xem bản mới nhất.' },
  payload_too_large: { status: 413, message: 'Tệp hoặc dữ liệu gửi lên quá lớn.' },
  rate_limited: { status: 429, message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.' },
  feature_off: { status: 503, message: 'Chức năng này chưa bật.' },
  idp_unreachable: { status: 503, message: 'Không kết nối được máy chủ đăng nhập. Thử lại sau ít phút.' },
  server_error: { status: 500, message: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút. Mã lỗi: {maLoi}.' },
} as const satisfies Record<string, ErrorDef>;

export type ErrorCode = keyof typeof ERRORS;

/** Codes apps see (07 mục 5.1). */
export type AppErrorCode =
  | 'bad_request'
  | 'invalid_token'
  | 'insufficient_scope'
  | 'not_service_token'
  | 'app_mismatch'
  | 'data_level_denied'
  | 'not_found'
  | 'cursor_expired'
  | 'rate_limited'
  | 'server_error'
  | 'service_unavailable';

/** Internal code → app code, when a shared error reaches an app route. */
export const APP_CODE: Record<ErrorCode, AppErrorCode> = {
  bad_request: 'bad_request',
  unauthorized: 'invalid_token',
  forbidden: 'insufficient_scope',
  not_found: 'not_found',
  conflict_rev: 'bad_request',
  payload_too_large: 'bad_request',
  rate_limited: 'rate_limited',
  feature_off: 'service_unavailable',
  idp_unreachable: 'server_error',
  server_error: 'server_error',
};

export function errorMessage(code: ErrorCode, requestId?: string): string {
  return ERRORS[code].message.replace('{maLoi}', (requestId ?? '').slice(0, 6) || '—');
}
