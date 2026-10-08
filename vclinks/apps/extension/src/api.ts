import type {
  ContactDomResult,
  FriendRequestDomResult,
  AutoSyncPlanItem,
  AutoSyncResult,
  CheckpointResponse,
  DriftReport,
  FieldMappingRecord,
  IngestResult,
  MessageContentResult,
  DomMessagesResult,
  MessageMediaResult,
  MessageMediaUpload,
  RegisterAccountInput,
  Stream,
  SyncReport,
  ThreadNamesResult,
  WhoAmI,
} from '@vclinks/shared';

/** Everything the sync core needs from the VClinks API (injected, so it is testable). */
export interface ApiClient {
  getActiveMapping(): Promise<FieldMappingRecord>;
  registerAccount(input: RegisterAccountInput): Promise<{ uid: string; label: string; created: boolean }>;
  getCheckpoint(uid: string, stream: Stream): Promise<CheckpointResponse>;
  ingest(stream: Stream, uid: string, items: Record<string, unknown>[]): Promise<IngestResult>;
  ingestContent(uid: string, items: Record<string, unknown>[]): Promise<MessageContentResult>;
  ingestThreadNames(uid: string, items: Record<string, unknown>[]): Promise<ThreadNamesResult>;
  reportDrift(report: DriftReport): Promise<{ id: string }>;
  reportSync(report: SyncReport): Promise<{ ok: true }>;
  /** Fetch requests: content of the open thread, creating messages IndexedDB no longer has. Optional for fakes. */
  ingestDomMessages?(uid: string, threadId: string, items: Record<string, unknown>[]): Promise<DomMessagesResult>;
  /** One photo of a message as bytes (Zalo Web has it only as a blob: URL). Optional for fakes. */
  ingestMedia?(body: MessageMediaUpload): Promise<MessageMediaResult>;
  /** cliMsgIds of a thread still missing DOM content (backfill stop condition). Optional for fakes. */
  getPendingContent?(uid: string, threadId: string): Promise<PendingContentResponse>;
  /** Automatic content sync (autosync.ts): conversations still missing content. Optional for fakes. */
  autoSyncPlan?(uid: string, limit?: number): Promise<AutoSyncPlanItem[]>;
  autoSyncResult?(r: AutoSyncResult): Promise<{ ok: true }>;
  /** ContactReader (contact-reader.ts): rows of the Zalo Web friend list. Optional for fakes. */
  ingestContactsDom?(uid: string, body: ContactDomBody): Promise<ContactDomResult>;
  /** FriendRequestReader (friend-request-reader.ts): one list of Lời mời kết bạn. Optional for fakes. */
  ingestFriendRequestsDom?(uid: string, body: FriendRequestDomBody): Promise<FriendRequestDomResult>;
}

/** Body of POST /api/contacts/:uid/friend-requests/dom (friendRequestDomBatchSchema). */
export interface FriendRequestDomBody {
  direction: 'received' | 'sent';
  count?: number;
  complete: boolean;
  items: Record<string, unknown>[];
}

/** Body of POST /api/contacts/:uid/dom (contactDomBatchSchema). */
export interface ContactDomBody {
  walkId: string;
  friendCount?: number;
  complete: boolean;
  last: boolean;
  items: Record<string, unknown>[];
}

export interface PendingContentResponse {
  threadId: string;
  cliMsgIds: string[];
  truncated: boolean;
}

export type ApiOp = keyof ApiClient;
export const API_OPS: readonly ApiOp[] = [
  'getActiveMapping',
  'registerAccount',
  'getCheckpoint',
  'ingest',
  'ingestContent',
  'ingestThreadNames',
  'reportDrift',
  'reportSync',
  'getPendingContent',
  'ingestMedia',
  'ingestDomMessages',
  'autoSyncPlan',
  'autoSyncResult',
  'ingestContactsDom',
  'ingestFriendRequestsDom',
];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Token không hợp lệ') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export function toApiError(status: number, message: string): ApiError {
  return status === 401 ? new UnauthorizedError(message) : new ApiError(status, message);
}

