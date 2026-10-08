import type { OutboxItem } from '@vclinks/shared';
import { API_OPS, toApiError, type ApiOp } from '../api';
import type { ApiCallResponse, FbApiCallMessage, FbStatusMessage } from '../messages';
import { startSender } from '../sender';
import { FB_SENDER_KEYS, readSenderConfig } from '../sender-config';
import { outboxProxy, statusPatcher, trackUserActivity } from '../sender-content';
import { createMessengerReader, isMessengerPage, startMessengerWatcher, type FbApi } from './runtime';
import { sendFbToThread } from './sender';
import { FB_STORAGE_KEYS, isFbUid } from './status';

/**
 * Content script on www.messenger.com and www.facebook.com/messages.
 *
 * Reads only what Messenger renders in this tab (reader.ts) and posts it via
 * the background service worker, which holds the API token. Hard rules:
 * never reads document.cookie, localStorage/sessionStorage, Facebook's
 * IndexedDB or any token (fb_dtsg…), never calls Facebook's GraphQL/XHR
 * endpoints, never decrypts. Sending (messenger/sender.ts) is off unless the
 * user turns on "Cho phép gửi tin trên Facebook" in the popup.
 */

const FB_OPS: readonly ApiOp[] = ['getActiveMapping', 'registerAccount', 'ingest', 'ingestThreadNames', 'reportDrift'];

function proxyApi(): FbApi {
  const call = async (op: ApiOp, args: unknown[]) => {
    const msg: FbApiCallMessage = { type: 'vclinks:fb-api', op, args };
    const res = (await chrome.runtime.sendMessage(msg)) as ApiCallResponse | undefined;
    if (!res) throw toApiError(0, 'Không liên lạc được với service worker');
    if (!res.ok) throw toApiError(res.status, res.message);
    return res.data;
  };
  return Object.fromEntries(
    API_OPS.filter((op) => FB_OPS.includes(op)).map((op) => [op, (...args: unknown[]) => call(op, args)]),
  ) as unknown as FbApi;
}

const alive = () => !!chrome.runtime?.id;

const reader = createMessengerReader({
  doc: document,
  loc: location,
  api: proxyApi(),
  ownerOverride: async () => {
    const got = await chrome.storage.local.get(FB_STORAGE_KEYS.ownerOverride);
    const v = got[FB_STORAGE_KEYS.ownerOverride];
    return typeof v === 'string' ? v : null;
  },
  reportStatus: (status) => {
    if (!alive()) return;
    const msg: FbStatusMessage = { type: 'vclinks:fb-status', status };
    chrome.runtime.sendMessage(msg).catch(() => undefined);
  },
  log: (m) => console.info(m),
});

function start() {
  startMessengerWatcher(reader, document, { alive });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

// ---- Dashboard → Messenger sender (off until enabled in the popup) -----------

/** Hard cap per tab, on top of one item per poll: never bulk. */
const MAX_SENDS_PER_HOUR = 20;
const sentAt: number[] = [];
const lastUserActivity = trackUserActivity(document);
const USER_ACTIVE_MS = 15_000;
const isUserActive = () => Date.now() - lastUserActivity() < USER_ACTIVE_MS;

startSender(
  {
    doc: document,
    api: outboxProxy('vclinks:fb-outbox'),
    config: async () => {
      if (!alive() || !isMessengerPage(location)) return { enabled: false, uid: null };
      return readSenderConfig(FB_SENDER_KEYS);
    },
    knownUids: async () => {
      const uid = reader.currentUid();
      return uid ? [uid] : [];
    },
    lastUserActivity,
    onStatus: statusPatcher(FB_SENDER_KEYS),
    log: (m) => console.info(m.replace('VClinks sender', 'VClinks FB sender')),
    notHereError: (uid) => `tài khoản ${uid} không phải tài khoản đang đăng nhập Messenger ở tab này`,
    acceptItem: (item: OutboxItem) => item.channel === 'fb_personal' && isFbUid(item.uid),
    maxPerPoll: 1,
    allowSend: () => {
      const hourAgo = Date.now() - 3_600_000;
      while (sentAt.length && sentAt[0] < hourAgo) sentAt.shift();
      if (sentAt.length >= MAX_SENDS_PER_HOUR) return false;
      sentAt.push(Date.now());
      return true;
    },
    send: async (threadId, text) =>
      sendFbToThread(threadId, text, { doc: document, loc: location, sel: await reader.selectors(), isUserActive }),
  },
  { lockName: 'vclinks-fb-sender', everyMs: 30_000, firstDelayMs: 15_000 },
);
