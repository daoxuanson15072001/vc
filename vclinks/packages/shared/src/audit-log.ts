import { z } from "zod";

/*
 * Access log and abnormal-access alerts (docs 01 MH-PQ-10, MH-PQ-14, PQ-40, PQ-46, PQ-47; M1b-07).
 * Shared by the API and the Dashboard. Nothing here holds message content or a full phone number.
 */

/** Groups of the "Hành động" filter (MH-PQ-10 #4). An action belongs to the first group whose prefix matches. */
export const AUDIT_GROUPS = {
  truy_cap: { label: "Truy cập dữ liệu", prefixes: ["phone", "conversation", "customer", "contact"] },
  xuat: { label: "Xuất dữ liệu", prefixes: ["export"] },
  xoa: { label: "Xóa", prefixes: ["privacy", "message.delete", "conversation.delete", "customer.delete"] },
  quyen: { label: "Quyền", prefixes: ["role", "user", "grant", "channel_access", "org", "access"] },
  token: { label: "Token", prefixes: ["token", "device"] },
  mcp: { label: "MCP", prefixes: ["mcp"] },
  gui: { label: "Gửi tin", prefixes: ["outbox"] },
  dang_nhap: { label: "Đăng nhập", prefixes: ["login", "logout"] },
  kiem_soat: { label: "Kiểm soát", prefixes: ["audit", "alert"] },
  he_thong: { label: "Hệ thống và đồng bộ", prefixes: ["mapping", "drift", "db", "devreq", "account", "ingest"] },
} as const;
export type AuditGroup = keyof typeof AUDIT_GROUPS;
export const AUDIT_GROUP_KEYS = Object.keys(AUDIT_GROUPS) as AuditGroup[];

/** Deleting wins over the broader "truy cập" prefix (`conversation.delete`). */
const GROUP_ORDER: AuditGroup[] = ["xoa", "truy_cap", "xuat", "quyen", "token", "mcp", "gui", "dang_nhap", "kiem_soat", "he_thong"];

const prefixMatches = (action: string, prefix: string) => action === prefix || action.startsWith(`${prefix}.`) || action.startsWith(`${prefix}_`);

export function auditGroupOf(action: string): AuditGroup {
  for (const g of GROUP_ORDER) if (AUDIT_GROUPS[g].prefixes.some((p) => prefixMatches(action, p))) return g;
  return "he_thong";
}

/** The default filter of MH-PQ-10 #4: view phone, export, delete. */
export const AUDIT_DEFAULT_GROUPS: AuditGroup[] = ["truy_cap", "xuat", "xoa"];

/** Vietnamese label of the actions people look for; unknown actions show as written. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "phone.reveal": "Xem SĐT",
  "conversation.view": "Xem hội thoại (kiểm soát)",
  "conversation.reply": "Trả lời thay",
  "customer.view": "Mở hồ sơ khách",
  "export.create": "Xuất file",
  "audit.export": "Xuất nhật ký",
  "audit.view_person": "Tra nhật ký của một người",
  "mcp.call": "Gọi MCP",
  login: "Đăng nhập",
  login_denied: "Đăng nhập bị từ chối",
  "role.assign": "Gán vai trò",
  "role.remove": "Gỡ vai trò",
  "role.request": "Yêu cầu đổi vai trò",
  "role.approve": "Duyệt đổi vai trò",
  "role.reject": "Từ chối đổi vai trò",
  "grant.request": "Xin quyền tạm thời",
  "grant.request_on_behalf": "Tạo hộ yêu cầu quyền tạm thời",
  "permission.explain": "Tra quyền hiệu lực",
  "user.pre_leave": "Đặt cờ Sắp nghỉ",
  "user.pre_leave_clear": "Bỏ cờ Sắp nghỉ",
  "user.lock": "Khóa tài khoản",
  "user.unlock": "Mở khóa tài khoản",
  "user.offboard": "Cho nghỉ việc",
  "user.handover": "Bàn giao khách và nick",
  "channel.safety_confirm": "Xác nhận nick đã đăng xuất",
  "user.create": "Tạo người dùng",
  "user.update": "Sửa người dùng",
  // Written before 04/10/2026 (M1b-17): same event as user.update with detail.change = unit.
  "user.change_unit": "Sửa người dùng (đổi đơn vị)",
  "alert.handle": "Xử lý cảnh báo",
  "alert.config": "Sửa quy tắc cảnh báo",
  "alert.propose": "Đề xuất sửa quy tắc",
  "outbox.create": "Tạo lệnh gửi",
  "outbox.sent": "Gửi tin",
};

export type AuditActorType = "user" | "ai" | "device" | "system";
export const AUDIT_ACTOR_LABELS: Record<AuditActorType, string> = { user: "Người", ai: "AI", device: "Thiết bị", system: "Hệ thống" };

/**
 * Actor strings are written in three shapes today: `user:<id>`, a bare user id (login, role changes),
 * `token:<name>` and `system`. The caller tells bare ids from names with the set of known user ids.
 */
