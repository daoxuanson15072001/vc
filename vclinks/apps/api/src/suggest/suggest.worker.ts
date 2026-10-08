import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  C3_BLOCKED_TEXT,
  CONTACT_ROLES,
  ERASED_TEXT,
  type AiDraftAction,
  type AiDraftSource,
  type AiDraftStatus,
  type AiRiskFlag,
  type ContactRole,
  type MessageView,
} from '@vclinks/shared';
import { ConversationsService } from '../conversations/conversations.service';
import { C, DbService } from '../db/db.service';
import { AiGateway, C3BlockedError } from '../security/ai-gateway';
import { GUARD_REASON_TEXT, guardDraft, type GuardReason } from './output-guard';
import { PART_LOOKUP, VCWIKI_CLIENT, partsText, type PartLookup, type VcwikiClient } from './knowledge';
import { actionFor, loadPlaybook, type Playbook } from './playbook';
import { buildFrame, trustedFacts, type FrameMessage, type FrameSale } from './prompt-frame';
import { detectRiskFlags } from './risk';

/*
 * Suggest worker (CLAUDE.md §8, BA F7.3, M1c-06). One job = one conversation:
 *   1. last 30 messages (opened through MessageVault, erased customers skipped)
 *   2. risk flags on the customer's pending messages → warning, NO draft, no AI call
 *   3. playbook action by role: ignore → nothing; summary_only → summary; draft → draft
 *   4. VCwiki cards + VCsales list price / stock (mocks until E5 / VCwiki endpoint)
 *   5. prompt frame (untrusted block) → AiGateway (gate() refuses C3) → Claude API or mock
 *   6. output guard; a refused answer is dropped
 * The worker only returns a result; it never writes to the outbox (no send path, §12.1).
 * No BullMQ in the repo yet: the API runs a job in-process when the user presses "Soạn nháp"; the job
 * function is self-contained so it can move behind a queue unchanged.
 */
export const HISTORY_LIMIT = 30;
const SELF_FROM = new Set(['0', '-1']);

export interface SuggestJob {
  conversationId: string;
  /** User who pressed "Soạn nháp" (audit). */
  actor: string;
}

export interface SuggestResult {
  status: Extract<AiDraftStatus, 'pending' | 'risk' | 'blocked' | 'summary' | 'ignored' | 'failed'>;
  action: AiDraftAction;
  draft: string | null;
  summary: string | null;
  riskFlags: AiRiskFlag[];
  reason: string | null;
  /** Output guard codes (never text). */
  guard: GuardReason[];
  sources: AiDraftSource[];
  mode: 'mock' | 'live';
  model: string;
  /** Last customer message the draft answers. */
  messageId: string | null;
}

const ROLE_LABEL: Record<ContactRole, string> = {
  khach_hang: 'khách hàng',
  dai_ly_gara: 'đại lý / gara',
  nha_cung_cap: 'nhà cung cấp',
  nhan_vien: 'nhân viên',
  quan_ly: 'quản lý',
  doi_tac: 'đối tác',
  ngan_hang: 'ngân hàng',
  co_quan_nha_nuoc: 'cơ quan nhà nước',
  gia_dinh_ban_be: 'gia đình, bạn bè',
  oa_doanh_nghiep: 'OA doanh nghiệp',
  khac: 'khác',
};

export const NO_CUSTOMER_TEXT = 'Chưa có tin chữ nào của khách trong 30 tin gần nhất để soạn nháp.';
export const IGNORE_TEXT = 'Theo playbook, hội thoại với vai trò này không soạn nháp AI.';
export const FAILED_TEXT = 'Chưa gọi được AI lúc này. Hãy tự soạn trả lời hoặc thử lại sau ít phút.';

@Injectable()
export class SuggestWorker {
  private readonly log = new Logger(SuggestWorker.name);

  constructor(
    private readonly db: DbService,
    private readonly conversations: ConversationsService,
    private readonly gateway: AiGateway,
    @Inject(VCWIKI_CLIENT) private readonly vcwiki: VcwikiClient,
    @Inject(PART_LOOKUP) private readonly parts: PartLookup,
  ) {}

  playbook(): Playbook {
    return loadPlaybook();
  }

