import {
  DEFAULT_DOM_SELECTORS,
  DEFAULT_FIELD_MAPPING,
  MAX_BATCH_SIZE,
  STREAMS,
  fieldMappingSpecSchema,
  type DomSelectors,
  type FieldMappingSpec,
} from '@vclinks/shared';
import { API_OPS, UnauthorizedError, toApiError, type ApiClient, type ApiOp } from './api';
import { surveyBubbles, unknownDriftKeys } from './dom-survey';
import {
  checkDomHealth,
  collectSidebarNames,
  extractMessages,
  extractThreadNames,
  hasUnreadMark,
  toContentItems,
  type MessageContentPayloadItem,
  type ThreadName,
} from './dom-reader';
import type {
  ApiCallMessage,
  ApiCallResponse,
  CaptureResponse,
  RunFinishedMessage,
  StatusMessage,
  SyncRequest,
  SyncRequestResponse,
} from './messages';
import { countKnownKeys, indexFor, listDatabaseNames, openExistingDb, readTail, uidsFromDbNames } from './reader';
import { pickLoggedIn, toPresence, type AccountPresence } from './account-detect';
import { startContentSender, trackUserActivity } from './sender-content';
import { startFetcher, type FetcherApi } from './fetcher';
import { ERR, openConversation } from './sender';
import { startAutoSync, type AutoSyncBlock, type OpenOutcome } from './autosync';
import { AUTOSYNC_PLAN_LIMIT } from '@vclinks/shared';
import type { FetchCall } from './messages';
import {
  BACKFILL_PROGRESS_KEY,
  BACKFILL_START,
  BACKFILL_STOP,
  runBackfill,
  type BackfillDeps,
  type BackfillProgress,
  type BackfillStartResponse,
  type BackfillStopResponse,
} from './backfill';
import { runLightSync, runSync } from './sync';
import {
  AcceptedTally,
  POLL_TAIL_SIZE,
  TailTracker,
  UnmatchedRetryQueue,
  createPoller,
  tailSignature,
  unmatchedInAll,
  type TailFields,
} from './quick-sync';
import { blobPhotosOf, createMediaUploader } from './media-upload';
import { readFriendList } from './contact-reader';
import { readFriendRequests } from './friend-request-reader';

/**
 * Content script on chat.zalo.me. It shares the page origin's IndexedDB, reads it
 * (read-only) and maps records with the shared mapping. All API calls are proxied
 * to the background service worker, which holds the token and does the fetch.
 * Never touches cookies or localStorage; never logs record contents.
 */

function proxyClient(): ApiClient {
  const call = async (op: ApiOp, args: unknown[]) => {
    const msg: ApiCallMessage = { type: 'vclinks:api', op, args };
    const res = (await chrome.runtime.sendMessage(msg)) as ApiCallResponse | undefined;
    if (!res) throw toApiError(0, 'Không liên lạc được với service worker');
    if (!res.ok) throw toApiError(res.status, res.message);
    return res.data;
  };
  return Object.fromEntries(
    API_OPS.map((op) => [op, (...args: unknown[]) => call(op, args)]),
  ) as unknown as ApiClient;
}

let running = false;

