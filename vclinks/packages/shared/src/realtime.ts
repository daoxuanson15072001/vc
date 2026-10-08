/**
 * Realtime events pushed to the Dashboard over SSE (M1c-07, BA J1). The payload is deliberately minimal:
 * ids and a kind, never message text or contact names (CLAUDE.md §12.3). The client looks up what it
 * needs through the normal, permission-checked API.
 */
export const REALTIME_EVENT_TYPES = [
  /** A customer message reached a conversation (`uid`, `threadId`). */
  'message.new',
  /** Content (text, photo…) of recent messages was captured from Zalo Web after their metadata (`uid`, `threadId`). */
  'message.content',
  /** A command (outbox item) failed to send (`uid`, `threadId`, `id` = suggestion id). */
  'command.failed',
  /** A nick lost its Zalo session (`uid`). */
  'account.red',
  /** A nick got its session back (`uid`). */
  'account.ok',
  /** A notice was written for the user (`id` = notification id, `kind`). */
  'notification',
  /** Someone is typing in a conversation of a direct nick (`uid`, `threadId`, `kind` = the typer's uid): "đang soạn tin…". */
  'typing',
] as const;
export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

export interface RealtimeEvent {
  type: RealtimeEventType;
  id: string;
  at: string;
  uid?: string;
  threadId?: string;
  /** For `notification`: the notice kind (e.g. `sla_breach`), used to pick a sound. */
  kind?: string;
}

/** Path of the SSE stream under `/api`. */
export const REALTIME_STREAM_PATH = '/realtime/stream';
