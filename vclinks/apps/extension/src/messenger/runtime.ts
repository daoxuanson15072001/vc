import { MAX_BATCH_SIZE, channelAccountUid, type DriftReport, type Stream } from '@vclinks/shared';
import type { ApiClient } from '../api';
import {
  checkMessengerHealth,
  readActiveThread,
  readOwnerId,
  readSidebar,
  readThreadMessages,
  toContactItems,
  toConversationItems,
  toMessageItems,
  toThreadNameItems,
  type FbSidebarThread,
} from './reader';
import { DEFAULT_MESSENGER_SELECTORS, mergeMessengerSelectors, type MessengerSelectors } from './selectors';
import { isFbUid, type FbAccountStatus } from './status';

/**
 * Messenger reader loop, independent of chrome.* (injected env) so it is
 * unit-tested with happy-dom. It only observes the tab the user has open:
 * reads the rendered sidebar and the open conversation, and posts new/changed
 * items through the background (which holds the token). It never opens,
 * scrolls or clicks anything, and never reads cookies, web storage, IndexedDB
 * or tokens of Facebook.
 */

/** The API calls a Messenger tab may make (the background enforces the same list). */
export type FbApi = Pick<ApiClient, 'getActiveMapping' | 'registerAccount' | 'ingest' | 'ingestThreadNames' | 'reportDrift'>;

export interface MessengerEnv {
  doc: Document;
  loc: { hostname: string; pathname: string };
  api: FbApi;
  /** Owner id typed in the popup (chrome.storage.local), or null. */
  ownerOverride: () => Promise<string | null>;
  reportStatus: (s: FbAccountStatus) => void;
  now?: () => number;
  log?: (m: string) => void;
}

const MAPPING_TTL_MS = 5 * 60_000;
const SIDEBAR_EVERY_MS = 60_000;
const HEALTH_GRACE_MS = 30_000;
const HEALTH_EVERY_MS = 10 * 60_000;
const REDRIFT_MS = 60 * 60_000;
const MAX_REMEMBERED = 20_000;