async function run(req: SyncRequest): Promise<void> {
  const finished: RunFinishedMessage = {
    type: 'vclinks:run-finished',
    ok: false,
    authError: false,
    error: null,
    mappingVersion: null,
    accountsFound: null,
  };
  try {
    // `running` is already set, so no new light sync starts; let one in flight finish.
    while (lightRunning) await sleep(200);
    const summary = await runSync({
      api: proxyClient(),
      idb: indexedDB,
      full: req.full,
      priorAccepted: acceptedTally.take(),
      extensionVersion: req.extensionVersion,
      onProgress: (account) => {
        const msg: StatusMessage = { type: 'vclinks:status', account };
        chrome.runtime.sendMessage(msg).catch(() => undefined);
      },
      log: (m) => console.info(m),
    });
    finished.ok = true;
    finished.mappingVersion = summary.mappingVersion;
    finished.accountsFound = summary.uids.length;
    // Conversations synced from IndexedDB carry encrypted names; the sidebar is
    // the plaintext source. Walk it fully only while nobody is looking at the tab.
    try {
      await (document.visibilityState === 'hidden' ? captureNames(true) : captureVisibleNames());
    } catch (e) {
      console.warn('VClinks: name capture after sync failed:', (e instanceof Error ? e.message : String(e)).slice(0, 200));
    }
    // Friend list (Danh bạ): walked at most every CONTACTS_EVERY_MS, only while nobody uses the tab.
    try {
      await captureContacts(false);
    } catch (e) {
      console.warn('VClinks: contact capture after sync failed:', (e instanceof Error ? e.message : String(e)).slice(0, 200));
    }
    // Friend requests (Danh bạ → Lời mời kết bạn): read every sync cycle, same idle rules.
    try {
      await captureFriendRequests(false);
    } catch (e) {
      console.warn('VClinks: friend request capture after sync failed:', (e instanceof Error ? e.message : String(e)).slice(0, 200));
    }
  } catch (e) {
    finished.authError = e instanceof UnauthorizedError;
    finished.error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.warn('VClinks: sync failed:', finished.error);
  } finally {
    running = false;
    await chrome.runtime.sendMessage(finished).catch(() => undefined);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Active mapping, refreshed every few minutes so newly approved DOM selectors
 * apply without reloading the page or the extension.
 */
const MAPPING_TTL_MS = 5 * 60_000;
/** version 0 = not loaded from the API yet (built-in defaults in use). */
let cachedMapping: { version: number; spec: FieldMappingSpec; dom: DomSelectors; at: number } | null = null;
let lastHealthCheck = 0;
async function activeMapping() {
  if (cachedMapping && Date.now() - cachedMapping.at < MAPPING_TTL_MS) return cachedMapping;
  try {
    const record = await proxyClient().getActiveMapping();
    const spec = fieldMappingSpecSchema.parse(record.spec);
    if (cachedMapping && cachedMapping.version !== record.version) {
      console.info(`VClinks: mapping v${cachedMapping.version} → v${record.version}`);
      lastHealthCheck = 0; // re-check the DOM against the new selectors
    }
    cachedMapping = { version: record.version, spec, dom: spec.dom ?? DEFAULT_DOM_SELECTORS, at: Date.now() };
  } catch (e) {
    // API unreachable / not configured: keep the last known (or built-in) mapping
    // and retry after the TTL instead of on every DOM mutation.
    cachedMapping = {
      version: cachedMapping?.version ?? 0,
      spec: cachedMapping?.spec ?? DEFAULT_FIELD_MAPPING,
      dom: cachedMapping?.dom ?? DEFAULT_DOM_SELECTORS,
      at: Date.now(),
    };
    if (e instanceof UnauthorizedError) throw e;
  }
  return cachedMapping;
}

/** Zalo account uids in this browser, discovered once from IndexedDB. */
let cachedUids: string[] | null = null;
async function accountUids(): Promise<string[]> {
  if (cachedUids?.length) return cachedUids;
  const { spec } = await activeMapping();
  const prefixes = [...new Set(STREAMS.flatMap((s) => (spec.streams[s] ? [spec.streams[s]!.dbPrefix] : [])))];
  // An empty list is not cached: before the QR login the tab has no zdb_<uid> yet, and
  // caching [] would drop every name and content capture until the tab is reloaded.
  const uids = uidsFromDbNames(await listDatabaseNames(indexedDB), prefixes);
  if (uids.length) cachedUids = uids;
  return uids;
}

async function postToAllAccounts<T extends { matched: number; unmatched: string[] }>(
  items: Record<string, unknown>[],
  send: (uid: string, batch: Record<string, unknown>[]) => Promise<T>,
): Promise<{ matched: number; unmatched: number; unmatchedIds: Set<string> }> {
  let matched = 0;
  let unmatched = 0;
  const perAccount: string[][] = [];
  for (const uid of await accountUids()) {
    const ids: string[] = [];
    for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
      const res = await send(uid, items.slice(i, i + MAX_BATCH_SIZE));
      matched += res.matched;
      unmatched += res.unmatched.length;
      ids.push(...res.unmatched);
    }
    perAccount.push(ids);
  }
  // Posted to every account: an id is unmatched only when no account took it.
  return { matched, unmatched, unmatchedIds: unmatchedInAll(perAccount) };
}

// cliMsgIds whose content was already posted this session, to avoid re-sending.
const postedContent = new Set<string>();

// ---- Fast path (quick-sync.ts): new messages reach the DB within seconds ----
// The periodic alarm runs the full sync only every 15 min. A poll reads the
// last records of every account's `message` store every few seconds, whatever
// conversation is open; when that tail changed, a light sync posts the new
// messages and their conversations. A bubble rendering in the open chat only
// brings the next poll forward. DOM content the API could not attach yet
// (metadata not ingested) waits in a retry queue instead of being lost.

/** Poll soon after a new bubble renders: Zalo writes IndexedDB slightly after the DOM. */
const BUBBLE_NUDGE_MS = 1_500;
/** Poll read timings are logged (ms, counts only) every this many ticks (~5 min when visible). */
const POLL_STATS_EVERY = 75;
const seenBubbles = new Set<string>();
let bubblesSeeded = false;
let lightRunning = false;
const tails = new TailTracker();
const acceptedTally = new AcceptedTally();
const retryQueue = new UnmatchedRetryQueue<MessageContentPayloadItem>();
const pollStats = { ticks: 0, readMsTotal: 0, readMsMax: 0, syncs: 0 };

/** Records bubbles on screen; unseen ones (after the first look) bring the next poll forward. */
function noteNewBubbles(ids: string[]): void {
  const fresh = ids.filter((id) => !seenBubbles.has(id));
  for (const id of fresh) seenBubbles.add(id);
  // The first look only seeds what was already rendered on page load.
  if (!bubblesSeeded) {
    bubblesSeeded = true;
    return;
  }
  if (fresh.length) poller.nudge(BUBBLE_NUDGE_MS);
}

/** Reads the tail of every account's message store; returns the accounts whose tail changed. */
async function changedTails(): Promise<{ uid: string; sig: string }[]> {
  const { spec } = await activeMapping();
  const sm = spec.streams.messages;
  const fields: TailFields = {
    id: sm.fields.msgId ?? 'msgId',
    sentAt: sm.fields.sentAt,
    status: sm.fields.status,
    msgType: sm.fields.msgType,
  };
  const changed: { uid: string; sig: string }[] = [];
  const t0 = performance.now();
  for (const uid of await accountUids()) {
    const db = await openExistingDb(indexedDB, `${sm.dbPrefix}${uid}`);
    if (!db) continue;
    try {
      if (!db.objectStoreNames.contains(sm.store)) continue;
      const index = fields.sentAt ? indexFor(db, sm.store, fields.sentAt) : null;
      const sig = tailSignature(await readTail(db, sm.store, { limit: POLL_TAIL_SIZE, index }), fields);
      if (tails.changed(uid, sig)) changed.push({ uid, sig });
    } finally {
      db.close();
    }
  }
  const ms = performance.now() - t0;
  pollStats.ticks++;
  pollStats.readMsTotal += ms;
  pollStats.readMsMax = Math.max(pollStats.readMsMax, ms);
  if (pollStats.ticks % POLL_STATS_EVERY === 0) {
    console.info(
      `VClinks: poll ${pollStats.ticks} tick(s), tail read avg ${(pollStats.readMsTotal / pollStats.ticks).toFixed(1)} ms, ` +
        `max ${pollStats.readMsMax.toFixed(1)} ms, ${pollStats.syncs} light sync(s)`,
    );
  }
  return changed;
}

/** Set once the automatic sync started (below); tells it that new messages arrived. */
let autoSyncNudge: (() => void) | null = null;

/** Light sync (messages + their conversations). Throws on failure so the poll backs off. */
async function lightSync(): Promise<void> {
  const t0 = performance.now();
  const summary = await runLightSync({ api: proxyClient(), idb: indexedDB });
  pollStats.syncs++;
  let posted = 0;
  let fresh = 0;
  for (const a of summary.accounts) {
    const m = a.streams.messages;
    const c = a.streams.conversations;
    acceptedTally.add(a.uid, 'messages', m?.accepted ?? 0);
    acceptedTally.add(a.uid, 'conversations', c?.accepted ?? 0);
    posted += m?.sent ?? 0;
    fresh += (m?.accepted ?? 0) + (m?.updated ?? 0);
  }
  if (posted) console.info(`VClinks: light sync posted ${posted} message(s) in ${Math.round(performance.now() - t0)} ms`);
  // New metadata landed: content waiting for it can attach now.
  if (fresh) retryQueue.expedite(Date.now());
  // Fast nick (máy Zalo option): open the chats that just got messages and read their content now.
  if (fresh) autoSyncNudge?.();
  const failed = summary.accounts.filter((a) => a.state === 'error');
  if (failed.length) throw new Error(`light sync failed for ${failed.length} account(s)`);
}

/** Posts again the DOM content that came back unmatched, when its retry is due. */
async function retryUnmatched(): Promise<void> {
  const due = retryQueue.due(Date.now());
  if (!due.length) return;
  const api = proxyClient();
  const { unmatchedIds } = await postToAllAccounts(
    due.map((d) => d.item) as unknown as Record<string, unknown>[],
    (uid, batch) => api.ingestContent(uid, batch),
  );
  const { matched, dropped } = retryQueue.settle(due.map((d) => d.id), unmatchedIds, Date.now());
  for (const id of matched) postedContent.add(id);
  // Given up: do not re-post on every re-render (the full sync and backfill still can).
  for (const id of dropped) postedContent.add(id);
  if (matched.length || dropped.length) {
    console.info(`VClinks: content retry attached ${matched.length}, gave up ${dropped.length}`);
  }
}

/** One poll: tail check → light sync when it changed → due content retries. */
async function pollTick(): Promise<void> {
  // A full run reads everything anyway; the next poll picks up after it.
  if (running || lightRunning) return;
  lightRunning = true;
  try {
    const changed = await changedTails();
    if (changed.length) {
      await lightSync();
      for (const c of changed) tails.commit(c.uid, c.sig);
    }
  } finally {
    lightRunning = false;
  }
  try {
    await retryUnmatched();
  } catch (e) {
    console.warn('VClinks: content retry failed:', (e instanceof Error ? e.message : String(e)).slice(0, 200));
  }
  const next = retryQueue.nextDueIn(Date.now());
  if (next !== null) poller.nudge(next);
}

const poller = createPoller({
  tick: async () => {
    try {
      await pollTick();
    } catch (e) {
      console.warn('VClinks: quick sync failed:', (e instanceof Error ? e.message : String(e)).slice(0, 200));
      throw e; // backoff
    }
  },
  hidden: () => document.visibilityState === 'hidden',
  // After an extension reload this old copy is orphaned; stop quietly.
  alive: () => !!chrome.runtime?.id,
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') poller.nudge(0);
});

/** Photos Zalo shows only as blob: URLs: read right away, uploaded one at a time. */
const mediaUploader = createMediaUploader({
  // The object URL belongs to chat.zalo.me; the content script shares that origin.
  read: async (url) => (await fetch(url)).blob(),
  uids: accountUids,
  upload: (body) => proxyClient().ingestMedia!(body),
  log: (m) => console.info(m),
});

/**
 * Reads messages rendered in the open conversation and posts their content
 * (joined to metadata by cliMsgId on the backend). Only reads what is on screen:
 * never opens or scrolls another conversation (which would mark chats read),
 * never decrypts. With `onlyNew`, skips cliMsgIds already posted this session —
 * used by the passive watcher so re-renders do not re-post.
 */
async function capture(onlyNew = false): Promise<CaptureResponse> {
  const { dom } = await activeMapping();
  await maybeCheckDom(dom);
  let msgs = extractMessages(document, dom);
  // Photo-only bubbles carry no postable content; the uploader dedups by itself.
  mediaUploader.add(blobPhotosOf(msgs));
  if (onlyNew) noteNewBubbles(msgs.map((m) => m.cliMsgId));
  if (onlyNew) msgs = msgs.filter((m) => !postedContent.has(m.cliMsgId) && !retryQueue.has(m.cliMsgId));
  const items = toContentItems(msgs, Date.now());
  if (!items.length) return { ok: false, reason: 'none' };
  const api = proxyClient();
  const { matched, unmatched, unmatchedIds } = await postToAllAccounts(
    items as unknown as Record<string, unknown>[],
    (uid, batch) => api.ingestContent(uid, batch),
  );
  // Unmatched content (metadata not ingested yet) is not "posted": it is retried.
  for (const it of items) if (!unmatchedIds.has(it.cliMsgId)) postedContent.add(it.cliMsgId);
  const waiting = items.filter((it) => unmatchedIds.has(it.cliMsgId));
  if (waiting.length) {
    retryQueue.add(waiting.map((it) => ({ id: it.cliMsgId, item: it })), Date.now());
    poller.nudge(retryQueue.nextDueIn(Date.now()) ?? 0);
  }
  console.info(`VClinks: captured ${items.length} message(s), matched ${matched}, waiting ${waiting.length}`);
  return { ok: true, captured: items.length, matched, unmatched };
}

// Sidebar items already posted this session (serialized), so passive re-renders
// only send names, avatars, badges or labels that actually changed.
const postedNames = new Map<string, string>();

/** Posts sidebar names to every account; with `onlyChanged`, skips unchanged items. */
async function postNames(names: ThreadName[], onlyChanged: boolean): Promise<CaptureResponse> {
  const items = onlyChanged ? names.filter((n) => postedNames.get(n.threadId) !== JSON.stringify(n)) : names;
  if (!items.length) return { ok: false, reason: 'none' };
  const api = proxyClient();
  const { matched, unmatched } = await postToAllAccounts(
    items as unknown as Record<string, unknown>[],
    (uid, batch) => api.ingestThreadNames(uid, batch),
  );
  for (const n of items) postedNames.set(n.threadId, JSON.stringify(n));
  console.info(`VClinks: read ${items.length} conversation name(s), matched ${matched}`);
  return { ok: true, captured: items.length, matched, unmatched };
}

/**
 * Reads every conversation name from the sidebar list, walking the whole
 * virtual list one viewport at a time. Scrolling the sidebar never opens a
 * conversation, so no chat is marked read. `onlyChanged` (automatic runs) posts
 * only what differs from the last post; the popup button re-posts everything.
 */
async function captureNames(onlyChanged = false): Promise<CaptureResponse> {
  const { dom } = await activeMapping();
  const names = await collectSidebarNames(document, dom, { sleep });
  if (!names.length) return { ok: false, reason: 'none' };
  return postNames(names, onlyChanged);
}

/**
 * Passive counterpart: the sidebar items currently on screen, without scrolling.
 * Runs with the auto-capture watcher, so a conversation that appears or is
 * renamed gets its plaintext name without anyone pressing the popup button.
 */
async function captureVisibleNames(): Promise<CaptureResponse> {
  const { dom } = await activeMapping();
  return postNames(extractThreadNames(document, dom), true);
}

// ---- Danh bạ (contact-reader.ts): the Zalo Web friend list, plaintext names ----

/** Automatic friend-list walks are spaced this far apart (the popup-free manual run is not). */
const CONTACTS_EVERY_MS = 30 * 60_000;
/** Longest wait for the shared UI lock on a manual run. */
const CONTACTS_LOCK_WAIT_MS = 60_000;
let lastContactsAt = 0;
let contactsRunning = false;

/**
 * Reads the friend list of the logged-in account and posts it to
 * /api/contacts/:uid/dom. It switches Zalo Web to the Danh bạ tab for a few
 * seconds, so automatic runs need an idle tab and take the same UI lock as the
 * sender, Dashboard fetches and the automatic sync; any input stops the walk.
 * `manual` (message `vclinks:capture-contacts`) skips the spacing and idle checks.
 */
async function captureContacts(manual: boolean): Promise<CaptureResponse> {
  if (contactsRunning) return { ok: false, reason: 'busy' };
  if (!manual) {
    if (Date.now() - lastContactsAt < CONTACTS_EVERY_MS) return { ok: false, reason: 'none' };
    if (backfillCtl || dashboardWaiting || Date.now() - lastAnyActivity() < AUTOSYNC_IDLE_MS) {
      return { ok: false, reason: 'busy' };
    }
  }
  const uid = (await detectAccounts()).find((a) => a.loggedIn === true)?.uid;
  if (!uid) return { ok: false, reason: 'error', message: 'Chưa xác định được nick đang đăng nhập Zalo Web' };
  contactsRunning = true;
  let res: CaptureResponse = { ok: false, reason: 'busy' };
  try {
    const job = async () => {
      lastContactsAt = Date.now();
      const startedAt = Date.now();
      const read = await readFriendList({
        doc: document,
        sleep,
        shouldStop: manual ? undefined : () => lastAnyActivity() > startedAt,
      });
      if (!read.ok) {
        res = { ok: false, reason: 'error', message: read.error };
        return;
      }
      const api = proxyClient();
      const walkId = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      let matched = 0;
      let unmatched = 0;
      const batches = Math.max(1, Math.ceil(read.items.length / MAX_BATCH_SIZE));
      for (let b = 0; b < batches; b++) {
        const r = await api.ingestContactsDom!(uid, {
          walkId,
          ...(read.friendCount != null ? { friendCount: read.friendCount } : {}),
          complete: read.complete,
          last: b === batches - 1,
          items: read.items.slice(b * MAX_BATCH_SIZE, (b + 1) * MAX_BATCH_SIZE) as unknown as Record<string, unknown>[],
        });
        matched += r.matched;
        unmatched += r.unmatched;
      }
      console.info(
        `VClinks: friend list ${read.items.length}/${read.friendCount ?? '?'} row(s)${read.complete ? '' : ' (partial)'}, matched ${matched}, unmatched ${unmatched}`,
      );
      res = { ok: true, captured: read.items.length, matched, unmatched };
    };
    const locks = navigator.locks;
    if (!locks) await job();
    else if (manual) await locks.request('vclinks-sender', { signal: AbortSignal.timeout(CONTACTS_LOCK_WAIT_MS) }, job);
    else {
      await locks.request('vclinks-sender', { ifAvailable: true }, async (lock) => {
        if (lock) await job();
      });
    }
  } finally {
    contactsRunning = false;
  }
  return res;
}

// ---- Lời mời kết bạn (friend-request-reader.ts): received and sent requests ----

/** Automatic reads are spaced this far apart (a manual run is not). */
const REQUESTS_EVERY_MS = 2 * 60_000;
let lastRequestsAt = 0;
let requestsRunning = false;

/**
 * Reads Danh bạ → Lời mời kết bạn and posts both lists to
 * /api/contacts/:uid/friend-requests/dom. Like captureContacts it switches the
 * Zalo Web tab for a few seconds, so automatic runs need an idle tab and the
 * shared UI lock; any input stops the walk. It never presses a request button.
 */
async function captureFriendRequests(manual: boolean): Promise<CaptureResponse> {
  if (requestsRunning || contactsRunning) return { ok: false, reason: 'busy' };
  if (!manual) {
    if (Date.now() - lastRequestsAt < REQUESTS_EVERY_MS) return { ok: false, reason: 'none' };
    if (backfillCtl || dashboardWaiting || Date.now() - lastAnyActivity() < AUTOSYNC_IDLE_MS) return { ok: false, reason: 'busy' };
  }
  const uid = (await detectAccounts()).find((a) => a.loggedIn === true)?.uid;
  if (!uid) return { ok: false, reason: 'error', message: 'Chưa xác định được nick đang đăng nhập Zalo Web' };
  requestsRunning = true;
  let res: CaptureResponse = { ok: false, reason: 'busy' };
  try {
    const job = async () => {
      lastRequestsAt = Date.now();
      const startedAt = Date.now();
      const read = await readFriendRequests({ doc: document, sleep, shouldStop: manual ? undefined : () => lastAnyActivity() > startedAt });
      if (!read.ok) {
        res = { ok: false, reason: 'error', message: read.error };
        return;
      }
      const api = proxyClient();
      let captured = 0;
      for (const direction of ['received', 'sent'] as const) {
        const list = read[direction];
        const r = await api.ingestFriendRequestsDom!(uid, {
          direction,
          ...(list.count != null ? { count: list.count } : {}),
          complete: list.complete,
          items: list.items.slice(0, MAX_BATCH_SIZE) as unknown as Record<string, unknown>[],
        });
        captured += r.stored;
      }
      console.info(`VClinks: friend requests received ${read.received.items.length}/${read.received.count ?? '?'}, sent ${read.sent.items.length}/${read.sent.count ?? '?'}`);
      res = { ok: true, captured, matched: captured, unmatched: 0 };
    };
    const locks = navigator.locks;
    if (!locks) await job();
    else if (manual) await locks.request('vclinks-sender', { signal: AbortSignal.timeout(CONTACTS_LOCK_WAIT_MS) }, job);
    else {
      await locks.request('vclinks-sender', { ifAvailable: true }, async (lock) => {
        if (lock) await job();
      });
    }
  } finally {
    requestsRunning = false;
  }
  return res;
}

/** Page load time; the sidebar may render late, so skip health checks right after load. */
const loadedAt = Date.now();
const HEALTH_GRACE_MS = 30_000;
const HEALTH_EVERY_MS = 10 * 60_000;

/**
 * Checks the selectors against the rendered page at most every 10 minutes and
 * reports a `dom_selectors` drift when they no longer fit, so Claude can
 * propose new selectors (propose_field_mapping) — no extension rebuild needed.
 * Only structural hints (attribute names/values) are sent, never message text.
 */
async function maybeCheckDom(dom: DomSelectors): Promise<void> {
  const now = Date.now();
  if (now - loadedAt < HEALTH_GRACE_MS || now - lastHealthCheck < HEALTH_EVERY_MS) return;
  lastHealthCheck = now;
  await reportUnknownBubbles(dom);
  const health = checkDomHealth(document, dom);
  if (!health.broken.length) return;
  const { version } = await activeMapping();
  if (!version) return; // mapping not loaded from the API: cannot attribute the drift
  const api = proxyClient();
  // Sidebar selectors feed conversation names; bubble selectors feed message content.
  const stream = health.broken.includes('threadIdAttr') && !health.broken.includes('text') ? 'conversations' : 'messages';
  for (const uid of await accountUids()) {
    await api
      .reportDrift({
        uid,
        stream,
        mappingVersion: version,
        kind: 'dom_selectors',
        missing: health.broken,
        observedKeys: health.observedKeys,
        observedStores: [],
        sampleSize: health.bubbles,
        failedCount: health.broken.includes('text') ? health.bubbles : 0,
      })
      .catch(() => undefined);
  }
  console.warn(`VClinks: DOM selectors look broken (${health.broken.join(', ')}), drift reported`);
}

// Unsurveyed bubble signatures already reported during this page's life.
const reportedSignatures = new Set<string>();

/**
 * Reports bubble structures not in `dom.knownBubbles` (voice, video… until
 * surveyed) as a `dom_selectors` drift. Their content is not stored (see
 * toContentItems); the skeleton sent holds structure only, never text/values.
 */
async function reportUnknownBubbles(dom: DomSelectors): Promise<void> {
  const survey = surveyBubbles(document, dom);
  survey.unknown = survey.unknown.filter((g) => !reportedSignatures.has(g.signature));
  if (!survey.unknown.length) return;
  const { version } = await activeMapping();
  if (!version) return;
  const api = proxyClient();
  for (const uid of await accountUids()) {
    await api
      .reportDrift({
        uid,
        stream: 'messages',
        mappingVersion: version,
        kind: 'dom_selectors',
        missing: ['knownBubbles'],
        observedKeys: unknownDriftKeys(survey),
        observedStores: [],
        sampleSize: Object.values(survey.counts).reduce((a, b) => a + b, 0),
        failedCount: survey.counts.unknown ?? 0,
      })
      .catch(() => undefined);
  }
  for (const g of survey.unknown) reportedSignatures.add(g.signature);
  console.warn(`VClinks: ${survey.unknown.length} unsurveyed bubble structure(s), drift reported`);
}

/**
 * Passive watcher: when the user opens a conversation or a new message renders,
 * capture the newly shown messages automatically. Debounced; only new cliMsgIds
 * are posted. Purely observational — it never opens or scrolls a conversation.
 */
function startAutoCapture() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  const schedule = () => {
    // After an extension reload this old copy is orphaned; stop quietly.
    if (!chrome.runtime?.id) {
      observer.disconnect();
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (inFlight) {
        schedule();
        return;
      }
      inFlight = true;
      try {
        await capture(true);
      } catch (e) {
        console.warn('VClinks: auto-capture failed:', (e instanceof Error ? e.message : String(e)).slice(0, 200));
      }
      try {
        await captureVisibleNames();
      } catch (e) {
        console.warn('VClinks: auto name capture failed:', (e instanceof Error ? e.message : String(e)).slice(0, 200));
      } finally {
        inFlight = false;
      }
    }, 1500);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  schedule(); // capture whatever is already open on load
}

