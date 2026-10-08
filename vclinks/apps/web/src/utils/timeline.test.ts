import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '@vclinks/shared';
import { afterText, buildTimeline, multiChannelBands } from './timeline';

const ZALO = 'zalo-nick';
const OA = 'oa-nick';
let n = 0;
/** Event at 14/10/2026 `hh:mm:ss` Vietnam time (UTC+7). */
const ev = (uid: string, conv: string, hhmmss: string, direction: 'in' | 'out' = 'in', extra: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id: `e${++n}`,
  kind: 'message',
  at: new Date(`2026-10-14T${hhmmss}+07:00`).toISOString(),
  channel: uid === OA ? 'zalo_oa' : 'zalo',
  uid,
  nickLabel: uid,
  nickOwnerName: null,
  conversationId: conv,
  contactId: 'c1',
  contactName: 'Tuấn',
  direction,
  text: `tin ${n}`,
  ...extra,
});

describe('timeline layout (UAT-DK-79, DK-37…DK-39)', () => {
  // UAT-DK-79: Zalo 09:20:05, OA 09:21:00, Zalo 09:22, 09:25, 09:40.
  const events = [
    ev(ZALO, 'z:t', '09:40:00'),
    ev(ZALO, 'z:t', '09:25:00'),
    ev(ZALO, 'z:t', '09:22:00'),
    ev(OA, 'o:t', '09:21:00'),
    ev(ZALO, 'z:t', '09:20:05'),
  ];

  it('09:20, 09:22 and 09:25 form one cluster, 09:40 is a new one; order follows the original time', () => {
    const rows = buildTimeline(events).filter((r) => r.type === 'cluster' || r.type === 'event');
    expect(rows.map((r) => r.type)).toEqual(['event', 'event', 'cluster']);
    const cluster = rows[2]!;
    if (cluster.type !== 'cluster') throw new Error('cluster expected');
    expect(cluster.events.map((e) => e.at.slice(11, 19))).toEqual(['02:25:00', '02:22:00', '02:20:05']);
    expect(cluster.more).toBe(0);
    // 09:40 (Zalo) is the newest and stands alone; the OA message sits between it and the cluster.
    expect((rows[0] as { event: TimelineEvent }).event.uid).toBe(ZALO);
    expect((rows[1] as { event: TimelineEvent }).event.uid).toBe(OA);
  });

  it('draws "Chuyển sang OA · sau 1 phút" between the first Zalo message and the OA message', () => {
    const rows = buildTimeline(events);
    const sw = rows.filter((r) => r.type === 'switch');
    expect(sw).toHaveLength(2);
    const toOa = sw.find((r) => r.type === 'switch' && r.toUid === OA);
    expect(toOa && toOa.type === 'switch' && afterText(toOa.afterMs)).toBe('sau 1 phút');
  });

  it('one day heading and a band "2 kênh trong 1 giờ" over the inbound messages of both accounts', () => {
    const rows = buildTimeline(events);
    expect(rows.filter((r) => r.type === 'day')).toHaveLength(1);
    const band = rows.find((r) => r.type === 'band');
    expect(band).toMatchObject({ channels: 2 });
  });

  it('a long cluster shows the last 3 messages and counts the rest', () => {
    const many = [1, 2, 3, 4, 5].map((i) => ev(ZALO, 'z:t', `10:0${i}:00`));
    const c = buildTimeline(many).find((r) => r.type === 'cluster');
    expect(c && c.type === 'cluster' && { shown: c.shown.length, more: c.more }).toEqual({ shown: 3, more: 2 });
  });

  it('hidden rows (no right to read) are never clustered and carry no text', () => {
    const hidden: TimelineEvent = { ...ev(OA, '', '11:00:00'), kind: 'hidden', conversationId: null, hiddenCount: 3, text: undefined, direction: undefined };
    const rows = buildTimeline([hidden, ev(ZALO, 'z:t', '11:30:00')]);
    expect(rows.some((r) => r.type === 'event' && r.event.kind === 'hidden' && r.event.hiddenCount === 3)).toBe(true);
  });

  it('one channel only: no band; profile events have no channel switch', () => {
    const profile: TimelineEvent = { ...ev(ZALO, '', '12:00:00'), kind: 'profile', uid: null, channel: null, conversationId: null, op: 'merge', direction: undefined };
    const rows = buildTimeline([profile, ev(ZALO, 'z:t', '12:30:00', 'in')]);
    expect(rows.some((r) => r.type === 'band' || r.type === 'switch')).toBe(false);
    expect(multiChannelBands([ev(ZALO, 'z:t', '12:30:00'), ev(ZALO, 'z:t', '12:40:00')])).toEqual([]);
  });

  it('afterText', () => {
    expect(afterText(8 * 60_000)).toBe('sau 8 phút');
    expect(afterText(3 * 3_600_000)).toBe('sau 3 giờ');
    expect(afterText(10_000)).toBe('sau 1 phút');
  });
});