/** Messenger UI present on this page (facebook.com is an SPA: the script may outlive /messages). */
export function isMessengerPage(loc: { hostname: string; pathname: string }): boolean {
  if (/(^|\.)messenger\.com$/i.test(loc.hostname)) return true;
  return /(^|\.)facebook\.com$/i.test(loc.hostname) && /^\/messages(\/|$)/.test(loc.pathname);
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

/** Content signature used to skip re-posting unchanged items (not an id). */
const sig = (v: unknown) => JSON.stringify(v);

export function createMessengerReader(env: MessengerEnv) {
  const now = env.now ?? Date.now;
  const log = env.log ?? (() => undefined);
  const startedAt = now();

  let mapping: { version: number; sel: MessengerSelectors; at: number } | null = null;
  const registered = new Set<string>();
  const postedMsgs = new Map<string, string>();
  const postedContacts = new Map<string, string>();
  const postedThreads = new Map<string, string>();
  const sidebar = new Map<string, FbSidebarThread>();
  let lastSidebarPost = 0;
  let lastHealth = 0;
  let lastDrift: { key: string; at: number } | null = null;
  let inFlight = false;
  let lastReport: { key: string; at: number } | null = null;

  const status: FbAccountStatus = {
    uid: null,
    ownerSource: null,
    registered: false,
    host: env.loc.hostname,
    updatedAt: new Date(startedAt).toISOString(),
    postedMessages: 0,
    postedThreads: 0,
    unanchored: 0,
    locked: false,
    broken: [],
    lastCaptureAt: null,
    lastError: null,
  };

  async function selectors(): Promise<{ version: number; sel: MessengerSelectors }> {
    if (mapping && now() - mapping.at < MAPPING_TTL_MS) return mapping;
    try {
      const rec = await env.api.getActiveMapping();
      // Approved runtime override of the built-in selectors, once the shared schema carries it.
      const override = (rec.spec as unknown as { messengerDom?: unknown } | undefined)?.messengerDom;
      mapping = { version: rec.version, sel: mergeMessengerSelectors(override), at: now() };
    } catch {
      mapping = { version: mapping?.version ?? 0, sel: mapping?.sel ?? DEFAULT_MESSENGER_SELECTORS, at: now() };
    }
    return mapping;
  }

  /** Manual id (popup) wins: the DOM candidates are unverified and must never pick someone else. */
  async function resolveOwner(sel: MessengerSelectors): Promise<{ uid: string; source: 'dom' | 'manual' } | null> {
    const manual = (await env.ownerOverride().catch(() => null))?.trim();
    if (manual && /^\d{1,25}$/.test(manual)) return { uid: channelAccountUid('fb_personal', manual), source: 'manual' };
    const id = readOwnerId(env.doc, sel);
    return id ? { uid: channelAccountUid('fb_personal', id), source: 'dom' } : null;
  }

  async function ensureAccount(uid: string) {
    if (registered.has(uid)) return;
    await env.api.registerAccount({ uid, label: `Facebook ${uid.slice(3)}`, channel: 'fb_personal' });
    registered.add(uid);
  }

  async function post(stream: Stream, uid: string, items: Record<string, unknown>[]) {
    for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
      await env.api.ingest(stream, uid, items.slice(i, i + MAX_BATCH_SIZE));
    }
  }

  function remember(map: Map<string, string>, key: string, value: string) {
    if (map.size >= MAX_REMEMBERED) map.clear(); // worst case: a harmless idempotent re-post
    map.set(key, value);
  }

  async function syncSidebar(uid: string, sel: MessengerSelectors, force: boolean) {
    for (const t of readSidebar(env.doc, sel)) sidebar.set(t.threadId, t);
    if (!force && now() - lastSidebarPost < SIDEBAR_EVERY_MS) return;
    lastSidebarPost = now();
    const changed = [...sidebar.values()].filter((t) => postedThreads.get(t.threadId) !== sig(t));
    if (!changed.length) return;
    // Conversations first: thread names only join onto existing conversation docs.
    await post('conversations', uid, toConversationItems(changed));
    const names = toThreadNameItems(changed);
    for (let i = 0; i < names.length; i += MAX_BATCH_SIZE) {
      await env.api.ingestThreadNames(uid, names.slice(i, i + MAX_BATCH_SIZE));
    }
    for (const t of changed) remember(postedThreads, t.threadId, sig(t));
    status.postedThreads += changed.length;
  }

  async function syncOpenThread(uid: string, sel: MessengerSelectors) {
    const active = readActiveThread(env.loc);
    if (!active) {
      status.unanchored = 0;
      status.locked = false;
      return;
    }
    const thread = sidebar.get(active.threadId);
    const r = readThreadMessages(env.doc, { threadId: active.threadId, isGroup: thread?.isGroup ?? false, now: now() }, sel);
    status.unanchored = r.unanchored;
    status.locked = r.locked;

    const msgs = toMessageItems(r).filter((m) => postedMsgs.get(m.msgId as string) !== sig(m));
    if (msgs.length) {
      await post('messages', uid, msgs);
      for (const m of msgs) remember(postedMsgs, m.msgId as string, sig(m));
      status.postedMessages += msgs.length;
      status.lastCaptureAt = new Date(now()).toISOString();
    }
    const contacts = toContactItems(r, thread).filter((c) => postedContacts.get(c.userId as string) !== sig(c));
    if (contacts.length) {
      await post('contacts', uid, contacts);
      for (const c of contacts) remember(postedContacts, c.userId as string, sig(c));
    }
  }

  async function maybeHealth(uid: string | null, sel: MessengerSelectors, version: number) {
    const t = now();
    if (t - startedAt < HEALTH_GRACE_MS || t - lastHealth < HEALTH_EVERY_MS) return;
    lastHealth = t;
    const h = checkMessengerHealth(env.doc, env.loc, sel, { ownerKnown: !!uid, now: t });
    status.broken = h.broken;
    if (!h.broken.length || !uid || !version) return; // drift needs an account and a mapping version
    const key = h.broken.join(',');
    if (lastDrift && lastDrift.key === key && t - lastDrift.at < REDRIFT_MS) return;
    const sidebarOnly = h.broken.every((k) => k === 'sidebarThreadLink' || k === 'ownProfileLink');
    const report: DriftReport = {
      uid,
      stream: sidebarOnly ? 'conversations' : 'messages',
      mappingVersion: version,
      kind: 'dom_selectors',
      // Prefixed so Claude/Dashboard can tell Messenger keys from Zalo `spec.dom` keys.
      missing: h.broken.map((k) => `messenger.${k}`),
      observedKeys: h.observedKeys,
      observedStores: [],
      sampleSize: h.rows,
      failedCount: h.broken.length,
    };
    await env.api.reportDrift(report);
    lastDrift = { key, at: t };
    log(`VClinks FB: DOM selectors look broken (${key}), drift reported`);
  }

  /** One observation pass. Never throws; errors land in the status. */
  async function cycle(opts: { forceSidebar?: boolean } = {}): Promise<void> {
    if (inFlight || !isMessengerPage(env.loc)) return;
    inFlight = true;
    try {
      const { version, sel } = await selectors();
      const owner = await resolveOwner(sel);
      status.uid = owner?.uid ?? null;
      status.ownerSource = owner?.source ?? null;
      status.lastError = null;
      if (!owner || !isFbUid(owner.uid)) {
        status.lastError = 'Chưa xác định được tài khoản Facebook (nhập ID trong popup)';
        await maybeHealth(null, sel, version).catch(() => undefined);
        return;
      }
      await ensureAccount(owner.uid);
      status.registered = true;
      await syncSidebar(owner.uid, sel, !!opts.forceSidebar);
      await syncOpenThread(owner.uid, sel);
      await maybeHealth(owner.uid, sel, version).catch((e) => log(`VClinks FB: drift report failed: ${errText(e)}`));
    } catch (e) {
      status.lastError = errText(e);
      log(`VClinks FB: capture failed: ${status.lastError}`);
    } finally {
      inFlight = false;
      status.host = env.loc.hostname;
      // Messenger's DOM churns constantly: report on change, or every 30 s as a heartbeat.
      const key = sig({ ...status, updatedAt: '' });
      if (!lastReport || lastReport.key !== key || now() - lastReport.at >= 30_000) {
        status.updatedAt = new Date(now()).toISOString();
        env.reportStatus({ ...status, broken: [...status.broken] });
        lastReport = { key, at: now() };
      }
    }
  }

  return {
    cycle,
    status: () => ({ ...status }),
    currentUid: () => status.uid,
    selectors: async () => (await selectors()).sel,
  };
}

export type MessengerReader = ReturnType<typeof createMessengerReader>;

/**
 * Passive watcher: re-reads after DOM changes (debounced) and every minute.
 * Purely observational. Returns a stop function.
 */
export function startMessengerWatcher(
  reader: MessengerReader,
  doc: Document,
  opts: { debounceMs?: number; everyMs?: number; alive?: () => boolean } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const alive = opts.alive ?? (() => true);
  const schedule = () => {
    if (!alive()) {
      stop();
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void reader.cycle(), opts.debounceMs ?? 2000);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
  const interval = setInterval(() => (alive() ? void reader.cycle({ forceSidebar: true }) : stop()), opts.everyMs ?? 60_000);
  schedule();
  function stop() {
    observer.disconnect();
    clearInterval(interval);
    if (timer) clearTimeout(timer);
  }
  return stop;
}
