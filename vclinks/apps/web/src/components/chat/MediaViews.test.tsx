/**
 * Files of a message (06/10/2026): photos, videos and audio sent as files show inline like Zalo / Messenger, other
 * files are cards that download on click. SYNTHETIC fixtures, no customer data.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { describe, expect, it } from 'vitest';
import type { AttachmentView } from '@vclinks/shared';
import type { ChatMessage, FileMedia } from '../../types';
import MessageBubble from './MessageBubble';
import { FileCards, fileMediaKind } from './MediaViews';
import { typingText } from './typingBus';

const files = (list: FileMedia[], attachments?: AttachmentView[], compact?: boolean) => renderToStaticMarkup(<FileCards files={list} attachments={attachments} compact={compact} />);

describe('files in the chat', () => {
  it('sorts files by how they are shown', () => {
    expect(fileMediaKind({ name: 'VCPROSEPROUS.png' })).toBe('image');
    expect(fileMediaKind({ name: 'anh', ext: 'JPG' })).toBe('image');
    expect(fileMediaKind({ name: 'ban_nghe_thu.mp4' })).toBe('video');
    expect(fileMediaKind({ name: 'clip.MOV' })).toBe('video');
    expect(fileMediaKind({ name: 'ghi-am.m4a' })).toBe('audio');
    expect(fileMediaKind({ name: 'VC GARAGE - MATBAO.docx.pdf' })).toBe('document');
    expect(fileMediaKind({ name: 'Claude outputs.zip' })).toBe('document');
    expect(fileMediaKind({ name: 'anh.heic' })).toBe('document');
  });

  it('a photo sent as a file shows the picture, its name, size and a download button', () => {
    const html = files([{ name: 'VCPROSEPROUS.png', size: '67 KB', url: 'https://file.example.test/a.png' }]);
    expect(html).toContain('<img');
    expect(html).toContain('src="https://file.example.test/a.png"');
    expect(html).toContain('VCPROSEPROUS.png');
    expect(html).toContain('67 KB');
    expect(html).toContain('aria-label="Tải về VCPROSEPROUS.png"');
    expect(html).not.toContain('Mở từ kho công ty');
  });

  it('a kept photo waits for the company copy (loaded with the token), never the expiring link first', () => {
    const kept: AttachmentView = { id: 'u:m1#file:0', kind: 'file', status: 'stored', fileName: 'a.png', mime: 'image/png', size: 68_000 };
    const html = files([{ name: 'a.png', url: 'https://file.example.test/a.png' }], [kept]);
    expect(html).toContain('Đang tải ảnh…');
    expect(html).not.toContain('src="https://file.example.test/a.png"');
  });

  it('a video sent as a file plays in the chat; audio gets a player', () => {
    const video = files([{ name: 'ban_nghe_thu.mp4', size: '20 MB', url: 'https://file.example.test/v.mp4' }]);
    expect(video).toContain('<video');
    expect(video).toContain('src="https://file.example.test/v.mp4"');
    expect(video).toContain('preload="metadata"');
    expect(video).toContain('20 MB');
    const audio = files([{ name: 'ghi-am.mp3', url: 'https://file.example.test/a.mp3' }]);
    expect(audio).toContain('<audio');
  });

  it('a PDF opens to read on click, with a separate download button; other documents download on click', () => {
    const pdf = files([{ name: 'VC GARAGE - MATBAO.docx.pdf', size: '298 KB', url: 'https://file.example.test/x.pdf' }]);
    expect(pdf).toContain('file-card--action');
    expect(pdf).toContain('role="button"');
    expect(pdf).toContain('aria-label="Xem VC GARAGE - MATBAO.docx.pdf"');
    expect(pdf).toContain('Bấm để xem');
    expect(pdf).toContain('aria-label="Tải về VC GARAGE - MATBAO.docx.pdf"');
    expect(pdf).toContain('PDF · 298 KB');
    expect(pdf).not.toContain('<img');
    const zip = files([{ name: 'Claude outputs.zip', size: '51 KB', url: 'https://file.example.test/x.zip' }]);
    expect(zip).toContain('aria-label="Tải về Claude outputs.zip"');
    expect(zip).not.toContain('Bấm để xem');
  });

  it('a file without a link says so and offers nothing to click', () => {
    const missing = files([{ name: 'hop-dong.docx' }]);
    expect(missing).toContain('chưa có tệp');
    expect(missing).not.toContain('role="button"');
  });

  it('compact lists (conversation files tab) keep every file as a card', () => {
    const html = files(
      [
        { name: 'a.png', url: 'https://file.example.test/a.png' },
        { name: 'v.mp4', url: 'https://file.example.test/v.mp4' },
      ],
      undefined,
      true,
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<video');
    expect(html.match(/file-card--action/g)?.length).toBe(2);
  });

  it('a message with only a photo or video file sits edge to edge in its bubble; with words it does not', () => {
    const base = { id: 'a:b:1', msgId: 'm1', threadId: 'b', fromUid: 'b', sentAt: '2026-10-06T03:00:00.000Z', contentStatus: 'complete' } as const;
    const bubble = (extra: Partial<ChatMessage>) =>
      renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient()}>
          <App>
            <MessageBubble m={{ ...base, ...extra } as ChatMessage} own={false} isGroup={false} firstInRun lastInRun />
          </App>
        </QueryClientProvider>,
      );
    expect(bubble({ files: [{ name: 'a.png', url: 'https://file.example.test/a.png' }] })).toContain('bubble--media');
    expect(bubble({ files: [{ name: 'bao-gia.pdf', url: 'https://file.example.test/x.pdf' }] })).not.toContain('bubble--media');
    expect(bubble({ text: 'Ảnh xe của anh', files: [{ name: 'a.png', url: 'https://file.example.test/a.png' }] })).not.toContain('bubble--media');
    // A sticker stands alone, without a bubble.
    const sticker = bubble({ kind: 'sticker', images: ['https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=1&size=130'] });
    expect(sticker).toContain('bubble--sticker');
    expect(sticker).not.toContain('bubble--media');
    // After the move to direct, old content that never came says so (instead of waiting forever).
    expect(bubble({ encrypted: true, contentStatus: 'pending', contentGone: true })).toContain('Nội dung cũ, chưa lấy được');
    expect(bubble({ encrypted: true, contentStatus: 'pending' })).toContain('Đang chờ nội dung từ Zalo');
    // Group system lines of a direct nick: deputies are worded too.
    expect(bubble({ fromUid: '222', senderName: 'Chị Lan', systemEvent: { act: 'add_admin', actorId: '222' } })).toContain('Chị Lan đã được bổ nhiệm làm phó nhóm');
  });

  it('typing line: 1-1 says it plainly, a group names who types', () => {
    expect(typingText(false)).toBe('Đang soạn tin…');
    expect(typingText(true, 'Chị Lan')).toBe('Chị Lan đang soạn tin…');
    expect(typingText(true, null)).toBe('Có người đang soạn tin…');
  });
});
