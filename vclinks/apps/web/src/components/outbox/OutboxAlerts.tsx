import { useEffect, useRef } from 'react';
import { App, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { OutboxItem } from '../../types';
import { describeSendError } from '../../utils/send-errors';
import { ATTENTION, useOutboxList } from './queue';

/** Max notices on screen at once (SZ-24 (1)). */
const MAX_STACK = 3;

/** Short two-tone "error" sound, different from a new-message chime (SZ-24 (2)). */
function playErrorSound() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [440, 330].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      osc.start(t);
      osc.stop(t + 0.16);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // Audio blocked until the user interacts with the page: the visual notice still shows.
  }
}

function title(it: OutboxItem): string {
  const where = it.name || 'một hội thoại';
  if (it.status === 'expired') return `Lệnh gửi ${where} quá hạn, chưa gửi`;
  if (it.status === 'awaiting_confirm') return `Nick đã kết nối lại. Còn tin chờ gửi cho ${where}`;
  if (it.status === 'needs_reapproval') return `Lệnh gửi ${where} cần duyệt lại`;
  return `Gửi lỗi: ${where}`;
}

/**
 * SZ-24 / SZ-28 b: when one of my commands turns failed / expired / awaiting
 * confirmation, a notice that does not close by itself, an error sound, and a
 * browser notification when the tab is in the background (conversation name
 * only, never the message text). Items already in that state when the page
 * loads are not announced again (the red badge shows them).
 */
export default function OutboxAlerts() {
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const q = useOutboxList({ statuses: ATTENTION, limit: 50 });
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const items = q.data;
    if (!items) return;
    const key = (it: OutboxItem) => `${it.id}:${it.status}:${it.statusAt ?? ''}`;
    if (!seen.current) {
      seen.current = new Set(items.map(key));
      return;
    }
    const fresh = items.filter((it) => !seen.current!.has(key(it)));
    for (const it of items) seen.current.add(key(it));
    if (!fresh.length) return;
    playErrorSound();
    for (const it of fresh.slice(-MAX_STACK)) {
      const convId = `${it.uid}:${it.threadId}`;
      notification.error({
        key: it.id,
        message: title(it),
        description: it.status === 'failed' ? describeSendError(it.error).sentence : it.text.slice(0, 80),
        duration: 0,
        placement: 'topRight',
        btn: (
          <Space>
            <Button size="small" onClick={() => { notification.destroy(it.id); navigate(`/conversations/${encodeURIComponent(convId)}`); }}>
              Mở hội thoại
            </Button>
            <Button size="small" type="primary" onClick={() => { notification.destroy(it.id); navigate('/outbox'); }}>
              Lệnh gửi
            </Button>
          </Space>
        ),
      });
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('VClinks', { body: title(it), tag: it.id });
        } catch {
          // Some browsers only allow notifications from a service worker.
        }
      }
    }
  }, [q.data, notification, navigate]);

  // Ask once for browser notifications so failures reach a background tab.
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined);
  }, []);

  return null;
}
