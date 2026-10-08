import { z } from 'zod';
import { foldVi } from './contact-list';

/*
 * Sensitivity levels C0–C3 (BA §1 #5, D2-15; M1b-14).
 * - C0 public (published product info), C1 internal (playbook, VCwiki cards),
 *   C2 conversation content and customer profile (default for chat),
 *   C3 debt, credit limit, customer-specific price policy: never sent to an external AI, never over MCP.
 * The gate (apps/api/src/security/ai-gateway.ts) refuses any external AI call whose context holds C3.
 */
export const SENSITIVITY_LEVELS = ['C0', 'C1', 'C2', 'C3'] as const;
export type Sensitivity = (typeof SENSITIVITY_LEVELS)[number];
export const sensitivitySchema = z.enum(SENSITIVITY_LEVELS);

/** Conversations are C2 unless something raises them (BA §1 #5). */
export const DEFAULT_CONVERSATION_SENSITIVITY: Sensitivity = 'C2';

/** Tooltip / error text when a C3 context blocks an AI action (04 MH-OA-20 #4). */
export const C3_BLOCKED_TEXT = 'Tin có dữ liệu mật mức C3, không gửi AI ngoài.';

/** Placeholder shown instead of the content of an erased customer (key destroyed, BA §2.2 #9). */
export const ERASED_TEXT = '[Đã ẩn danh]';

const RANK: Record<Sensitivity, number> = { C0: 0, C1: 1, C2: 2, C3: 3 };

export function sensitivityRank(s: Sensitivity): number {
  return RANK[s];
}

/** Highest level of the list (C0 for an empty list). */
export function maxSensitivity(levels: Iterable<Sensitivity | undefined | null>): Sensitivity {
  let best: Sensitivity = 'C0';
  for (const l of levels) if (l && RANK[l] > RANK[best]) best = l;
  return best;
}

/** Kind of a part of an AI context; each kind has a default level. */
export const AI_CONTEXT_KINDS = ['instruction', 'playbook', 'wiki', 'message', 'profile', 'sale', 'other'] as const;
export type AiContextKind = (typeof AI_CONTEXT_KINDS)[number];

export const DEFAULT_KIND_SENSITIVITY: Record<AiContextKind, Sensitivity> = {
  instruction: 'C1',
  playbook: 'C1',
  wiki: 'C1',
  message: 'C2',
  profile: 'C2',
  // Sale lookups (price, stock) are C2; the adapter marks debt / credit limit / own price policy C3 itself.
  sale: 'C2',
  other: 'C2',
};

export const aiContextPartSchema = z.object({
  kind: z.enum(AI_CONTEXT_KINDS),
  text: z.string(),
  /** Level declared by the source (e.g. VCsale adapter: debt = C3). The gate never lowers it. */
  level: sensitivitySchema.optional(),
  /** Where the part comes from (message id, wiki card id...), for the audit log; never content. */
  source: z.string().max(200).optional(),
});
export type AiContextPart = z.infer<typeof aiContextPartSchema>;

export const aiContextSchema = z.object({
  /** What the call is for (suggest, summary, extract...), for the audit log. */
  purpose: z.string().min(1).max(60),
  parts: z.array(aiContextPartSchema),
});
export type AiContext = z.infer<typeof aiContextSchema>;

/*
 * Text detection (folded, accent-free). A C3 topic word next to an amount is C3: "công nợ 12.500.000đ",
 * "hạn mức 50 triệu", "giá riêng 850k". The topic word alone ("anh còn nợ không em?") stays C2.
 * Rules are deliberately broad: a false C3 only costs an AI suggestion, a missed one leaks a secret.
 */
const C3_TOPIC = /\b(cong no|no qua han|du no|no cu|han muc|tin dung|chinh sach gia|gia rieng|bang gia rieng|chiet khau rieng|ck rieng|gia dai ly cap)\b/;
const AMOUNT = /\d[\d.,\s]*\s*(d\b|dong|vnd|k\b|nghin|ngan|tr\b|trieu|ty|%)|\d{1,3}([.,]\d{3}){1,}/;
/** Characters between the topic word and the amount that still count as "next to". */
const NEAR = 60;

/** Level found in the text itself (C2 or C3); declared levels are combined by `classifyPart`. */
export function detectSensitivity(text: string): Sensitivity {
  const f = foldVi(text ?? '');
  const re = new RegExp(C3_TOPIC.source, 'g');
  for (let m = re.exec(f); m; m = re.exec(f)) {
    const from = Math.max(0, m.index - NEAR);
    const around = f.slice(from, m.index + m[0].length + NEAR);
    if (AMOUNT.test(around)) return 'C3';
  }
  return 'C2';
}

/** Level of one part: the highest of its declared level, its kind's default and what the text shows. */
export function classifyPart(p: Pick<AiContextPart, 'kind' | 'text' | 'level'>): Sensitivity {
  const detected = detectSensitivity(p.text);
  return maxSensitivity([p.level, DEFAULT_KIND_SENSITIVITY[p.kind], detected === 'C3' ? 'C3' : undefined]);
}

/** Level of a whole context: the highest part. */
export function classifyContext(parts: Pick<AiContextPart, 'kind' | 'text' | 'level'>[]): Sensitivity {
  return maxSensitivity(parts.map(classifyPart));
}

/**
 * Removes C3 items before data leaves the solution through MCP (BA §1.2 #4: "không trả dữ liệu C3").
 * An item is C3 when it declares `level: 'C3'` or its `text` is detected as C3.
 */
export function stripC3<T extends { level?: Sensitivity | null; text?: string | null }>(items: T[]): T[] {
  return items.filter((it) => it.level !== 'C3' && !(typeof it.text === 'string' && detectSensitivity(it.text) === 'C3'));
}
