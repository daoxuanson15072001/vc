import { emitTyping } from '../chat/typingBus';
import { useEffect, useRef } from 'react';
import { App } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { REALTIME_STREAM_PATH, type NotificationList, type RealtimeEvent } from '@vclinks/shared';
import { api, getToken } from '../../api';
import { usePermissions } from '../../state/permissions';
import { createSseParser, reconnectDelay, shouldAlertNewMessage, titleWithBadge } from '../../utils/realtime';
import { baseTitle } from '../../utils/title';

/** Short chime for a new customer message, softer than the error tone of OutboxAlerts. */
function playChime(freq = 660) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    setTimeout(() => void ctx.close(), 500);
  } catch {
    // Audio is blocked until the user interacts with the page: the visual notice still shows.
  }
}

function browserNotify(body: string, tag: string, onClick: () => void) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification('VClinks', { body, tag });
    n.onclick = () => {
      window.focus();
      onClick();
      n.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
}

/**
 * M1c-07 (BA J1, J2): one SSE connection per signed-in tab. The server already filters events to what the
 * user may see; this component only refreshes lists, plays sounds, shows browser notifications and keeps
 * the unread count in the tab title. A browser notification shows the conversation name + "có tin mới",
 * never the message text. Alerts for new messages are limited to nicks the user holds.
 */
export default function RealtimeBridge() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { notification } = App.useApp();
  const perms = usePermissions();
  const meRef = useRef(perms.me);
  meRef.current = perms.me;
  const unread = useRef(0);

  useEffect(() => {
    const onFocus = () => {
      unread.current = 0;
      document.title = baseTitle(document.title);
    };
    const onVisible = () => !document.hidden && onFocus();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    const open = (id: string) => navigate(`/conversations/${encodeURIComponent(id)}`);
    const nameOf = async (id: string): Promise<string> => {
      try {
        const c = await api<{ name?: string }>(`/conversations/${encodeURIComponent(id)}`);
        return c.name || 'một hội thoại';
      } catch {
        return 'một hội thoại';
      }
    };

    const onEvent = (ev: RealtimeEvent) => {
      switch (ev.type) {
        case 'message.new': {
          if (ev.uid && ev.threadId) emitTyping({ uid: ev.uid, threadId: ev.threadId, stop: true });
          void qc.invalidateQueries({ queryKey: ['conversations'] });
          void qc.invalidateQueries({ queryKey: ['messages'] });
          void qc.invalidateQueries({ queryKey: ['inbox-summary'] });
          if (!shouldAlertNewMessage(ev, meRef.current)) return;
          playChime();
          if (document.hidden) {
            unread.current += 1;
            document.title = titleWithBadge(baseTitle(document.title), unread.current);
            void nameOf(ev.id).then((n) => browserNotify(`${n}: có tin mới`, ev.id, () => open(ev.id)));
          }
          return;
        }
        case 'message.content':
          // The text / photo of a message shown "Đang chờ nội dung" was just captured: redraw, no sound.
          void qc.invalidateQueries({ queryKey: ['messages'] });
          void qc.invalidateQueries({ queryKey: ['conversations'] });
          return;
        case 'typing':
          // The open chat of that conversation shows "đang soạn tin…" for a few seconds.
          if (ev.uid && ev.threadId) emitTyping({ uid: ev.uid, threadId: ev.threadId, ...(ev.kind ? { who: ev.kind } : {}) });
          return;
        case 'command.failed':
          void qc.invalidateQueries({ queryKey: ['outbox'] });
          return;
        case 'account.red':
        case 'account.ok':
          void qc.invalidateQueries({ queryKey: ['accounts'] });
          void qc.invalidateQueries({ queryKey: ['health'] });
          if (ev.type === 'account.red') {
            playChime(330);
            notification.warning({ key: `red:${ev.id}`, message: 'Một nick vừa mất kết nối Zalo', description: 'Xem trạng thái ở trang Đồng bộ.', duration: 0, placement: 'topRight' });
            if (document.hidden) browserNotify('Một nick vừa mất kết nối Zalo', `red:${ev.id}`, () => navigate('/sync'));
          }
          return;
        case 'notification': {
          void qc.invalidateQueries({ queryKey: ['notifications'] });
          void qc.invalidateQueries({ queryKey: ['workitems'] });
          void api<NotificationList>('/notifications').then((l) => {
            const n = l.items.find((i) => i.id === ev.id) ?? l.items.find((i) => !i.read);
            if (!n) return;
            if (ev.kind === 'sla_breach') playChime(440);
            notification.info({ key: ev.id, message: n.title, duration: 8, placement: 'topRight', onClick: () => n.link && navigate(n.link) });
            if (document.hidden) browserNotify(n.title, ev.id, () => n.link && navigate(n.link));
          }).catch(() => undefined);
          return;
        }
      }
    };

    const ctl = new AbortController();
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`/api${REALTIME_STREAM_PATH}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: ctl.signal });
        // An expired / forbidden session is handled by the normal API calls (redirect to login), not here.
        if (res.status === 401 || res.status === 403 || !res.body) return;
        if (attempt > 0) void qc.invalidateQueries(); // missed events while disconnected: reload everything once
        attempt = 0;
        const feed = createSseParser(onEvent);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          feed(value);
        }
      } catch {
        if (ctl.signal.aborted) return;
      }
      if (ctl.signal.aborted) return;
      timer = setTimeout(() => void run(), reconnectDelay(attempt++));
    };
    void run();

    return () => {
      ctl.abort();
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      document.title = baseTitle(document.title);
    };
  }, [qc, navigate, notification]);

  return null;
}