  async run(job: SuggestJob): Promise<SuggestResult> {
    const { conversationId } = job;
    const sep = conversationId.indexOf(':');
    const uid = conversationId.slice(0, sep);
    const conv = await this.db.col<{ _id: string; type?: string }>(C.conversations).findOne({ _id: conversationId }, { projection: { type: 1 } });
    const threadId = conversationId.slice(sep + 1);
    const isGroup = conv?.type === 'group' || threadId.startsWith('g');
    const contact = isGroup
      ? null
      : await this.db.col<{ _id: string; role?: string }>(C.contacts).findOne({ _id: conversationId }, { projection: { role: 1 } });
    const role = (CONTACT_ROLES as readonly string[]).includes(contact?.role ?? '') ? (contact!.role as ContactRole) : null;

    const { items } = await this.conversations.messages(conversationId, undefined, HISTORY_LIMIT);
    const messages = toFrameMessages(items, uid);
    const pending = pendingInbound(messages);
    const base: Omit<SuggestResult, 'status' | 'action'> = {
      draft: null,
      summary: null,
      riskFlags: [],
      reason: null,
      guard: [],
      sources: [],
      mode: 'mock',
      model: '',
      messageId: pending.at(-1)?.id ?? null,
    };

    // 2. Risky requests: flagged before anything else, the AI is never called.
    const riskFlags = detectRiskFlags(pending.map((m) => m.text));
    const pb = this.playbook();
    const action = actionFor(pb, { isGroup, role });
    if (riskFlags.length) return { ...base, status: 'risk', action, riskFlags };
    if (action === 'ignore') return { ...base, status: 'ignored', action, reason: IGNORE_TEXT };
    if (!pending.length) return { ...base, status: 'ignored', action, reason: NO_CUSTOMER_TEXT };

    // 4. Trusted knowledge.
    const query = pending.map((m) => m.text).join('\n');
    const cards = action === 'draft' ? await this.vcwiki.searchCards(query).catch(() => []) : [];
    const sales: FrameSale[] = [];
    if (action === 'draft') {
      const quotes = await this.parts.lookup(query).catch(() => []);
      if (quotes.length) sales.push({ label: 'Giá niêm yết và tồn kho', text: partsText(quotes), at: new Date() });
    }
    const sources: AiDraftSource[] = [
      { type: 'history', label: `${messages.length} tin gần nhất` },
      ...(role ? [{ type: 'profile' as const, label: `Vai trò: ${ROLE_LABEL[role]}` }] : []),
      ...cards.map((c) => ({ type: 'vcwiki' as const, label: c.title })),
      ...sales.map((s) => ({ type: 'vcsale' as const, label: `VCsales: ${s.label}`, at: s.at.toISOString() })),
    ];

    // 5. Frame → gate → AI.
    const frame = buildFrame({ action, playbook: pb, role, isGroup, messages, cards, sales, profile: role ? `vai trò ${ROLE_LABEL[role]}` : null });
    let answer: { text: string; mode?: 'mock' | 'live'; model?: string };
    try {
      answer = await this.gateway.complete(frame, job.actor);
    } catch (e) {
      if (e instanceof C3BlockedError) return { ...base, status: 'blocked', action, reason: C3_BLOCKED_TEXT, sources };
      // Error class only: never the prompt or the answer.
      this.log.warn(`suggest ${action} failed: ${(e as Error).name}`);
      return { ...base, status: 'failed', action, reason: FAILED_TEXT, sources };
    }
    const mode = answer.mode ?? 'live';
    const model = answer.model ?? '';

    // 6. Output guard.
    const g = guardDraft(answer.text, trustedFacts(frame));
    const reasons = action === 'summary_only' ? g.reasons.filter((r) => r !== 'amount_without_source' && r !== 'long_number') : g.reasons;
    if (reasons.length) {
      this.log.warn(`suggest ${action} answer refused by the output guard: ${reasons.join(',')}`);
      return { ...base, status: 'blocked', action, reason: GUARD_REASON_TEXT, guard: reasons, sources, mode, model };
    }
    return action === 'draft'
      ? { ...base, status: 'pending', action, draft: g.text, sources, mode, model }
      : { ...base, status: 'summary', action, summary: g.text, sources, mode, model };
  }
}

/** Text messages usable as context, oldest first; erased customers and media-only messages skipped. */
export function toFrameMessages(items: MessageView[], uid: string): FrameMessage[] {
  return items
    .filter((m) => typeof m.text === 'string' && m.text.trim() && m.text !== ERASED_TEXT && !m.encrypted)
    .map((m) => {
      const own = SELF_FROM.has(String(m.fromUid)) || m.fromUid === uid;
      return { id: m.id, own, who: own ? 'Nhân viên' : (m.senderName ?? 'Khách'), text: m.text!.slice(0, 2000), sentAt: new Date(m.sentAt) };
    });
}

/** Customer messages waiting for an answer: after the nick's last message; none → the last 3 from the customer. */
export function pendingInbound(messages: FrameMessage[]): FrameMessage[] {
  let lastOwn = -1;
  messages.forEach((m, i) => {
    if (m.own) lastOwn = i;
  });
  const after = messages.slice(lastOwn + 1).filter((m) => !m.own);
  return after.length ? after : messages.filter((m) => !m.own).slice(-3);
}
