import { z } from 'zod';

/*
 * AI reply drafts (M1c-06, BA F7.3, KD-10, CLAUDE.md §8).
 * A draft is only ever text shown under the composer: "Dùng nháp" puts it in the input box and the user
 * presses "Gửi" like any message (approvedBy / approvedAt = that user, §12.1, BR07). Drafts live in their
 * own collection `ai_drafts`, never in the outbox collection, so no draft can be claimed or sent.
 */

/** Risky requests in the customer's messages: flagged, never drafted (CLAUDE.md §8, SZ-19). */
export const AI_RISK_FLAGS = ['chuyen_tien', 'otp', 'mat_khau', 'doi_tai_khoan'] as const;
export type AiRiskFlag = (typeof AI_RISK_FLAGS)[number];

export const AI_RISK_LABELS: Record<AiRiskFlag, string> = {
  chuyen_tien: 'chuyển tiền',
  otp: 'OTP',
  mat_khau: 'mật khẩu',
  doi_tai_khoan: 'đổi số tài khoản',
};

/** Handling per contact role (config/playbook.yaml). */
export const AI_DRAFT_ACTIONS = ['draft', 'summary_only', 'ignore'] as const;
export type AiDraftAction = (typeof AI_DRAFT_ACTIONS)[number];

/**
 * - pending: draft shown, not decided yet · approved: sent unchanged · edited: sent after editing
 * - rejected: "Bỏ" · risk: risky request, no draft · blocked: C3 gate or output guard refused, no draft
 * - summary: summary only (role summary_only) · ignored: role ignore · failed: AI error
 */
export const AI_DRAFT_STATUSES = ['pending', 'approved', 'edited', 'rejected', 'risk', 'blocked', 'summary', 'ignored', 'failed'] as const;
export type AiDraftStatus = (typeof AI_DRAFT_STATUSES)[number];

export interface AiDraftSource {
  type: 'vcwiki' | 'vcsale' | 'history' | 'profile';
  /** Card title, "Giá, tồn VCsales", "30 tin gần nhất"... Never message content. */
  label: string;
  /** When the data was read (VCsales "kèm giờ lấy"). */
  at?: string;
}

export interface AiDraftView {
  id: string;
  conversationId: string;
  status: AiDraftStatus;
  action: AiDraftAction;
  /** Draft text (pending / approved / edited / rejected); null when there is none. */
  draft: string | null;
  /** Summary (summary_only roles). */
  summary: string | null;
  riskFlags: AiRiskFlag[];
  /** Why there is no draft (blocked / failed / ignored), in Vietnamese for the UI. */
  reason: string | null;
  sources: AiDraftSource[];
  /** `mock` until the Claude API key (E8) is configured. */
  mode: 'mock' | 'live';
  model: string;
  requestedBy: string;
  createdAt: string;
  decidedAt: string | null;
}

export const aiDraftSentSchema = z.object({
  /** Outbox item the user created by pressing "Gửi" after "Dùng nháp". */
  outboxId: z.string().min(1).max(64),
});

export const aiDraftRejectSchema = z.object({
  reason: z.string().max(200).optional(),
});

export interface AiDraftMetrics {
  /** Drafts decided by the user (sent unchanged, sent edited, dropped). */
  approved: number;
  edited: number;
  rejected: number;
  /** approved / (approved + edited + rejected); null when nothing decided yet. */
  approvedUneditedRate: number | null;
  risk: number;
  blocked: number;
}

/** UI text of the risk warning shown instead of a draft (00 MH-UI composer #3a). */
export function aiRiskWarning(flags: readonly AiRiskFlag[]): string {
  const what = flags.map((f) => AI_RISK_LABELS[f]).join(' / ');
  return `Tin của khách có yêu cầu nhạy cảm (${what}). AI không soạn nháp. Hãy kiểm tra kỹ và hỏi cấp trên nếu cần.`;
}
