import { foldVi, type AiRiskFlag } from '@vclinks/shared';

/*
 * Risky requests in customer messages (CLAUDE.md §8, BA F7.3, SZ-19): money transfer, OTP, password,
 * changing a bank account. A flagged conversation gets a warning and NO draft, and the AI is not called.
 * Rules are deliberately broad (folded, accent-free text): a false flag only costs a draft, a missed one
 * may help a fraud.
 */
const RULES: [AiRiskFlag, RegExp][] = [
  ['otp', /\b(otp|ma xac (nhan|thuc|minh)|ma kich hoat|ma dang nhap|ma bao mat|verification code|ma (vua )?gui ve (dien thoai|may|sdt|so))\b/],
  ['mat_khau', /\b(mat khau|mat ma|pass ?word|ma pin)\b/],
  [
    'doi_tai_khoan',
    /\b(doi (so )?(tai khoan|tk|stk)|tai khoan (moi|khac)|stk (moi|khac)|so tai khoan (moi|khac)|cap nhat (so )?tai khoan|thay (doi )?(so )?tai khoan|doi thong tin (thanh toan|tai khoan|ngan hang)|doi ngan hang)\b/,
  ],
  [
    'chuyen_tien',
    /\b(chuyen (tien|khoan|gap|truoc|coc|hoan|lai)|ck (truoc|gap|vao|cho|giup)|chuyen \d|nap tien|ung (truoc|tien)|cho (em|minh|toi|anh|chi) (vay|muon)|vay tien|muon tien|gui tien|chuyen vao (tai khoan|tk|stk)|so tai khoan|\bstk\b|thanh toan (truoc|gap|ngay)|dat coc|tien coc|hoan tien)\b/,
  ],
];

/** Flags found in the texts, in AI_RISK_FLAGS order, without duplicates. */
export function detectRiskFlags(texts: readonly (string | null | undefined)[]): AiRiskFlag[] {
  const found = new Set<AiRiskFlag>();
  for (const t of texts) {
    if (!t) continue;
    const f = foldVi(t);
    for (const [flag, re] of RULES) if (re.test(f)) found.add(flag);
  }
  return (['chuyen_tien', 'otp', 'mat_khau', 'doi_tai_khoan'] as const).filter((x) => found.has(x));
}
