import { contentDisposition, effectiveMime, isInlineMime } from './mime';

describe('stored file mime (photos and videos sent as files)', () => {
  it('keeps a specific type, ignores parameters', () => {
    expect(effectiveMime('application/pdf', 'bao-gia.png')).toBe('application/pdf');
    expect(effectiveMime('image/png; charset=binary', 'x')).toBe('image/png');
  });

  it('a generic type takes the type of the extension', () => {
    expect(effectiveMime('application/octet-stream', 'VCPROSEPROUS.png')).toBe('image/png');
    expect(effectiveMime('application/octet-stream', 'ban_nghe_thu.MP4')).toBe('video/mp4');
    expect(effectiveMime(null, 'ghi-am.m4a')).toBe('audio/mp4');
    expect(effectiveMime(undefined, 'Hồ sơ.pdf')).toBe('application/pdf');
  });

  it('photos, audio, video and PDF open in the tab; other types download; the name always goes along', () => {
    for (const m of ['image/png', 'image/jpeg', 'video/mp4', 'audio/mpeg', 'application/pdf']) expect(isInlineMime(m)).toBe(true);
    for (const m of ['application/zip', 'application/octet-stream', 'text/html', 'image/svg+xml', 'video/quicktime']) expect(isInlineMime(m)).toBe(false);
    expect(contentDisposition('application/pdf', 'Báo giá.pdf')).toBe("inline; filename*=UTF-8''B%C3%A1o%20gi%C3%A1.pdf");
    expect(contentDisposition('application/zip', 'Claude outputs.zip')).toBe("attachment; filename*=UTF-8''Claude%20outputs.zip");
    expect(contentDisposition('text/html', undefined)).toBe("attachment; filename*=UTF-8''tep");
  });

  it('unknown extension or no name: what was given (or null)', () => {
    expect(effectiveMime('application/octet-stream', 'Claude outputs.zip')).toBe('application/octet-stream');
    expect(effectiveMime(null, 'khong-duoi')).toBeNull();
    expect(effectiveMime('application/octet-stream', undefined)).toBe('application/octet-stream');
  });
});
