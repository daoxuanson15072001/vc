import { describe, expect, it } from 'vitest';
import type { MePermissions, RealtimeEvent } from '@vclinks/shared';
import { createSseParser, reconnectDelay, shouldAlertNewMessage, titleWithBadge } from './realtime';

const me = (over: Partial<MePermissions> = {}): MePermissions => ({ userId: 'u1', legacy: false, roles: [], permissions: {}, heldChannels: ['900001'], ...over });
const ev = (over: Partial<RealtimeEvent> = {}): RealtimeEvent => ({ type: 'message.new', id: '900001:K1', at: '2026-10-04T10:00:00Z', uid: '900001', threadId: 'K1', ...over });

describe('createSseParser', () => {
  it('parses events split across chunks and skips comments', () => {
    const got: RealtimeEvent[] = [];
    const feed = createSseParser((e) => got.push(e));
    feed('retry: 3000\n: ready\n\nevent: message.new\ndata: {"type":"message.new","id":"a","at":"t"}\n');
    expect(got).toHaveLength(0);
    feed('\n: ping\n\nevent: account.red\ndata: {"type":"account.red","id":"b","at":"t"}\n\n');
    expect(got.map((e) => e.type)).toEqual(['message.new', 'account.red']);
  });
  it('drops a broken frame and keeps going', () => {
    const got: RealtimeEvent[] = [];
    const feed = createSseParser((e) => got.push(e));
    feed('data: {oops\n\ndata: {"type":"notification","id":"n","at":"t"}\n\n');
    expect(got.map((e) => e.id)).toEqual(['n']);
  });
});

describe('shouldAlertNewMessage', () => {
  it('alerts only for nicks the user holds', () => {
    expect(shouldAlertNewMessage(ev(), me())).toBe(true);
    expect(shouldAlertNewMessage(ev({ uid: '900002' }), me())).toBe(false);
  });
  it('ignores other event types and missing profile', () => {
    expect(shouldAlertNewMessage(ev({ type: 'account.red' }), me())).toBe(false);
    expect(shouldAlertNewMessage(ev(), undefined)).toBe(false);
  });
  it('legacy token sees everything', () => {
    expect(shouldAlertNewMessage(ev({ uid: 'x' }), me({ legacy: true, heldChannels: [] }))).toBe(true);
  });
});

describe('badge and backoff', () => {
  it('formats the tab title', () => {
    expect(titleWithBadge('VClinks', 0)).toBe('VClinks');
    expect(titleWithBadge('VClinks', 3)).toBe('(3) VClinks');
    expect(titleWithBadge('VClinks', 150)).toBe('(99+) VClinks');
  });
  it('backs off up to 30 s', () => {
    expect([0, 1, 2, 5].map(reconnectDelay)).toEqual([3000, 6000, 12000, 30000]);
  });
});
