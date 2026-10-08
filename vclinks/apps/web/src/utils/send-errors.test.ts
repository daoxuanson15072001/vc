import { describe, expect, it } from 'vitest';
import { describeSendError, unquotedText } from './send-errors';
import { nickName, UNNAMED_NICK } from './nick';

describe('describeSendError (QT-SZ-02)', () => {
  it.each([
    ['ô soạn tin đang có nội dung chưa gửi, không ghi đè', /tin nháp gõ dở/, true],
    ['nội dung trong ô soạn tin không khớp bản đã duyệt, đã xóa và không gửi', /không khớp bản bạn đã duyệt/, true],
    ['tài khoản 4762148268 không có trong Zalo Web này', /không đăng nhập nick/, false],
    ['tab Zalo đang ẩn nên Zalo Web không tải danh sách hội thoại', /bị che hoặc ẩn/, true],
    ['không thấy tin cần trả lời trong khung chat Zalo (có thể đã trôi lên quá xa)', /trôi quá xa/, false],
    ['không tìm thấy đúng một danh thiếp có tên này', /danh bạ Zalo/, false],
    ['không thấy hội thoại trong danh sách bên trái của Zalo Web', /Không tìm thấy hội thoại/, true],
    ['lỗi lạ', /Không gửi được trên Zalo/, true],
  ])('%s', (raw, sentence, canRetry) => {
    const v = describeSendError(raw);
    expect(v.sentence).toMatch(sentence);
    expect(v.canRetry).toBe(canRetry);
    expect(v.detail).toBe(raw);
  });
});

describe('nickName', () => {
  it('never shows the uid-based label', () => {
    expect(nickName('Zalo 4762148268')).toBe(UNNAMED_NICK);
    expect(nickName('')).toBe(UNNAMED_NICK);
    expect(nickName('4762148268')).toBe(UNNAMED_NICK);
    expect(nickName('Zalo 4762148268', 'Linh')).toBe('Linh');
    expect(nickName('Linh VCparts')).toBe('Linh VCparts');
  });
});

describe('Gửi không trích dẫn (M1a-06, 03 §8 D33)', () => {
  it('offers it for the extension replyTarget error, after its own auto-scroll', () => {
    const v = describeSendError('không thấy tin cần trả lời trong khung chat Zalo dù đã tự cuộn lên tìm (tin đã trôi quá xa)');
    expect(v.canRetry).toBe(false);
    expect(v.sendWithoutQuote).toBe(true);
    expect(describeSendError('không tìm thấy hội thoại').sendWithoutQuote).toBeUndefined();
  });

  it('puts a "Về tin" line with at most 60 characters of the quoted message above the text', () => {
    expect(unquotedText('Dạ còn ạ', 'Lọc gió\n Camry 2019 còn không?')).toBe('Về tin: "Lọc gió Camry 2019 còn không?"\nDạ còn ạ');
    const long = 'a'.repeat(80);
    expect(unquotedText('Dạ', long)).toBe(`Về tin: "${'a'.repeat(60)}…"\nDạ`);
    expect(unquotedText('Dạ', '')).toBe('Dạ');
  });
});