export function parseActor(actor: string, action: string, knownUser?: (id: string) => boolean): { type: AuditActorType; id: string } {
  if (actor === "system") return { type: "system", id: "system" };
  if (actor.startsWith("token:")) return { type: action.startsWith("mcp.") ? "ai" : "device", id: actor.slice(6) };
  if (actor.startsWith("user:")) return { type: "user", id: actor.slice(5) };
  if (knownUser?.(actor)) return { type: "user", id: actor };
  return { type: "user", id: actor };
}

/** Longest range the log may be read for at once (MH-PQ-10 #1). */
export const AUDIT_MAX_DAYS = 92;
export const AUDIT_EXPORT_MAX_ROWS = 50000;

export interface AuditRow {
  id: string;
  at: string;
  actorType: AuditActorType;
  actorId: string;
  actorName: string;
  action: string;
  actionLabel: string;
  group: AuditGroup;
  target: string;
  /** Name when the target is a user, else the code. */
  targetLabel: string;
  /** Sanitised: ids, counts, reasons; never message text or a full phone. */
  detail?: Record<string, unknown>;
  /** Client address: sent only to Admin / kiểm toán (audit.view over the whole tenant), absent for everybody else. */
  ip?: string;
}

export interface AuditPage {
  items: AuditRow[];
  total: number;
}

export const auditQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  actor: z.string().max(100).optional(),
  actorType: z.enum(["user", "ai", "device", "system"]).optional(),
  groups: z.string().max(200).optional(),
  action: z.string().max(100).optional(),
  target: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

/** One line of "Hoạt động của tôi" (own actions, plus who looked at my log). */
export interface ActivityRow {
  at: string;
  text: string;
  action: string;
}

// ---------------------------------------------------------------- alerts

export const ALERT_STATUSES = ["moi", "da_xem", "da_xu_ly"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];
export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = { moi: "Mới", da_xem: "Đã xem", da_xu_ly: "Đã xử lý" };

export type AlertRecipientRole = "giam_sat_bh" | "giam_doc_bh" | "quan_sat" | "admin";

/** Rule kinds the evaluator knows; others stay listed but off until the data they need exists. */
export interface AlertRuleDef {
  code: string;
  name: string;
  /** Hours counted in `windowMin`; for day rules `dayThreshold` is the second limit. */
  windowMin: number;
  threshold: number;
  dayThreshold?: number;
  /** Threshold for supervisors and directors (R1). */
  leadThreshold?: number;
  leadDayThreshold?: number;
  /** R2: also needs this many different profiles in a day. */
  minDistinct?: number;
  /** R2: times the person's own 30-day average. */
  factor?: number;
  roles: string;
  recipients: AlertRecipientRole[];
  /** R4, R6, R11 notify at once; the others are grouped hourly. */
  immediate: boolean;
  /** False while the data it reads is not recorded yet (R6 IP, R7 flag, R10/R11 device tokens). */
  ready: boolean;
  /** Why it is not ready. */
  waitingFor?: string;
}

