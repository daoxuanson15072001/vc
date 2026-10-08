/**
 * Translates the extension's technical send errors into the business sentence a
 * sale reads (03 QT-SZ-02 translation table). The original text stays available
 * as `detail` for the Admin.
 */
export interface SendErrorView {
  sentence: string;
  /** What the sale should do. */
  hint: string;
  /** Original technical text (for "Chi tiết"). */
  detail: string;
  /** False when pressing Thử lại would fail the same way. */
  canRetry: boolean;
  /** The quoted message is out of Zalo Web's reach: offer "Gửi không trích dẫn" (03 §8 D33). */
  sendWithoutQuote?: boolean;
}

interface Rule {
  test: RegExp;
  sentence: string | ((m: RegExpMatchArray) => string);
  hint: string;
  canRetry?: boolean;
  sendWithoutQuote?: boolean;
}

// Order matters: the first match wins.
const RULES: Rule[] = [
  {
    test: /ô soạn tin đang có nội dung chưa gửi|inputBusy|replyBusy/i,
    sentence: 'Trên Zalo đang có tin nháp gõ dở trong hội thoại này, VClinks không ghi đè.',
    hint: 'Xóa nháp trên Zalo (hoặc nhờ Admin) rồi bấm Thử lại.',
  },
  {
    test: /không khớp bản đã duyệt|mismatch|notSent|mentionMismatch/i,
    sentence: 'Nội dung trên Zalo không khớp bản bạn đã duyệt nên VClinks đã hủy, chưa gửi gì.',
    hint: 'Bấm Thử lại.',
  },
  {
    test: /tài khoản (\S+) không có trong Zalo Web|notHere/i,
    sentence: 'Zalo Web đang không đăng nhập nick này (có thể đã bị đăng xuất).',
    hint: 'Báo Admin đăng nhập lại; chưa Thử lại khi nick chưa xanh.',
    canRetry: false,
  },
  {
    test: /tab Zalo (không có focus|đang ẩn)|tabHidden|noFocus/i,
    sentence: 'Zalo Web của nick đang bị che hoặc ẩn nên chưa gửi được.',
    hint: 'Báo Admin.',
  },
  {
    test: /không thấy tin cần trả lời|trôi lên quá xa|replyTarget/i,
    sentence: 'Tin bạn trả lời đã trôi quá xa trên Zalo Web.',
    hint: 'Bấm "Gửi không trích dẫn" để gửi lại nội dung này, kèm dòng "Về tin: …" thay cho trích dẫn.',
    canRetry: false,
    sendWithoutQuote: true,
  },
  {
    test: /không tìm thấy đúng một danh thiếp|cardNotFound/i,
    sentence: 'Không tìm thấy đúng một người tên này trong danh bạ Zalo của nick.',
    hint: 'Chọn lại danh thiếp.',
    canRetry: false,
  },
  {
    test: /không tìm thấy hội thoại|không thấy hội thoại|không xác nhận được hội thoại|notFound|convItem|notActive/i,
    sentence: 'Không tìm thấy hội thoại này trên Zalo Web của nick.',
    hint: 'Bấm Thử lại sau 1 phút; lặp lại thì báo Admin.',
  },
  {
    test: /không xác nhận được tin đã hiện|unconfirmed|notConfirmed|không thấy (ảnh|tin|file) vừa gửi/i,
    sentence: 'Chưa chắc tin đã đi. Kiểm tra trên Zalo trước khi gửi lại để tránh gửi trùng.',
    hint: 'Xem khung chat; nếu chưa có tin mới thì bấm Thử lại.',
  },
];

export function describeSendError(raw: string | null | undefined): SendErrorView {
  const detail = (raw ?? '').trim();
  for (const r of RULES) {
    const m = detail.match(r.test);
    if (m) {
      return {
        sentence: typeof r.sentence === 'function' ? r.sentence(m) : r.sentence,
        hint: r.hint,
        detail,
        canRetry: r.canRetry ?? true,
        ...(r.sendWithoutQuote ? { sendWithoutQuote: true } : {}),
      };
    }
  }
  return { sentence: 'Không gửi được trên Zalo.', hint: 'Bấm Thử lại hoặc báo Admin.', detail, canRetry: true };
}

/** Length of the quoted text kept in the "Về tin" line (03 QT-SZ-02, `replyTarget`). */
export const UNQUOTED_EXCERPT = 60;

/**
 * Text for "Gửi không trích dẫn": the original text under a first line
 * `Về tin: "{first 60 characters of the quoted message}"` the sale can edit.
 */
export function unquotedText(text: string, quoted: string | null | undefined): string {
  const flat = (quoted ?? '').replace(/\s+/g, ' ').trim();
  if (!flat) return text;
  const excerpt = flat.length > UNQUOTED_EXCERPT ? `${flat.slice(0, UNQUOTED_EXCERPT).trimEnd()}…` : flat;
  return `Về tin: "${excerpt}"\n${text}`;
}
