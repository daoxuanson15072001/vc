import type { MePermissions, RealtimeEvent } from '@vclinks/shared';

/**
 * Incremental parser of a text/event-stream (M1c-07). The Dashboard reads the stream with fetch + Bearer
 * header (EventSource cannot send headers), so the framing is parsed here. Comment lines (`: ping`) are skipped.
 */
export function createSseParser(onEvent: (ev: RealtimeEvent) => void): (chunk: string) => void {
  let buf = '';
  return (chunk) => {
    buf += chunk;
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = block.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as RealtimeEvent);
      } catch {
        // A broken frame is dropped; the next one is independent.
      }
    }
  };
}

/**
 * J1: sound, browser notification and tab badge are for customers of nicks the user holds ("chỉ báo tin
 * của khách mình phụ trách"). Managers and others still get their lists refreshed, just no alert.
 */
export function shouldAlertNewMessage(ev: RealtimeEvent, me: MePermissions | undefined): boolean {
  if (ev.type !== 'message.new' || !ev.uid || !me) return false;
  return me.legacy || me.heldChannels.includes(ev.uid);
}

/** Tab title with the unread count (J2): `(3) VClinks`. */
export const titleWithBadge = (base: string, n: number): string => (n > 0 ? `(${n > 99 ? '99+' : n}) ${base}` : base);

/** Reconnect delay after a dropped stream: 3 s, doubling up to 30 s. */
export const reconnectDelay = (attempt: number): number => Math.min(30_000, 3_000 * 2 ** Math.max(0, attempt));
