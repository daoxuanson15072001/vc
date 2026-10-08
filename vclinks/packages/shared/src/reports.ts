import { z } from 'zod';
import { KPI_DAY, type KpiSummary } from './kpi';

/*
 * Basic reports (M1c-09, docs 07 MH-BC-01, 02, 03, 06). Shapes of `GET /api/reports/*`. Numbers come from the
 * `kpi_daily` job of M1b-15 (counts and waiting minutes only): never message text, never a phone number (BC-18).
 */

const dayField = z.string().regex(KPI_DAY, 'Ngày dạng yyyy-mm-dd');

export const reportQuerySchema = z.object({
  from: dayField.optional(),
  to: dayField.optional(),
  /** Org unit id of a team; ignored when it is not one of the caller's teams (UAT-BC-08). */
  team: z.string().max(120).optional(),
  /** Add the figures of the previous period of the same length (BC-13). */
  compare: z.enum(['0', '1']).optional(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const reportTurnsQuerySchema = reportQuerySchema.extend({
  /** Row key of the performance table (see ReportRow.key). */
  row: z.string().max(200).optional(),
  /** Only turns past their SLA (Drawer "Lượt quá SLA"). */
  breachedOnly: z.enum(['0', '1']).optional(),
});
export type ReportTurnsQuery = z.infer<typeof reportTurnsQuerySchema>;

export const reportExportQuerySchema = reportQuerySchema.extend({
  /** "Kèm danh sách chi tiết" (BC-19 b): adds the sheet of reply turns. */
  detail: z.enum(['0', '1']).optional(),
});
export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;

/** Longest period one report request may cover (the daily job keeps this many days readable at once). */
export const REPORT_MAX_DAYS = 120;
/** Most turns one list or one export sheet returns; above it the export needs approval (BC-19 b, not built yet). */
export const REPORT_TURN_LIMIT = 500;

/**
 * `self`: a salesperson, only his own nicks plus the team average (BC-12).
 * `nvkd`: a supervisor / director, one row per salesperson of his teams.
 * `team`: management (XEM), one row per team, never a person (BC-12).
 */
export type ReportMode = 'self' | 'nvkd' | 'team';

export interface ReportRow extends KpiSummary {
  /** Stable key: `user:<id>`, `team:<id>`, `channel:<uid>`. */
  key: string;
  kind: 'nvkd' | 'team' | 'channel';
  label: string;
  /** Team name of a salesperson row. */
  teamName?: string | null;
  /** Nicks behind the row. */
  accounts: number;
  self?: boolean;
  /** Same figures for the previous period (compare=1); null when nothing was recorded then. */
  prev?: KpiSummary | null;
}

export interface ReportTeamAverage {
  teamName: string | null;
  /** Salespeople with at least one nick in the team. */
  members: number;
  /** Turns per salesperson (UAT-BC-07 "Tổ TB"). */
  turnsPerMember: number | null;
  summary: KpiSummary;
}

export interface ReportOverview {
  from: string;
  to: string;
  prevFrom: string | null;
  prevTo: string | null;
  mode: ReportMode;
  totals: KpiSummary;
  prevTotals: KpiSummary | null;
  rows: ReportRow[];
  /** Only in `self` mode: team figures without a name or a rank. */
  team: ReportTeamAverage | null;
  /** Teams the caller may pick (empty for `self`). */
  teams: { id: string; name: string }[];
  appliedTeam: string | null;
  /** "Xuất Excel" button: report.export. */
  canExport: boolean;
  /** Nicks counted in the figures. */
  accountsCounted: number;
  computedAt: string | null;
}

export interface ReportTurn {
  uid: string;
  accountLabel: string;
  channel: string;
  threadId: string;
  /** Customer display name; digit runs that look like a phone number are masked. */
  customerName: string;
  holderName: string | null;
  startAt: string;
  endAt: string | null;
  waitMin: number;
  slaMin: number;
  breached: boolean;
  result: 'answered' | 'open';
  source: 'vclinks' | 'phone' | null;
}

export interface ReportTurnList {
  rows: ReportTurn[];
  truncated: boolean;
}

/** Digit runs that look like a phone number, and e-mail addresses, never reach a report or a file. */
export const maskDigits = (s: string): string =>
  s.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '***').replace(/\+?\d[\d\s.-]{6,}\d/g, '***');

export const REPORT_DEFINITIONS: { code: string; label: string; text: string }[] = [
  { code: 'KPI-04', label: 'Lượt chờ', text: 'Số lượt chờ bắt đầu trong kỳ: đã trả lời, đang chờ. Một lượt bắt đầu ở tin khách đầu tiên sau tin cuối của nick và kết thúc ở tin kế tiếp của nick (giờ gửi thật).' },
  { code: 'KPI-05', label: 'Thời gian phản hồi (FRT)', text: 'Trung vị thời gian chờ (phút giờ làm việc) của các lượt đã trả lời, kèm P90. Số của tổ là trung vị của mọi lượt, không phải trung bình của trung vị (BC-14).' },
  { code: 'KPI-06', label: '% quá SLA', text: 'Số lượt chờ lâu hơn hạn SLA (kể cả lượt đang chờ đã quá hạn) trên tổng số lượt.' },
  { code: 'KPI-10', label: '% trả lời qua VClinks', text: 'Lượt kết thúc bằng tin gửi từ VClinks trên số lượt đã trả lời; phần còn lại là tin gửi từ điện thoại. Chỉ để theo dõi, không trừ điểm (BC-06).' },
  { code: 'BC-07', label: 'Loại trừ', text: 'Chưa tính nhóm Zalo (chờ QĐ-50). Các loại trừ khác (nhân viên nội bộ, gia đình bạn bè) sẽ vào cùng bộ lọc khi có dữ liệu hồ sơ khách.' },
  { code: 'BC-12', label: 'Không xếp hạng', text: 'Bảng theo từng nhân viên chỉ có ở giám sát và giám đốc; nhân viên thấy số của mình và trung bình tổ, không tên, không thứ hạng.' },
  { code: 'BC-18', label: 'Không nội dung tin', text: 'Báo cáo và file chỉ có mã, tên hiển thị khách, kênh, thời điểm và số phút; không có nội dung tin, không có số điện thoại.' },
];
