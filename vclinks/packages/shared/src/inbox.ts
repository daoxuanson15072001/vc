import { z } from 'zod';
import type { ConversationLabel } from './conversation-work';

/*
 * Inbox by scope, owner, "chưa trả lời" and SLA (M1b-09; docs 00 §3.3a, §3.4, 03 SZ-21).
 * Pure functions: the API stores `unansweredSince` / `slaDueAt` on the conversation, the web redraws the
 * chip every 30 s with the same `slaChip`. All wall-clock maths is Asia/Ho_Chi_Minh (UTC+7, no DST).
 */

export const INBOX_TZ = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MIN = 7 * 60;
const MIN_MS = 60_000;

/** "Của tôi / Chưa phân công / Tất cả" (MH-SZ-01 #4). */
export const INBOX_SCOPES = ['mine', 'unassigned', 'all'] as const;
export type InboxScope = (typeof INBOX_SCOPES)[number];

export const INBOX_SCOPE_LABELS: Record<InboxScope, string> = {
  mine: 'Của tôi',
  unassigned: 'Chưa phân công',
  all: 'Tất cả',
};

const flag = z
  .enum(['0', '1', 'true', 'false'])
  .transform((v) => v === '1' || v === 'true');

/**
 * Work state tabs besides "Cần trả lời" (plan B2, design "Hộp thư"): `waiting` = "Chờ khách" (nothing waits for
 * us and the conversation is not closed), `done` = "Đã xong" (closed with "Xong").
 */
export const INBOX_STATES = ['waiting', 'done'] as const;
export type InboxState = (typeof INBOX_STATES)[number];

/** One-tap outcome when closing a conversation with "Xong" (plan B2). */
export const CONVERSATION_OUTCOMES = ['hoi_gia', 'dat_hang', 'khieu_nai', 'khong_can', 'khac'] as const;
export type ConversationOutcome = (typeof CONVERSATION_OUTCOMES)[number];
export const CONVERSATION_OUTCOME_LABELS: Record<ConversationOutcome, string> = {
  hoi_gia: 'Hỏi giá',
  dat_hang: 'Đặt hàng',
  khieu_nai: 'Khiếu nại',
  khong_can: 'Không cần',
  khac: 'Khác',
};

/** Body of `POST /api/conversations/:id/done`. */
export const conversationDoneSchema = z.object({ outcome: z.enum(CONVERSATION_OUTCOMES).optional() }).strict();

/** Query of `GET /api/conversations` added by the inbox (the existing keys stay in the controller). */
export const inboxQuerySchema = z.object({
  scope: z.enum(INBOX_SCOPES).optional(),
  /** Only conversations waiting for a reply (SZ-21). */
  unanswered: flag.optional(),
  /** Supervisor filter "Quá SLA". */
  overSla: flag.optional(),
  /** Supervisor filter "Người phụ trách": user id of the owner. */
  ownerId: z.string().trim().min(1).max(128).optional(),
  pinned: flag.optional(),
  /** Zalo label id ("thẻ"). */
  labelId: z.string().trim().min(1).max(128).optional(),
  /** VClinks label (conversation-work.ts), not a Zalo one. */
  vcLabelId: z.string().trim().min(1).max(40).optional(),
  /** `wait` = waiting longest first (default while `unanswered`), `recent` = newest first. */
  sort: z.enum(['recent', 'wait']).optional(),
  /** "Chờ khách" / "Đã xong" tabs (plan B2). */
  state: z.enum(INBOX_STATES).optional(),
});
export type InboxQuery = z.infer<typeof inboxQuerySchema>;

/* ---------- work calendar of a division ---------- */

/** `HH:mm` pairs of one working day, e.g. `[['08:00','12:00'],['13:30','17:30']]` (lunch break = the gap). */
export type DayWindows = [string, string][];

export interface WorkCalendar {
  /** Keys `0`..`6` (0 = Sunday) as in Date.getUTCDay of the VN local date. Missing = day off. */
  weekdays: Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', DayWindows>>;
  /** Public holidays `yyyy-mm-dd` (VN local date): no working time. */
  holidays: string[];
}

