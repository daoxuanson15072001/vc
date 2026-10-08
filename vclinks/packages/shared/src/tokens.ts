import { z } from 'zod';

/*
 * Tokens and channel assignment (M1b-06; docs 01 §2.5, §2.7, MH-PQ-06 / 08 / 09).
 * A token string is shown once at creation and only its sha256 is stored: nothing here carries a token
 * value except the one-off `secret` field of a create response.
 */

/** Kinds of API tokens (01 §2.7). `legacy` = created before M1b-06 (scripts, tests): no binding. */
export const TOKEN_KINDS = ['device', 'mcp_user', 'sync', 'agent', 'legacy'] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];

export const TOKEN_KIND_LABELS: Record<TokenKind, string> = {
  device: 'Thiết bị',
  mcp_user: 'MCP cá nhân',
  sync: 'MCP đồng bộ',
  agent: 'Tác tử gửi',
  legacy: 'Token cũ (chưa gắn nick)',
};

/** Tool groups of a personal MCP token ("Đề xuất" needs conv.reply / invoice_req.create / cust.merge). */
export const MCP_GROUPS = ['doc', 'de_xuat'] as const;
export type McpGroup = (typeof MCP_GROUPS)[number];
export const MCP_GROUP_LABELS: Record<McpGroup, string> = { doc: 'Đọc', de_xuat: 'Đề xuất' };

export const TOKEN_EXPIRY_DAYS = [30, 60, 90] as const;
/** At most this many live personal MCP tokens per person (MH-PQ-09). */
export const MAX_OWN_MCP_TOKENS = 3;

export const REVOKE_REASONS = ['het_dung', 'nghi_lo', 'nghi_viec', 'thay_may'] as const;
export type RevokeReason = (typeof REVOKE_REASONS)[number];
export const REVOKE_REASON_LABELS: Record<RevokeReason, string> = {
  het_dung: 'Hết dùng',
  nghi_lo: 'Nghi lộ',
  nghi_viec: 'Nghỉ việc',
  thay_may: 'Thay máy',
};

/** Texts of the API / UI (MH-PQ-08, MH-PQ-09, PQ-US-14). */
export const TOKEN_TEXT = {
  deviceNotAssigned: 'Thiết bị không được gán nick này',
  pairingBad: 'Mã ghép không đúng hoặc đã hết hạn (10 phút).',
  noAdminMcp: 'Token MCP cá nhân chỉ chính chủ tạo được. Quản trị viên không tạo hộ.',
  selfMcpOff: 'Tự tạo token chưa được bật cho vị trí của bạn. Liên hệ quản trị viên.',
  preLeaveNoPropose: 'Bạn đang có cờ Sắp nghỉ: token MCP chỉ còn nhóm "Đọc".',
  tooMany: `Mỗi người tối đa ${MAX_OWN_MCP_TOKENS} token. Thu hồi token cũ trước.`,
  showOnce: 'Sao chép token ngay. VClinks không lưu và không hiện lại token này.',
} as const;

export const createSystemTokenSchema = z
  .object({
    kind: z.enum(['sync', 'agent']),
    name: z.string().trim().min(3).max(60),
    uids: z.array(z.string().min(1).max(100)).min(1).max(50),
    days: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(90),
  })
  .strict();
export type CreateSystemToken = z.infer<typeof createSystemTokenSchema>;

export const createOwnTokenSchema = z
  .object({
    name: z.string().trim().min(3).max(60),
    groups: z.array(z.enum(MCP_GROUPS)).default(['doc']),
    days: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(30),
  })
  .strict();
export type CreateOwnToken = z.infer<typeof createOwnTokenSchema>;

export const revokeTokenSchema = z.object({ reason: z.enum(REVOKE_REASONS) }).strict();

export const approvePairingSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, 'Mã ghép gồm 6 chữ số'),
    deviceName: z.string().trim().min(1).max(80).optional(),
    /** Nicks the device may push (personal channels). Required for new pairings from the Dashboard. */
    uids: z.array(z.string().min(1).max(100)).max(50).default([]),
    holderUserId: z.string().max(100).optional(),
    shared: z.boolean().optional(),
    /** Token id of the old machine; revoked at once ("Thay máy cũ"). */
    replaceTokenId: z.string().max(64).optional(),
  })
  .strict();
export type ApprovePairing = z.infer<typeof approvePairingSchema>;

/** One row of the token tables (never a hash or a token). */
export interface TokenRow {
  id: string;
  name: string;
  kind: TokenKind;
  ownerUserId: string | null;
  ownerName: string | null;
  deviceName: string | null;
  uids: string[];
  groups: McpGroup[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastIp: string | null;
  revokedAt: string | null;
  revokedReason: RevokeReason | null;
  revokedBy: string | null;
  /** Calls in the last 7 days (personal MCP tokens). */
  calls7d?: number;
}

/** `GET /api/admin/tokens/:id/impact`: the "Phạm vi ảnh hưởng" drawer (PQ-47, UAT-PQ-72). No token, no message content. */
export interface TokenImpact {
  tokenId: string;
  name: string;
  ownerName: string | null;
  /** Number of AI calls recorded for this token. */
  calls: number;
  /** Distinct conversation / customer ids returned (capped at 100; `conversationCount` is the true count). */
  conversations: string[];
  conversationCount: number;
  ips: { ip: string; calls: number; lastAt: string }[];
  /** The 20 latest calls. */
  recent: { at: string; tool: string; returned: number; ip: string | null }[];
}

export interface TokenSettings {
  /** Division unit ids and role keys allowed to create their own MCP token (empty = nobody, NT2). */
  allowSelfMcpToken: { divisions: string[]; roles: string[] };
}

export const tokenSettingsSchema = z
  .object({ divisions: z.array(z.string().max(100)).max(100), roles: z.array(z.string().max(60)).max(60) })
  .strict();

/** Channel assignment (`channel_access`, 01 §2.5). */
export const CHANNEL_ACCESS_LEVELS_ASSIGNABLE = ['giu_nick', 'gui', 'xem', 'lead'] as const;

export const channelAccessInputSchema = z
  .object({
    principalType: z.enum(['user', 'org_unit']),
    principalId: z.string().min(1).max(100),
    level: z.enum(CHANNEL_ACCESS_LEVELS_ASSIGNABLE),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).nullable().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export type ChannelAccessInput = z.infer<typeof channelAccessInputSchema>;

export interface ChannelAccessRow {
  id: string;
  principalType: 'user' | 'org_unit';
  principalId: string;
  principalName: string;
  level: (typeof CHANNEL_ACCESS_LEVELS_ASSIGNABLE)[number];
  from: string | null;
  to: string | null;
  note: string | null;
}

export interface ChannelAssignRow {
  uid: string;
  label: string;
  channel: string;
  divisionId: string | null;
  holderUserId: string | null;
  holderName: string | null;
  unsafe: boolean;
  access: ChannelAccessRow[];
}

export interface PendingNickRow {
  uid: string;
  label: string;
  channel: string;
  deviceName: string | null;
  registeredAt: string;
  records: number;
}

export const CHANNEL_ACCESS_LEVEL_LABELS: Record<(typeof CHANNEL_ACCESS_LEVELS_ASSIGNABLE)[number], string> = {
  giu_nick: 'Người giữ nick',
  gui: 'Trực & gửi',
  xem: 'Chỉ xem',
  lead: 'Lead',
};
