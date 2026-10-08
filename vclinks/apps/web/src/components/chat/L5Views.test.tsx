/**
 * Display of every L5 message kind (M1c-08) with SYNTHETIC fixtures (no customer data): location, call (missed and
 * ended), reminder, video. Real samples are tested by the project owner in the test group.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types';
import { CallView, LocationView, ReminderView } from './L5Views';
import MessageBubble from './MessageBubble';
import { VideoView } from './MediaViews';
import { copyTextOf } from './MessageMenu';

const base = { id: 'a:b:1', msgId: 'm1', threadId: 'b', fromUid: 'b', sentAt: '2026-10-04T03:00:00.000Z', contentStatus: 'complete' } as const;
const bubble = (extra: Partial<ChatMessage>) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <App>
        <MessageBubble m={{ ...base, ...extra } as ChatMessage} own={false} isGroup={false} firstInRun lastInRun />
      </App>
    </QueryClientProvider>,
  );

describe('L5 views', () => {
  it('location: title, address, coordinates and a map link that opens safely', () => {
    const html = renderToStaticMarkup(<LocationView location={{ lat: 21.0285, lng: 105.8542, title: 'Kho Test', address: '1 Phố Thử', url: 'https://maps.example.test/x' }} />);
    expect(html).toContain('Kho Test');
    expect(html).toContain('1 Phố Thử');
    expect(html).toContain('21.02850, 105.85420');
    expect(html).toContain('href="https://maps.example.test/x"');
    expect(html).toContain('noopener');
  });
  it('location without link falls back to an OpenStreetMap link; without coordinates there is no link', () => {
    expect(renderToStaticMarkup(<LocationView location={{ lat: 10, lng: 20 }} />)).toContain('openstreetmap.org');
    expect(renderToStaticMarkup(<LocationView location={{ title: 'Chỉ tên' }} />)).not.toContain('<a ');
  });
  it('call: missed is red, ended shows duration', () => {
    const missed = renderToStaticMarkup(<CallView call={{ outcome: 'missed' }} />);
    expect(missed).toContain('Cuộc gọi nhỡ');
    expect(missed).toContain('#d92d20');
    expect(renderToStaticMarkup(<CallView call={{ outcome: 'ended', video: true, durationSec: 135 }} />)).toContain('Cuộc gọi video đã kết thúc · 2:15');
  });
  it('reminder: title and time as written', () => {
    const html = renderToStaticMarkup(<ReminderView reminder={{ title: 'Hẹn giao lọc gió', when: '09:00 05/10/2026' }} />);
    expect(html).toContain('Hẹn giao lọc gió');
    expect(html).toContain('Nhắc hẹn · 09:00 05/10/2026');
  });
  it('video: thumbnail with duration while the file is not stored', () => {
    const html = renderToStaticMarkup(<VideoView video={{ thumb: 'https://f.example.test/t.jpg', durationSec: 12 }} />);
    expect(html).toContain('0:12');
    expect(html).toContain('t.jpg');
  });
});

describe('message bubble shows each L5 kind instead of a bare placeholder', () => {
  it('location', () => expect(bubble({ kind: 'location', location: { title: 'Kho Test', lat: 1, lng: 2 } })).toContain('Kho Test'));
  it('call', () => expect(bubble({ kind: 'call', call: { outcome: 'missed' } })).toContain('Cuộc gọi nhỡ'));
  it('reminder', () => expect(bubble({ kind: 'reminder', reminder: { title: 'Hẹn giao hàng' } })).toContain('Hẹn giao hàng'));
  it('video', () => expect(bubble({ kind: 'video', video: { thumb: 'https://f.example.test/t.jpg', durationSec: 65 } })).toContain('1:05'));
  it('a kind with no content yet keeps the labelled placeholder', () => expect(bubble({ kind: 'location' })).toContain('[Vị trí]'));
});

describe('Sao chép copies only what the viewer was served', () => {
  it('returns the served text, nothing for system lines or bubbles without text', () => {
    expect(copyTextOf({ ...base, text: 'SĐT khách 0900 *** 101' } as ChatMessage)).toBe('SĐT khách 0900 *** 101');
    expect(copyTextOf({ ...base, kind: 'location', location: { lat: 1, lng: 2 } } as ChatMessage)).toBe('');
    expect(copyTextOf({ ...base, text: 'x', systemEvent: { act: 'join' } } as ChatMessage)).toBe('');
  });
});