export interface SlaConfig {
  /** First-response SLA in working minutes (03 GS-01: 15). */
  slaMinutes: number;
  /** "Sắp quá" when the remaining part is at most this share of the SLA (00 §3.4: 0.25). */
  warnRatio: number;
  calendar: WorkCalendar;
  /** Display name of the division, for the tooltip. */
  divisionName?: string;
}

const WORKDAY: DayWindows = [['08:00', '12:00'], ['13:30', '17:30']];

/** Built-in calendar until the division sets its own (collection `sla_settings`): Mon-Fri, Saturday morning. */
export const DEFAULT_SLA_CONFIG: SlaConfig = {
  slaMinutes: 15,
  warnRatio: 0.25,
  calendar: { weekdays: { '1': WORKDAY, '2': WORKDAY, '3': WORKDAY, '4': WORKDAY, '5': WORKDAY, '6': [['08:00', '12:00']] }, holidays: [] },
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Wall-clock parts of an instant in Asia/Ho_Chi_Minh. */
export function vnParts(ms: number): { dayStartMs: number; minuteOfDay: number; weekday: number; ymd: string } {
  const local = ms + VN_OFFSET_MIN * MIN_MS;
  const d = new Date(local);
  const dayStartLocal = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return {
    dayStartMs: dayStartLocal - VN_OFFSET_MIN * MIN_MS,
    minuteOfDay: Math.floor((local - dayStartLocal) / MIN_MS),
    weekday: d.getUTCDay(),
    ymd: d.toISOString().slice(0, 10),
  };
}

/** Working intervals `[startMs, endMs)` of the VN day that contains `dayStartMs`. */
function windowsOfDay(cal: WorkCalendar, dayStartMs: number): [number, number][] {
  const p = vnParts(dayStartMs + 12 * 3600_000);
  if (cal.holidays.includes(p.ymd)) return [];
  const key = String(p.weekday) as keyof WorkCalendar['weekdays'];
  return (cal.weekdays[key] ?? []).map(([a, b]) => [dayStartMs + toMin(a) * MIN_MS, dayStartMs + toMin(b) * MIN_MS] as [number, number]);
}

const DAY_MS = 24 * 3600_000;
const MAX_DAYS = 400;

/** The instant `minutes` working minutes after `fromMs` (SLA deadline). A message outside hours starts at the next opening. */
export function addWorkingMinutes(fromMs: number, minutes: number, cal: WorkCalendar): number {
  let left = minutes;
  let day = vnParts(fromMs).dayStartMs;
  for (let i = 0; i < MAX_DAYS; i++, day += DAY_MS) {
    for (const [s, e] of windowsOfDay(cal, day)) {
      const start = Math.max(s, fromMs);
      if (start >= e) continue;
      const room = (e - start) / MIN_MS;
      if (left <= room) return start + left * MIN_MS;
      left -= room;
    }
  }
  // No working time at all in the calendar: fall back to wall-clock minutes rather than never expiring.
  return fromMs + minutes * MIN_MS;
}

/** Working minutes between two instants (0 when `toMs <= fromMs`). */
export function workingMinutesBetween(fromMs: number, toMs: number, cal: WorkCalendar): number {
  if (toMs <= fromMs) return 0;
  let total = 0;
  let day = vnParts(fromMs).dayStartMs;
  for (let i = 0; i < MAX_DAYS && day < toMs; i++, day += DAY_MS) {
    for (const [s, e] of windowsOfDay(cal, day)) {
      const a = Math.max(s, fromMs);
      const b = Math.min(e, toMs);
      if (b > a) total += (b - a) / MIN_MS;
    }
  }
  return total;
}

/** Start of the next working window at or after `ms` (null when the calendar has none). */
export function nextWorkingStart(ms: number, cal: WorkCalendar): number | null {
  let day = vnParts(ms).dayStartMs;
  for (let i = 0; i < MAX_DAYS; i++, day += DAY_MS) {
    for (const [s, e] of windowsOfDay(cal, day)) if (e > ms) return Math.max(s, ms);
  }
  return null;
}

export const isWorkingTime = (ms: number, cal: WorkCalendar): boolean => nextWorkingStart(ms, cal) === ms;

/* ---------- unanswered state of one conversation (SZ-21) ---------- */

export interface ThreadMessageFact {
  /** Sent by the company nick (`fromUid` '0' / '-1' / the nick uid), whatever the channel path (SZ-21 a). */
  own: boolean;
  sentAt: number;
  /** System event, note or automatic message: not a reply and not a customer message. */
  ignore?: boolean;
}

/**
 * SZ-21 (b)-(d): "chưa trả lời" since the first customer message after the last message of the nick, or null.
 * Messages must be in any order; `sentAt` is the real send time (k), not the ingest time.
 */
export function unansweredSinceOf(messages: ThreadMessageFact[]): number | null {
  const real = messages.filter((m) => !m.ignore);
  const lastOwn = real.reduce((mx, m) => (m.own && m.sentAt > mx ? m.sentAt : mx), -Infinity);
  const waiting = real.filter((m) => !m.own && m.sentAt > lastOwn).map((m) => m.sentAt);
  return waiting.length ? Math.min(...waiting) : null;
}

/* ---------- SLA chip (00 §3.4, UI-TP-03 `short`) ---------- */

export type SlaLevel = 'ok' | 'warn' | 'over' | 'paused';

export interface SlaChip {
  level: SlaLevel;
  /** Deadline of the first response (ISO). */
  dueAt: string;
  slaMinutes: number;
  /** Working minutes left (`ok`, `warn`, `paused`). */
  remainingMin?: number;
  /** Minutes past the deadline (`over`). */
  overMin?: number;
  /** `paused`: when the clock runs again (ISO). */
  resumeAt?: string;
  /** Short chip text of the list (`⏰ 3′`, `Quá 5′`, `Quá 2g`, `Quá 3n`); undefined = no chip in the list. */
  text?: string;
  divisionName?: string;
}

/** `Quá {n}′` / `Quá {h}g` / `Quá {d}n` (00 §3.4 "Chip ngắn"). */
export function overText(overMin: number): string {
  if (overMin >= 24 * 60) return `Quá ${Math.floor(overMin / (24 * 60))}n`;
  if (overMin >= 60) return `Quá ${Math.floor(overMin / 60)}g`;
  return `Quá ${Math.max(1, Math.floor(overMin))}′`;
}

/** Chip of a conversation waiting since `dueAt - SLA`; null when nothing waits. Re-run every 30 s with a fresh `nowMs`. */
export function slaChip(input: { dueAtMs: number | null | undefined; config: SlaConfig; nowMs: number }): SlaChip | null {
  const { dueAtMs, config, nowMs } = input;
  if (dueAtMs == null) return null;
  const base = { dueAt: new Date(dueAtMs).toISOString(), slaMinutes: config.slaMinutes, ...(config.divisionName ? { divisionName: config.divisionName } : {}) };
  if (nowMs >= dueAtMs) {
    const overMin = Math.floor((nowMs - dueAtMs) / MIN_MS);
    return { ...base, level: 'over', overMin, text: overText(overMin) };
  }
  const remaining = workingMinutesBetween(nowMs, dueAtMs, config.calendar);
  if (!isWorkingTime(nowMs, config.calendar)) {
    const resume = nextWorkingStart(nowMs, config.calendar);
    return { ...base, level: 'paused', remainingMin: remaining, ...(resume ? { resumeAt: new Date(resume).toISOString() } : {}) };
  }
  if (remaining <= config.slaMinutes * config.warnRatio) {
    return { ...base, level: 'warn', remainingMin: remaining, text: `⏰ ${Math.max(1, Math.ceil(remaining))}′` };
  }
  return { ...base, level: 'ok', remainingMin: remaining };
}

/* ---------- API shapes ---------- */

/** Fields the inbox adds to a conversation list item. */
export interface ConversationInboxFields {
  /** User id of the owner: nick holder (personal channels) or assignee (official channels, customer owner later). */
  ownerId?: string | null;
  ownerName?: string | null;
  /** Waiting since this instant (ISO); absent when the last message is the nick's. */
  unansweredSince?: string | null;
  /** Deadline of the first response (ISO). */
  slaDueAt?: string | null;
  sla?: SlaChip | null;
  /**
   * Customer profile of a 1-1 conversation (opaque id, merged profiles followed): the inbox shows one row per
   * customer when he writes on several nicks / channels (plan B2, BR-M3: a display only, nothing is merged).
   */
  customerId?: string | null;
  /** Closed with "Xong" (plan B2); a new customer message reopens the conversation by itself. */
  done?: { at: string; byName: string | null; outcome: ConversationOutcome | null } | null;
  /** Handler set by claim / assign / transfer (null = none; the nick holder handles a personal nick). */
  assigneeId?: string | null;
  /** The channel has no nick holder: claim / assign / transfer apply (02 DK-21). */
  assignable?: boolean;
  /** VClinks labels of the conversation. */
  vcLabels?: ConversationLabel[];
}

/** `GET /api/conversations/inbox` (scopes and counters for the supervisor bar, MH-SZ-01 #4, #4b, #4c). */
export interface InboxSummary {
  /** Scopes the caller may use (NVKD: only `mine`). */
  scopes: InboxScope[];
  counts: { mine: number; unassigned: number; all: number };
  /** Unanswered / over SLA inside the caller's visible conversations. */
  unanswered: number;
  overSla: number;
  /** Unanswered per owner, largest first (only for callers who see more than their own). */
  byOwner: { userId: string | null; name: string | null; count: number }[];
}

/* ---------- "SLA và giờ làm việc" (Quản trị, key config.sla) ---------- */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const dayWindowsSchema = z
  .array(
    z
      .tuple([z.string().regex(HHMM, 'Giờ dạng HH:mm'), z.string().regex(HHMM, 'Giờ dạng HH:mm')])
      .refine(([a, b]) => a < b, 'Giờ kết thúc phải sau giờ bắt đầu'),
  )
  .max(4);

/** Settings a sales director saves for their division (collection `sla_settings`). */
export const slaSettingsInputSchema = z
  .object({
    slaMinutes: z.number().int().min(1).max(480),
    warnRatio: z.number().min(0.05).max(0.9),
    calendar: z
      .object({
        weekdays: z
          .object({
            '0': dayWindowsSchema.optional(),
            '1': dayWindowsSchema.optional(),
            '2': dayWindowsSchema.optional(),
            '3': dayWindowsSchema.optional(),
            '4': dayWindowsSchema.optional(),
            '5': dayWindowsSchema.optional(),
            '6': dayWindowsSchema.optional(),
          })
          .strict(),
        holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày lễ dạng yyyy-mm-dd')).max(60),
      })
      .strict(),
  })
  .strict();
export type SlaSettingsInput = z.output<typeof slaSettingsInputSchema>;

export interface SlaSettingsRow {
  divisionId: string;
  divisionName: string;
  /** True when the division saved its own settings; false = it follows the default. */
  own: boolean;
  /** Settings in force for the division. */
  config: SlaConfig;
  /** The viewer may change them (config.sla in full on this division). */
  canEdit: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface SlaSettingsList {
  /** Company default (collection doc `default`, else the built-in calendar). */
  default: SlaConfig;
  defaultIsBuiltIn: boolean;
  divisions: SlaSettingsRow[];
}

/** Weekday labels, Monday first, for the settings screen. */
export const WEEKDAY_LABELS: [keyof WorkCalendar['weekdays'], string][] = [
  ['1', 'Thứ 2'],
  ['2', 'Thứ 3'],
  ['3', 'Thứ 4'],
  ['4', 'Thứ 5'],
  ['5', 'Thứ 6'],
  ['6', 'Thứ 7'],
  ['0', 'Chủ nhật'],
];