function captureError(e: unknown): CaptureResponse {
  const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
  console.warn('VClinks: capture failed:', message);
  return { ok: false, reason: 'error', message };
}

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  const m = msg as { type?: string };
  if (m?.type === 'vclinks:sync') {
    let res: SyncRequestResponse;
    if (running) res = { accepted: false, reason: 'busy' };
    else {
      running = true;
      res = { accepted: true };
      void run(m as SyncRequest);
    }
    sendResponse(res);
    return;
  }
  if (m?.type === 'vclinks:capture') {
    capture(false).catch(captureError).then(sendResponse);
    return true; // async response
  }
  if (m?.type === 'vclinks:capture-names') {
    captureNames().catch(captureError).then(sendResponse);
    return true; // async response
  }
  if (m?.type === 'vclinks:capture-friend-requests') {
    captureFriendRequests(true).catch(captureError).then(sendResponse);
    return true;
  }
  if (m?.type === 'vclinks:capture-contacts') {
    captureContacts(true).catch(captureError).then(sendResponse);
    return true; // async response
  }
});

// ---- Backfill (§4.4): scroll up the conversation the user already has open ----

let backfillCtl: AbortController | null = null;

/**
 * Backfills the conversation open in this tab; progress goes to
 * chrome.storage.local for the popup. Never throws: failures come back as an
 * `error` progress.
 */