export const DEFAULT_ALERT_RULES: AlertRuleDef[] = [
  { code: "R1", name: "Hiện SĐT", windowMin: 60, threshold: 20, dayThreshold: 60, leadThreshold: 40, leadDayThreshold: 120, roles: "Mọi vai trò", recipients: ["giam_doc_bh", "quan_sat"], immediate: false, ready: true },
  { code: "R2", name: "Mở hồ sơ / 360", windowMin: 1440, threshold: 3, minDistinct: 40, factor: 3, roles: "Mọi vai trò", recipients: ["giam_sat_bh", "giam_doc_bh", "quan_sat"], immediate: false, ready: true },
  { code: "R3", name: "Xuất file", windowMin: 1440, threshold: 500, roles: "Mọi vai trò", recipients: ["giam_doc_bh", "quan_sat"], immediate: false, ready: true },
  { code: "R4", name: "AI qua MCP", windowMin: 60, threshold: 200, dayThreshold: 300, roles: "Mọi vai trò", recipients: ["giam_doc_bh", "quan_sat", "admin"], immediate: true, ready: true },
  { code: "R5", name: "Truy cập ngoài giờ (22:00–06:00 hoặc Chủ nhật)", windowMin: 1440, threshold: 1, roles: "Mọi vai trò", recipients: ["giam_sat_bh", "giam_doc_bh"], immediate: false, ready: true },
  { code: "R6", name: "Địa chỉ lạ", windowMin: 43200, threshold: 1, roles: "Mọi vai trò", recipients: ["giam_sat_bh", "admin"], immediate: true, ready: true },
  { code: "R7", name: "Người có cờ Sắp nghỉ", windowMin: 60, threshold: 0.25, roles: "Mọi vai trò", recipients: ["giam_sat_bh", "giam_doc_bh", "quan_sat"], immediate: false, ready: true },
  { code: "R8", name: "Xin quyền tạm thời", windowMin: 10080, threshold: 3, roles: "Mọi vai trò", recipients: ["giam_doc_bh", "quan_sat"], immediate: false, ready: true },
  { code: "R9", name: "Xem ngoài phạm vi thường", windowMin: 1440, threshold: 50, roles: "Người xem qua quyền tạm thời và Quan sát", recipients: ["quan_sat"], immediate: false, ready: true },
  { code: "R10", name: "Thiết bị im lặng", windowMin: 30, threshold: 30, roles: "Token thiết bị", recipients: ["admin"], immediate: false, ready: false, waitingFor: "token thiết bị theo nick (M1b-06)" },
  { code: "R11", name: "Nick gửi từ thiết bị khác sau khi khóa", windowMin: 0, threshold: 1, roles: "Nick bị khóa", recipients: ["giam_doc_bh", "admin", "quan_sat"], immediate: true, ready: false, waitingFor: "bàn giao nick (M1b-11)" },
];

export interface AlertRuleView extends AlertRuleDef {
  enabled: boolean;
  updatedAt?: string;
}

export interface AlertView {
  id: string;
  at: string;
  rule: string;
  ruleName: string;
  personId: string;
  personName: string;
  /** Counts, times, reasons only (docs 01 MH-PQ-14 #1): no message text, no phone. */
  detail: Record<string, unknown>;
  summary: string;
  status: AlertStatus;
  handledBy?: string;
  note?: string;
}

export const alertHandleSchema = z.object({ note: z.string().trim().min(10, "Ghi chú 10–500 ký tự").max(500, "Ghi chú 10–500 ký tự") });

export const alertRulePatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    threshold: z.number().positive().optional(),
    dayThreshold: z.number().positive().optional(),
    leadThreshold: z.number().positive().optional(),
    leadDayThreshold: z.number().positive().optional(),
    windowMin: z.number().int().positive().optional(),
    recipients: z.array(z.enum(["giam_sat_bh", "giam_doc_bh", "quan_sat", "admin"])).min(1, "Cần ít nhất 1 người nhận").optional(),
  })
  .strict();
export type AlertRulePatch = z.infer<typeof alertRulePatchSchema>;

export const alertRuleProposalSchema = z.object({ reason: z.string().trim().min(10).max(500), proposal: alertRulePatchSchema });
