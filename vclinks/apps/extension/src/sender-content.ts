import type { DomSelectors, OutboxItem, OutboxResult } from '@vclinks/shared';
import type { ApiCallResponse } from './messages';
import { startSender, type SenderApi, type SenderStatus } from './sender';
import { sendOutboxItem } from './sender-actions';
import { SENDER_KEYS, readSenderConfig, type SenderKeys } from './sender-config';

/**
 * Content-script wiring of the sender: API proxy through the background worker,
 * config from chrome.storage.local, user-activity guard and popup status.
 * The proxy / status / activity helpers are shared with the Messenger sender.
 */

type OutboxMessageType = 'vclinks:outbox' | 'vclinks:fb-outbox';

async function call<T>(msg: unknown): Promise<T> {
  const res = (await chrome.runtime.sendMessage(msg)) as ApiCallResponse | undefined;
  if (!res) throw new Error('Không liên lạc được với service worker');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.message}`);
  return res.data as T;
}

/** Outbox REST calls proxied through the background (which holds the token). */
export function outboxProxy(type: OutboxMessageType): SenderApi {
  return {
    pending: (uid, waitSec) => call<OutboxItem[]>({ type, op: 'pending', uid, waitSec }),
    claim: (id) => call<OutboxItem>({ type, op: 'claim', id }),
    result: (id, result: OutboxResult) => call({ type, op: 'result', id, result }),
  };
}

/** Serialised read-modify-write of the sender status shown in the popup. */
export function statusPatcher(keys: SenderKeys) {
  let queue: Promise<unknown> = Promise.resolve();
  return (patch: Partial<SenderStatus>, event?: 'sent' | 'failed') => {
    queue = queue
      .then(async () => {
        const got = await chrome.storage.local.get(keys.status);
        const cur = (got[keys.status] as Partial<SenderStatus> | undefined) ?? {};
        const next: Partial<SenderStatus> = { ...cur, ...patch };
        if (event === 'sent') next.sentCount = (cur.sentCount ?? 0) + 1;
        if (event === 'failed') next.failedCount = (cur.failedCount ?? 0) + 1;
        await chrome.storage.local.set({ [keys.status]: next });
      })
      .catch(() => undefined);
  };
}

/**
 * Epoch ms of the last real keystroke/click/scroll/touch in this tab. Only
 * trusted (real) input counts; our own synthetic events are isTrusted=false.
 */
export function trackUserActivity(doc: Document = document): () => number {
  let last = 0;
  const mark = (e: Event) => {
    if (e.isTrusted) last = Date.now();
  };
  for (const t of ['keydown', 'mousedown', 'wheel', 'touchstart'] as const) {
    doc.addEventListener(t, mark, { capture: true, passive: true });
  }
  return () => last;
}

export function startContentSender(opts: {
  knownUids: () => Promise<string[]>;
  selectors: () => Promise<DomSelectors>;
  /** True while another job (e.g. backfill) drives the conversation list. */
  isBusy?: () => boolean;
}): () => void {
  const lastUserActivity = trackUserActivity(document);
  return startSender({
    doc: document,
    api: outboxProxy('vclinks:outbox'),
    config: async () => {
      // After an extension reload this copy is orphaned: stay idle.
      if (!chrome.runtime?.id) return { enabled: false, uid: null };
      if (opts.isBusy?.()) return { enabled: false, uid: null };
      return readSenderConfig(SENDER_KEYS);
    },
    knownUids: opts.knownUids,
    selectors: opts.selectors,
    lastUserActivity,
    // Commands (photos, file, card, poll, @mentions) through Zalo Web's own UI.
    sendItem: (item, deps) =>
      sendOutboxItem(item, {
        ...deps,
        win: window,
        injectFileHook: async () => (await call<boolean>({ type: 'vclinks:outbox', op: 'inject-file-hook' })) === true,
        fetchMedia: async (id) => {
          const r = await call<{ mime: string; base64: string }>({ type: 'vclinks:outbox', op: 'media', id });
          const bin = atob(r.base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return { buffer: bytes.buffer, mime: r.mime.split(';')[0] };
        },
      }),
    focusTab: async () => {
      await chrome.runtime.sendMessage({ type: 'vclinks:focus-tab' });
    },
    onStatus: statusPatcher(SENDER_KEYS),
    log: (m) => console.info(m),
  });
}