/**
 * `target` (Dashboard fetch requests): the account and the thread were
 * confirmed when the conversation was opened, so bubbles whose metadata is gone
 * from IndexedDB are created from the DOM (/ingest/dom-messages).
 */
/** Per-run overrides (automatic sync, Dashboard fetches). */
type BackfillTuning = Pick<BackfillDeps, 'domOnly' | 'maxScrolls' | 'rateLimited' | 'stopWhenPendingSeen'>;

async function backfill(
  signal: AbortSignal,
  target?: { threadId: string; uid: string },
  tuning: BackfillTuning = {},
): Promise<BackfillProgress> {
  const save = (p: BackfillProgress) => {
    chrome.storage.local.set({ [BACKFILL_PROGRESS_KEY]: p }).catch(() => undefined);
  };
  // Cleared when the API reports bubbles of another conversation: queued photos
  // then stop creating DOM-only messages in `target`.
  let targetOk = true;
  const photoTarget = target ? { ...target, valid: () => targetOk } : undefined;
  try {
    const { dom } = await activeMapping();
    const api = proxyClient();
    const result = await runBackfill({
      root: document,
      dom,
      signal,
      threadId: target?.threadId,
      domOnly: !!target,
      ...tuning,
      onMessages: (msgs) => mediaUploader.add(blobPhotosOf(msgs, photoTarget)),
      onProgress: save,
      rateStore: {
        get: async (k) => (await chrome.storage.local.get(k))[k],
        set: (k, v) => chrome.storage.local.set({ [k]: v }),
      },
      post: async (items) => {
        const batch = items as unknown as Record<string, unknown>[];
        let r: { matched: number; unmatched: number; threadMismatch?: boolean };
        if (target) {
          const res = await api.ingestDomMessages!(target.uid, target.threadId, batch);
          if (res.threadMismatch) targetOk = false;
          r = { matched: res.matched + res.created, unmatched: res.unmatched.length, threadMismatch: res.threadMismatch };
        } else {
          r = await postToAllAccounts(batch, (uid, b) => api.ingestContent(uid, b));
        }
        for (const it of items) postedContent.add(it.cliMsgId);
        return r;
      },
      // Union over accounts: the DOM does not tell which account owns the chat.
      pendingCliMsgIds: async (threadId) => {
        const ids = new Set<string>();
        for (const uid of await accountUids()) {
          const r = await api.getPendingContent!(uid, threadId);
          for (const id of r.cliMsgIds) ids.add(id);
        }
        return [...ids];
      },
    });
    console.info(`VClinks: backfill ${result.state} (${result.reason}), ${result.scrolls} scroll(s), posted ${result.posted}`);
    return result;
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    console.warn('VClinks: backfill failed:', message);
    const now = Date.now();
    const failed: BackfillProgress = {
      state: 'error', reason: 'error', message, threadId: null, scrolls: 0, seen: 0, posted: 0, matched: 0,
      unmatched: 0, pendingTotal: null, pendingSeen: 0, startedAt: now, finishedAt: now,
    };
    save(failed);
    return failed;
  }
}

