/**
 * One entry of the append-only event log (BA §2.2 #10). Entries are never
 * updated or deleted. `data` holds ids and counts only, never message content
 * (CLAUDE.md §12.3).
 */
export interface EventInput {
  /** Dotted name, e.g. `ingest.batch`, `outbox.sent`, `token.create`, `account.session_lost`. */
  type: string;
  /** Object the event is about: read back with GET /api/events?kind=&id=. */
  subject: { kind: string; id: string };
  actor: string;
  data?: Record<string, unknown>;
}

export interface EventDoc extends EventInput {
  tenant_id: string;
  at: Date;
}

/** Subject kind of an audit action: the prefix before the first dot (`outbox.claim` → `outbox`). */
export const subjectKindOf = (action: string) => action.split('.')[0] || 'system';
