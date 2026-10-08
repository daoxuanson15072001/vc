/**
 * System settings (04 VH-ADM-05; 05 `system_settings`). Values are checked with zod; `readOnly` ones are shown but
 * never changed. Each session adds the settings it uses.
 */
import { z } from 'zod';

export interface SettingDef<T> {
  schema: z.ZodType<T>;
  default: T;
  readOnly?: boolean;
  /** Short Vietnamese label for screens and the change log. */
  label: string;
  /** Allowed values in Vietnamese, shown when a value is rejected. */
  hint: string;
  basis: string;
}

const def = <T>(d: SettingDef<T>) => d;

export const SETTINGS = {
  // VH-BR-25: "từ 21 người trở lên" needs a second person; may be lowered, never raised.
  'bulk.confirm_min_people': def({ schema: z.number().int().min(2).max(21), default: 21, label: 'Số người bị ảnh hưởng cần quản trị xác nhận lần hai', hint: 'số nguyên từ 2 đến 21', basis: 'VH-BR-25' }),
  'bulk.confirm_drift_percent': def({ schema: z.number().int(), default: 20, readOnly: true, label: 'Lệch số người cho phép khi áp so với lúc xác nhận (%)', hint: 'số nguyên', basis: 'VH-BR-25' }),
  'changes.past_warning_days': def({ schema: z.number().int(), default: 30, readOnly: true, label: 'Cảnh báo khi ngày hiệu lực đã qua quá số ngày', hint: 'số nguyên', basis: '06 mục 1.5' }),
  'changes.overdue_alert_minutes': def({ schema: z.number().int().min(5).max(120), default: 15, label: 'Cảnh báo khi thay đổi hẹn chờ áp quá số phút', hint: 'số nguyên từ 5 đến 120', basis: 'Kế hoạch GĐ B mục 6.1' }),
  'imports.write_within_hours': def({ schema: z.number().int().min(1).max(72), default: 24, label: 'Thời gian được ghi sau khi kiểm thử (giờ)', hint: 'số nguyên từ 1 đến 72', basis: 'VH-IMP-01' }),
  'google.reconcile_at': def({ schema: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), default: '06:00', label: 'Giờ đối chiếu Google', hint: 'giờ dạng HH:MM, ví dụ 06:00', basis: 'VH-IMP-02' }),
  'google.safety_min_percent': def({ schema: z.number().int().min(30).max(90), default: 50, label: 'Ngưỡng dừng an toàn đối chiếu (%)', hint: 'số nguyên từ 30 đến 90', basis: 'Thiết kế SSO mục 5.6' }),
  'lifecycle.long_leave_min_days': def({ schema: z.number().int(), default: 7, readOnly: true, label: 'Ngưỡng nghỉ dài ngày (ngày)', hint: 'số nguyên', basis: 'VH-BR-15' }),
  'lifecycle.lock_on_long_leave': def({ schema: z.boolean(), default: false, label: 'Mặc định khoá đăng nhập khi nghỉ dài ngày', hint: 'true hoặc false', basis: 'VH-BR-15' }),
  'alerts.dedupe_minutes': def({ schema: z.number().int().min(15).max(240), default: 60, label: 'Không lặp cảnh báo trong (phút)', hint: 'số nguyên từ 15 đến 240', basis: 'VH-ADM-04' }),
  'audit.retention_months': def({ schema: z.number().int(), default: 24, readOnly: true, label: 'Thời hạn giữ nhật ký (tháng)', hint: 'số nguyên', basis: 'VH-BR-18, Q-10' }),
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = (typeof SETTINGS)[K]['default'];

export function isSettingKey(k: string): k is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS, k);
}