/** Runs one backfill as "the" backfill of this tab (the popup and the sender see it as busy). */
async function exclusiveBackfill(
  target?: { threadId: string; uid: string },
  tuning?: BackfillTuning,
  outer?: AbortSignal,
): Promise<BackfillProgress> {
  const ctl = new AbortController();
  if (outer) {
    if (outer.aborted) ctl.abort();
    else outer.addEventListener('abort', () => ctl.abort(), { once: true });
  }
  backfillCtl = ctl;
  try {
    return await backfill(ctl.signal, target, tuning);
  } finally {
    if (backfillCtl === ctl) backfillCtl = null;
  }
}

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  const type = (msg as { type?: string })?.type;
  if (type === BACKFILL_START) {
    if (backfillCtl) return sendResponse({ accepted: false, reason: 'busy' } satisfies BackfillStartResponse);
    void exclusiveBackfill();
    sendResponse({ accepted: true } satisfies BackfillStartResponse);
  } else if (type === BACKFILL_STOP) {
    const stopped = !!backfillCtl;
    backfillCtl?.abort();
    sendResponse({ stopped } satisfies BackfillStopResponse);
  }
});

// Start passive auto-capture once the page is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAutoCapture, { once: true });
} else {
  startAutoCapture();
}
// Fast path: poll the message store tail (first tick catches up right away).
poller.start();

