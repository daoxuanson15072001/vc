import { CLUSTER_MINUTES, MULTI_CHANNEL_WINDOW_MINUTES, type TimelineEvent } from '@vclinks/shared';
import { bubbleTime, dayKey, daySeparatorLabel } from './time';

/*
 * Layout of the merged timeline (02 MH-DK-03, rules DK-37…DK-39), from the flat events the API returns:
 * - events are ordered by original time (the API sorts; `at` is the platform time, not the arrival time);
 * - messages of one conversation closer than 10 minutes form a cluster (other channels may sit between
 *   them); the cluster is placed at its first message and shows its last 3 messages;
 * - a line between two rows of different channel accounts: "Chuyển sang [kênh] · sau [khoảng]";
 * - ≥ 2 channel accounts with inbound messages inside 60 minutes: a band "Khách dùng n kênh trong 1 giờ";
 * - a heading per day.
 * Newest first, like the page ("Tải thêm" loads older events).
 */

export type TimelineRow =
  | { type: 'day'; key: string; label: string }
  | { type: 'band'; key: string; channels: number; from: string; to: string }
  | { type: 'switch'; key: string; toUid: string; to: Pick<TimelineEvent, 'channel' | 'nickLabel' | 'nickOwnerName'>; afterMs: number }
  /** One visible message / profile operation / "n tin · bạn không có quyền xem nội dung". */
  | { type: 'event'; key: string; at: string; event: TimelineEvent }
  /** ≥ 2 messages of one conversation; `events` newest first. */
  | { type: 'cluster'; key: string; at: string; from: string; to: string; conversationId: string; events: TimelineEvent[]; shown: TimelineEvent[]; more: number };

const MIN = 60_000;
const SHOWN = 3;

interface Item {
  at: string;
  key: string;
  uid: string | null;
  ev: TimelineEvent;
  row: Extract<TimelineRow, { type: 'event' | 'cluster' }>;
}

export function buildTimeline(events: TimelineEvent[]): TimelineRow[] {
  const items: Item[] = [];
  const byConv = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    if (e.kind === 'message' && e.conversationId) byConv.set(e.conversationId, [...(byConv.get(e.conversationId) ?? []), e]);
    else items.push({ at: e.at, key: e.id, uid: e.uid, ev: e, row: { type: 'event', key: e.id, at: e.at, event: e } });
  }
  for (const [conversationId, list] of byConv) {
    const asc = [...list].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    let cur: TimelineEvent[] = [];
    const flush = () => {
      if (!cur.length) return;
      const first = cur[0]!;
      if (cur.length === 1) {
        items.push({ at: first.at, key: first.id, uid: first.uid, ev: first, row: { type: 'event', key: first.id, at: first.at, event: first } });
      } else {
        const desc = [...cur].reverse();
        items.push({
          at: first.at,
          key: `cluster:${first.id}`,
          uid: first.uid,
          ev: first,
          row: { type: 'cluster', key: `cluster:${first.id}`, at: first.at, from: first.at, to: desc[0]!.at, conversationId, events: desc, shown: desc.slice(0, SHOWN), more: Math.max(desc.length - SHOWN, 0) },
        });
      }
      cur = [];
    };
    for (const e of asc) {
      const last = cur[cur.length - 1];
      if (last && Date.parse(e.at) - Date.parse(last.at) > CLUSTER_MINUTES * MIN) flush();
      cur.push(e);
    }
    flush();
  }
  items.sort((a, b) => b.at.localeCompare(a.at) || b.key.localeCompare(a.key));

  const rows: TimelineRow[] = [];
  const bands = multiChannelBands(events);
  const usedBands = new Set<number>();
  let lastDay = '';
  let prev: Item | null = null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const day = dayKey(it.at);
    if (day !== lastDay) {
      rows.push({ type: 'day', key: `day:${day}`, label: daySeparatorLabel(it.at) });
      lastDay = day;
    }
    bands.forEach((b, bi) => {
      if (!usedBands.has(bi) && Date.parse(it.at) <= Date.parse(b.to)) {
        usedBands.add(bi);
        rows.push({ type: 'band', key: `band:${b.from}`, channels: b.channels, from: b.from, to: b.to });
      }
    });
    // Channel switch: the older neighbour with a channel account differs from this row.
    if (prev && prev.uid && it.uid && prev.uid !== it.uid) {
      rows.push({ type: 'switch', key: `switch:${prev.key}`, toUid: prev.uid, to: { channel: prev.ev.channel, nickLabel: prev.ev.nickLabel, nickOwnerName: prev.ev.nickOwnerName }, afterMs: Date.parse(prev.at) - Date.parse(it.at) });
    }
    rows.push(it.row);
    if (it.uid) prev = it;
  }
  return rows;
}

/** Windows of 60 minutes holding inbound messages from ≥ 2 channel accounts (DK-39). */
export function multiChannelBands(events: TimelineEvent[]): { from: string; to: string; channels: number }[] {
  const inbound = events.filter((e) => e.kind === 'message' && e.direction === 'in' && e.uid).sort((a, b) => a.at.localeCompare(b.at));
  const out: { from: string; to: string; channels: number }[] = [];
  let i = 0;
  while (i < inbound.length) {
    const t0 = Date.parse(inbound[i]!.at);
    const win = inbound.filter((e, j) => j >= i && Date.parse(e.at) - t0 <= MULTI_CHANNEL_WINDOW_MINUTES * MIN);
    const uids = new Set(win.map((e) => e.uid));
    if (uids.size >= 2) {
      out.push({ from: win[0]!.at, to: win[win.length - 1]!.at, channels: uids.size });
      i += win.length;
    } else i += 1;
  }
  return out;
}

/** "sau 1 phút", "sau 8 phút", "sau 3 giờ", "sau 2 ngày" (at least one minute). */
export function afterText(ms: number): string {
  const m = Math.max(Math.round(ms / MIN), 1);
  if (m < 60) return `sau ${m} phút`;
  const h = Math.round(m / 60);
  if (h < 48) return `sau ${h} giờ`;
  return `sau ${Math.round(h / 24)} ngày`;
}

export const bandRange = (b: { from: string; to: string }) => `${bubbleTime(b.from)}–${bubbleTime(b.to)}`;