export interface HttpApiClientOptions {
  fetch?: typeof fetch;
  /** Total attempts per call (default 3). */
  retries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retries network errors, 408, 429 and 5xx; other 4xx fail immediately. */
function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Short, content-free error summary from a NestJS error body. */
async function errorMessage(res: Response): Promise<string> {
  let detail = '';
  try {
    const body = (await res.json()) as { message?: unknown };
    const m = body?.message;
    detail = Array.isArray(m) ? m.slice(0, 3).map(String).join('; ') : m != null ? String(m) : '';
  } catch {
    /* non-JSON body */
  }
  return `HTTP ${res.status}${detail ? `: ${detail}` : ''}`.slice(0, 300);
}

/** Real client used by the background service worker (fetch there bypasses page CORS). */
export class HttpApiClient implements ApiClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly retries: number;
  private readonly baseDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    baseUrl: string,
    private readonly token: string,
    opts: HttpApiClientOptions = {},
  ) {
    this.base = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? ((...a) => fetch(...a));
    this.retries = Math.max(1, opts.retries ?? 3);
    this.baseDelayMs = opts.baseDelayMs ?? 1000;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let last: ApiError = new ApiError(0, 'Không kết nối được API');
    for (let attempt = 0; attempt < this.retries; attempt++) {
      if (attempt > 0) await this.sleep(this.baseDelayMs * 2 ** (attempt - 1));
      let res: Response;
      try {
        res = await this.fetchImpl(`${this.base}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (e) {
        last = new ApiError(0, `Không kết nối được API (${(e as Error)?.name ?? 'network'})`);
        continue;
      }
      if (res.ok) return (await res.json()) as T;
      const err = toApiError(res.status, await errorMessage(res));
      if (!isRetryable(res.status)) throw err;
      last = err;
    }
    throw last;
  }

  /** Raw bytes of GET `path` as base64 (for outbox attachments; JSON-safe for extension messages). */
  async download(path: string, maxBytes: number): Promise<{ mime: string; base64: string }> {
    const res = await this.fetchImpl(`${this.base}${path}`, { headers: { Authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw toApiError(res.status, await errorMessage(res));
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new ApiError(413, 'Tệp quá lớn');
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { mime: res.headers.get('content-type') ?? 'application/octet-stream', base64: btoa(s) };
  }

  me(): Promise<WhoAmI> {
    return this.request('GET', '/api/me');
  }
  getActiveMapping(): Promise<FieldMappingRecord> {
    return this.request('GET', '/api/mapping/active');
  }
  registerAccount(input: RegisterAccountInput) {
    return this.request<{ uid: string; label: string; created: boolean }>('POST', '/api/accounts', input);
  }
  getCheckpoint(uid: string, stream: Stream): Promise<CheckpointResponse> {
    return this.request('GET', `/api/checkpoints/${encodeURIComponent(uid)}/${encodeURIComponent(stream)}`);
  }
  ingest(stream: Stream, uid: string, items: Record<string, unknown>[]): Promise<IngestResult> {
    return this.request('POST', `/api/ingest/${encodeURIComponent(stream)}`, { uid, items });
  }
  ingestContent(uid: string, items: Record<string, unknown>[]): Promise<MessageContentResult> {
    return this.request('POST', '/api/ingest/message-content', { uid, items });
  }
  ingestDomMessages(uid: string, threadId: string, items: Record<string, unknown>[]): Promise<DomMessagesResult> {
    return this.request('POST', '/api/ingest/dom-messages', { uid, threadId, items });
  }
  ingestMedia(body: MessageMediaUpload): Promise<MessageMediaResult> {
    return this.request('POST', '/api/ingest/message-media', body);
  }
  ingestThreadNames(uid: string, items: Record<string, unknown>[]): Promise<ThreadNamesResult> {
    return this.request('POST', '/api/ingest/thread-names', { uid, items });
  }
  ingestFriendRequestsDom(uid: string, body: FriendRequestDomBody): Promise<FriendRequestDomResult> {
    return this.request('POST', `/api/contacts/${encodeURIComponent(uid)}/friend-requests/dom`, body);
  }
  ingestContactsDom(uid: string, body: ContactDomBody): Promise<ContactDomResult> {
    return this.request('POST', `/api/contacts/${encodeURIComponent(uid)}/dom`, body);
  }
  reportDrift(report: DriftReport): Promise<{ id: string }> {
    return this.request('POST', '/api/mapping/drift', report);
  }
  reportSync(report: SyncReport): Promise<{ ok: true }> {
    return this.request('POST', '/api/sync/report', report);
  }
  getPendingContent(uid: string, threadId: string): Promise<PendingContentResponse> {
    return this.request(
      'GET',
      `/api/threads/${encodeURIComponent(threadId)}/pending-content?uid=${encodeURIComponent(uid)}`,
    );
  }
  autoSyncPlan(uid: string, limit?: number): Promise<AutoSyncPlanItem[]> {
    const q = new URLSearchParams({ uid });
    if (limit) q.set('limit', String(limit));
    return this.request('GET', `/api/autosync/plan?${q}`);
  }
  autoSyncResult(r: AutoSyncResult): Promise<{ ok: true }> {
    return this.request('POST', '/api/autosync/result', r);
  }
}