// Dashboard → Zalo sender (off until enabled in the popup; see sender.ts).
startContentSender({
  knownUids: accountUids,
  selectors: async () => (await activeMapping()).dom,
  isBusy: () => !!backfillCtl,
});

// Dashboard "open this conversation" → load its content from Zalo Web (fetcher.ts).
async function fetchCall<T>(call: FetchCall): Promise<T> {
  const res = (await chrome.runtime.sendMessage(call)) as ApiCallResponse | undefined;
  if (!res) throw new Error('Không liên lạc được với service worker');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.message}`);
  return res.data as T;
}
/** Sidebar ids sampled to recognise the logged-in account. */
const DETECT_SAMPLE = 12;
const DETECT_TTL_MS = 60_000;
let detected: { at: number; accounts: AccountPresence[] } | null = null;

/**
 * Accounts of this browser, marking the one logged in on this tab: the account
 * whose IndexedDB `conversation` store knows the sidebar's conversation ids
 * (keys only, no record is read). Cached for a minute.
 */
async function detectAccounts(): Promise<AccountPresence[]> {
  if (!chrome.runtime?.id) return []; // orphaned after an extension reload
  if (detected && Date.now() - detected.at < DETECT_TTL_MS) return detected.accounts;
  const uids = await accountUids();
  const { spec, dom } = await activeMapping();
  const conv = spec.streams.conversations;
  const ids = [...new Set([...document.querySelectorAll(`[${dom.threadIdAttr}]`)].map((e) => e.getAttribute(dom.threadIdAttr) ?? ''))]
    .filter(Boolean)
    .slice(0, DETECT_SAMPLE);
  const hits = new Map<string, number | null>();
  for (const uid of uids) {
    const db = await openExistingDb(indexedDB, `${conv.dbPrefix}${uid}`).catch(() => null);
    try {
      hits.set(uid, db ? await countKnownKeys(db, conv.store, conv.fields.threadId ?? 'userId', ids).catch(() => null) : null);
    } finally {
      db?.close();
    }
  }
  const accounts = toPresence(uids, pickLoggedIn(hits, ids.length));
  // Unknown result (sidebar not rendered yet): retry on the next poll.
  if (accounts.some((a) => a.loggedIn != null)) detected = { at: Date.now(), accounts };
  return accounts;
}

/** Longest wait for the UI lock before a Dashboard request gives up this poll (retried next poll). */
const FETCH_LOCK_WAIT_MS = 120_000;
/** True while a Dashboard fetch waits for or holds the UI: the automatic sync yields. */
let dashboardWaiting = false;
/** True while the automatic sync's own backfill runs (it may be preempted). */
let autoSyncRunning = false;

const fetcherApi: FetcherApi = {
  pending: (uid, presence, waitSec) => fetchCall({ type: 'vclinks:fetch', op: 'pending', uid, presence, waitSec }),
  claim: (id) => fetchCall({ type: 'vclinks:fetch', op: 'claim', id }),
  result: (id, result) => fetchCall({ type: 'vclinks:fetch', op: 'result', id, result }),
};

startFetcher(
  {
    api: fetcherApi,
    accounts: detectAccounts,
    open: async (threadId, hint) =>
      openConversation(threadId, {
        doc: document,
        dom: (await activeMapping()).dom,
        confirmByHeader: true,
        name: hint.name,
        confirmCliMsgIds: hint.recentCliMsgIds,
        refuseUnread: true,
        allowUnread: hint.allowUnread === true || autoSyncOpenUnread,
      }),
    // First run scrolls to the start of Zalo Web history; later runs stop once the missing messages were seen.
    backfill: (threadId, uid, { deep }) => exclusiveBackfill({ threadId, uid }, { stopWhenPendingSeen: !deep }),
    tabHidden: () => document.visibilityState === 'hidden',
    // A run of the automatic sync gives way (preempt); a manual popup backfill does not.
    canRun: () => !backfillCtl || autoSyncRunning,
    lastUserActivity: trackUserActivity(document),
    settle: () => sleep(1500),
    log: (m) => console.info(m),
    // Same lock as the sender: one job drives the Zalo UI at a time, across tabs.
    // Waits for it (the automatic sync releases it within a second once preempted).
    withLock: async (fn) => {
      const locks = navigator.locks;
      if (!locks) return fn();
      await locks.request('vclinks-sender', { signal: AbortSignal.timeout(FETCH_LOCK_WAIT_MS) }, fn);
    },
    preempt: (on) => {
      dashboardWaiting = on;
    },
  },
);

// ---- Automatic content sync (autosync.ts): runs while nobody uses the Zalo tab ----

/**
 * chrome.storage.local key: `{ enabled?: boolean, openUnread?: boolean }`; missing = enabled, no unread. `openUnread`
 * (set by the máy Zalo for a nick whose owner accepted it) lets the automatic sync and Dashboard fetches open
 * conversations that still have unread messages, so the sender sees "Đã xem".
 */
const AUTOSYNC_KEY = 'vclinksAutoSync';
/** The tab must have seen no input for this long before a run starts. */
const AUTOSYNC_IDLE_MS = 15_000;

let autoSyncEnabled = true;
let autoSyncOpenUnread = false;
const readAutoSyncConfig = (v: unknown) => {
  const c = v as { enabled?: boolean; openUnread?: boolean } | undefined;
  autoSyncEnabled = c?.enabled !== false;
  autoSyncOpenUnread = c?.openUnread === true;
};
chrome.storage.local
  .get(AUTOSYNC_KEY)
  .then((got) => readAutoSyncConfig(got[AUTOSYNC_KEY]))
  .catch(() => undefined);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[AUTOSYNC_KEY]) readAutoSyncConfig(changes[AUTOSYNC_KEY].newValue);
});

/** Like trackUserActivity, but pointer movement counts too: someone reading the chat stops the run. */
function trackAnyActivity(doc: Document): () => number {
  let last = 0;
  const mark = (e: Event) => {
    if (e.isTrusted) last = Date.now();
  };
  for (const t of ['keydown', 'mousedown', 'mousemove', 'wheel', 'touchstart', 'pointerdown'] as const) {
    doc.addEventListener(t, mark, { capture: true, passive: true });
  }
  return () => last;
}
const lastAnyActivity = trackAnyActivity(document);

async function openForAutoSync(threadId: string, recentCliMsgIds: string[], name?: string): Promise<OpenOutcome> {
  const r = await openConversation(threadId, {
    doc: document,
    dom: (await activeMapping()).dom,
    confirmByHeader: true,
    confirmCliMsgIds: recentCliMsgIds,
    // Fast nick only (search is used only with allowUnread): finds a chat pushed below the rendered sidebar.
    ...(autoSyncOpenUnread && name ? { name } : {}),
    refuseUnread: true,
    allowUnread: autoSyncOpenUnread,
  });
  if (r.ok) return r;
  const code = r.error === ERR.unread ? 'unread' : r.error.startsWith(ERR.notFound) ? 'not_found' : 'error';
  return { ok: false, code, error: r.error };
}

const autoSyncHandle = startAutoSync(
  {
    api: {
      plan: (uid) => proxyClient().autoSyncPlan!(uid, AUTOSYNC_PLAN_LIMIT),
      result: (r) => proxyClient().autoSyncResult!(r),
    },
    loggedInUid: async () => (await detectAccounts()).find((a) => a.loggedIn === true)?.uid ?? null,
    firstPage: () => {
      const dom = cachedMapping?.dom ?? DEFAULT_DOM_SELECTORS;
      return [...document.querySelectorAll(`[${dom.threadIdAttr}]`)]
        .map((el) => ({ threadId: el.getAttribute(dom.threadIdAttr) ?? '', unread: !autoSyncOpenUnread && hasUnreadMark(el) }))
        .filter((s) => s.threadId);
    },
    blocked: (): AutoSyncBlock | null => {
      if (!chrome.runtime?.id || !autoSyncEnabled) return 'disabled';
      if (document.visibilityState === 'hidden') return 'tab_hidden';
      if (backfillCtl || dashboardWaiting) return 'busy';
      if (Date.now() - lastAnyActivity() < AUTOSYNC_IDLE_MS) return 'user_active';
      return null;
    },
    preempted: () => dashboardWaiting,
    fast: () => autoSyncOpenUnread,
    open: (item) => openForAutoSync(item.threadId, item.recentCliMsgIds, item.name),
    capture: async (uid, item, mode, signal) => {
      // Let Zalo render the conversation it just opened before reading it.
      await sleep(1500);
      autoSyncRunning = true;
      try {
        return await exclusiveBackfill(
          { threadId: item.threadId, uid },
          mode === 'screen'
            ? { maxScrolls: 0, rateLimited: false }
            : { rateLimited: false, stopWhenPendingSeen: item.deepDone },
          signal,
        );
      } finally {
        autoSyncRunning = false;
      }
    },
    lastUserActivity: lastAnyActivity,
    log: (m) => console.info(m),
  },
  {
    // Same lock as the sender and Dashboard fetches: one job drives the Zalo UI at a time.
    withLock: async (fn) => {
      const locks = navigator.locks;
      if (!locks) return fn();
      await locks.request('vclinks-sender', { ifAvailable: true }, async (lock) => {
        if (lock) await fn();
      });
    },
  },
);
autoSyncNudge = autoSyncHandle.nudge;
