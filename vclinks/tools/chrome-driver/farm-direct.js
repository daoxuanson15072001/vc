// Direct mode of the máy Zalo: one zca-js session per nick instead of a Chrome
// (docs/01-quan-ly-du-an/ke-hoach-zalo-truc-tiep-zca-js.md).
//
// Session: cookie, imei and userAgent live only in <farmDir>/<slot>/session.enc, AES-256-GCM with
// ZALO_FARM_SESSION_KEY (CLAUDE.md §12.2, second exception). Never logged, never sent to the VClinks API.
// zca-js is pinned in tools/chrome-driver/farm/direct (package-lock.json); its update check and its logger are off.
//
// Receive (P2): every message, recall and reaction the listener delivers goes to /api/ingest/* (the extension's
// endpoints and schemas), batched; friends and groups at login and on a timer. Ingest starts once the API bound
// the nick to the slot (registry uid = logged-in uid). A cursor per nick (newest msgId per kind, ids only) lets a
// reconnect ask Zalo for what arrived meanwhile (requestOldMessages).
// Send (P3): once the nick is bound, approved outbox items are claimed and sent with zca-js right away (no per-nick
// send switch since 06/10/2026, dev002), then reported with the cliMsgId of the listener's echo.
// Logs carry ids, kinds and counts only: never message content, names, phone numbers or links (§12.3).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const map = require('./farm-direct-map');

const SESSION_FILE = 'session.enc';
const CURSOR_FILE = 'cursor.json';
const PROBE_FILE = 'probe.jsonl';
const PROBE_MAX_LINES = 5000;
const MAGIC = Buffer.from('ZS1');
const { USER, GROUP } = map;
/** zca-js CloseReason: another Zalo Web took the session / Zalo kicked it. */
const DUPLICATE = 3000;
const KICK = 3003;

/** Batch size of one ingest call (API limit 500) and the most items one stream keeps while the API is away. */
const BATCH_MAX = 500;
const QUEUE_MAX = 5000;
/** Messages kept in memory per nick: exact quote of a reply, msgId of a reaction target. */
const RECENT_MAX = 3000;
const GROUP_INFO_CHUNK = 50;
/**
 * Version of the zca-js → VClinks mapping (farm-direct-map.js). When it changes, the next connect asks Zalo again for
 * everything it still holds for this session (the cursor of an older mapping is ignored), so stored messages are
 * re-ingested with the new mapping. 2: calls, recalls in catch-up pages, text/content always sent; 3: sticker images,
 * own messages "Đã gửi" (06/10/2026).
 */
const MAP_VERSION = 3;
/** Pages of requestOldMessages per kind after one reconnect. */
const CATCHUP_MAX_PAGES = 40;
const MEDIA_MAX_BYTES = 10 * 1024 * 1024 + 1024;
const POLL_WAIT_SEC = 20;

const DEFAULT_TIMING = {
  flushDelayMs: 300,
  retryMaxMs: 60_000,
  firstSyncMs: 2000,
  groupsEveryMs: 30 * 60_000,
  friendsEveryMs: 6 * 60 * 60_000,
  userInfoDelayMs: 10_000,
  groupInfoGapMs: 2000,
  sendIdleMs: 3000,
  sendGapMs: 1500,
  echoWaitMs: 8000,
  pollErrorMs: 5000,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;

// ------------------------------------------------------------------ pure helpers (unit-tested)

function sessionKey(hex) {
  if (!/^[0-9a-f]{64}$/i.test(String(hex || ''))) throw new Error('ZALO_FARM_SESSION_KEY must be 64 hex characters (32 bytes)');
  return Buffer.from(hex, 'hex');
}

/** AES-256-GCM: magic | iv(12) | tag(16) | ciphertext. */
function encryptSession(obj, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), data]);
}

function decryptSession(buf, key) {
  if (!Buffer.isBuffer(buf) || buf.length < 32 || !buf.subarray(0, 3).equals(MAGIC)) throw new Error('not a session file');
  const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(3, 15));
  d.setAuthTag(buf.subarray(15, 31));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(31)), d.final()]).toString('utf8'));
}

/** What the API sees for one direct slot (same shape as a Chrome slot: page / view / qr / uids). */
function stateOf(rt, wantQr) {
  if (!rt || rt.phase === 'starting') return { page: 'down', uids: [] };
  if (rt.phase === 'qr' || rt.phase === 'expired' || rt.phase === 'scanned') {
    return {
      page: 'login',
      view: rt.phase,
      qr: wantQr && rt.phase === 'qr' ? rt.qr : null,
      uids: [],
      ...(rt.declinedAt && Date.now() - rt.declinedAt < 60_000 ? { note: 'declined' } : {}),
    };
  }
  if (rt.phase === 'online') return { page: 'chat', uids: rt.uid ? [rt.uid] : [] };
  if (rt.phase === 'lost') return { page: 'down', uids: rt.uid ? [rt.uid] : [], lost: lostReason(rt.closeCode) };
  return { page: 'down', uids: [], ...(rt.error ? { error: rt.error } : {}) };
}

/** Session report reason for a closed listener. */
function lostReason(code) {
  return code === DUPLICATE || code === KICK ? 'duplicate_web' : 'direct_down';
}

/** Newer of two Zalo msgIds (numeric strings); null-safe. */
function maxId(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  try {
    return BigInt(b) > BigInt(a) ? b : a;
  } catch {
    return a;
  }
}

/** Queue key of an ingest item. */
function itemKey(stream, item) {
  if (stream === 'groups') return item.groupId;
  if (stream === 'contacts') return item.userId;
  return item.msgId;
}

/** Kept when the same nick's session is restarted: what is still queued and what is already known. */
const CARRY_OVER = ['q', 'recent', 'byCli', 'groupVers', 'friends', 'knownUsers'];

const newQueue = () => ({ groups: new Map(), contacts: new Map(), messages: new Map(), recalls: new Map(), reactions: [], statuses: [] });
/** Flush order: names and groups before messages (a group's conversation is typed from `groups`), events last. */
const STREAM_ORDER = ['groups', 'contacts', 'messages', 'recalls', 'reactions', 'statuses'];
/** Queues kept in arrival order (events, not records): every item goes out. */
const EVENT_STREAMS = new Set(['reactions', 'statuses']);
/** Where each queue goes: recalls are messages again, statuses have their own route. */
const INGEST_PATH = { recalls: '/api/ingest/messages', statuses: '/api/ingest/message-status' };
/** Zalo's sticker search, kept per keyword for an hour (the composer asks again on every opening). */
const STICKER_CACHE_MS = 60 * 60_000;

// ------------------------------------------------------------------ sessions

class DirectSessions {
  /**
   * @param cfg { farmDir, sessionKeyHex, api, token, timing? }
   * @param log (msg) => void — never pass message content, names, cookies to it
   * @param hooks { slotOf(id) → the agent's slot record (uid once bound), fetch? (tests) }
   */
  constructor(cfg, log, hooks = {}) {
    this.cfg = cfg;
    this.log = log;
    this.slotOf = hooks.slotOf || (() => undefined);
    this.fetchImpl = hooks.fetch || ((...a) => fetch(...a));
    this.t = { ...DEFAULT_TIMING, ...(cfg.timing || {}) };
    this.rt = new Map();
    this.key = null;
  }

  zca() {
    // Lazy: the unit tests and Chrome slots never load the library.
    if (!this.lib) this.lib = createRequire(path.join(__dirname, 'farm', 'direct', 'package.json'))('zca-js');
    return this.lib;
  }

  keyBuf() {
    if (!this.key) this.key = sessionKey(this.cfg.sessionKeyHex);
    return this.key;
  }

  dir(id) {
    return path.join(this.cfg.farmDir, id);
  }

  writePrivate(id, name, data) {
    fs.mkdirSync(this.dir(id), { recursive: true, mode: 0o700 });
    // A directory made earlier (Chrome slot) keeps its mode with mkdirSync: owner only here as well.
    if (process.platform !== 'win32') fs.chmodSync(this.dir(id), 0o700);
    const file = path.join(this.dir(id), name);
    fs.writeFileSync(`${file}.tmp`, data, { mode: 0o600 });
    fs.renameSync(`${file}.tmp`, file);
  }

  saveSession(id, creds) {
    this.writePrivate(id, SESSION_FILE, encryptSession(creds, this.keyBuf()));
  }

  loadSession(id) {
    const file = path.join(this.dir(id), SESSION_FILE);
    if (!fs.existsSync(file)) return null;
    return decryptSession(fs.readFileSync(file), this.keyBuf());
  }

  /** Newest ingested msgId per kind for this account (ids only); another account starts empty. */
  loadCursor(id, uid) {
    try {
      const c = JSON.parse(fs.readFileSync(path.join(this.dir(id), CURSOR_FILE), 'utf8'));
      if (c && c.uid === uid && c.map === MAP_VERSION) return { user: c.user || null, group: c.group || null };
    } catch {
      // none yet
    }
    return { user: null, group: null };
  }

  saveCursor(id, rt) {
    try {
      this.writePrivate(id, CURSOR_FILE, JSON.stringify({ uid: rt.uid, map: MAP_VERSION, user: rt.cursor.user, group: rt.cursor.group }));
    } catch {
      // the next batch writes it again
    }
  }

  probe(id, rec) {
    try {
      const file = path.join(this.dir(id), PROBE_FILE);
      const n = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').length : 0;
      if (n >= PROBE_MAX_LINES) return;
      fs.appendFileSync(file, `${JSON.stringify({ t: new Date().toISOString(), ...rec })}\n`, { mode: 0o600 });
    } catch {
      // the probe never breaks the session
    }
  }

  state(id, wantQr) {
    return stateOf(this.rt.get(id), wantQr);
  }

  phase(id) {
    return this.rt.get(id)?.phase ?? null;
  }

  newRuntime(uid) {
    return {
      phase: 'starting',
      qr: null,
      uid: uid ?? null,
      api: null,
      listener: null,
      closeCode: null,
      error: null,
      declinedAt: null,
      stopped: false,
      timers: new Set(),
      debounce: new Set(),
      q: newQueue(),
      flushing: false,
      flushAgain: false,
      flushTimer: null,
      retryMs: 0,
      cursor: { user: null, group: null },
      catchup: {},
      recent: new Map(),
      byCli: new Map(),
      echo: new Map(),
      waiters: new Map(),
      groupVers: new Map(),
      dirtyGroups: new Set(),
      friends: new Set(),
      knownUsers: new Set(),
      unknownUsers: new Set(),
      shapes: new Set(),
      stickerCache: new Map(),
      names: new Map(),
      typingAt: new Map(),
      requestsSynced: false,
      sending: false,
    };
  }

  /** Starts (or resumes) the session: saved session first, else a QR login. Returns at once; work goes on async. */
  start(id) {
    const cur = this.rt.get(id);
    if (cur && cur.phase !== 'lost' && cur.phase !== 'error') return;
    if (cur) this.stop(cur);
    const rt = this.newRuntime(cur?.uid);
    // Nothing is posted until the API binds the logged-in uid, so a queue carried to another account never leaves.
    if (cur) for (const k of CARRY_OVER) rt[k] = cur[k];
    this.rt.set(id, rt);
    void this.run(id, rt).catch((e) => {
      rt.phase = 'error';
      rt.error = 'Máy Zalo không mở được phiên trực tiếp';
      this.log(`${id}: direct start failed (${e && e.code ? e.code : 'error'})`);
    });
  }

  async run(id, rt) {
    const { Zalo } = this.zca();
    const zalo = new Zalo({ selfListen: true, checkUpdate: false, logging: false });
    let saved = null;
    try {
      saved = this.loadSession(id);
    } catch {
      this.log(`${id}: saved session unreadable, asking for a QR`);
    }
    if (saved) {
      try {
        const api = await zalo.login(saved);
        return this.online(id, rt, api);
      } catch {
        this.log(`${id}: saved session refused by Zalo, asking for a QR`);
      }
    }
    await this.qrLogin(id, rt, zalo);
  }

  async qrLogin(id, rt, zalo) {
    const { LoginQRCallbackEventType: E } = this.zca();
    const api = await zalo.loginQR({}, (ev) => {
      if (this.rt.get(id) !== rt) return ev.actions?.abort?.();
      switch (ev.type) {
        case E.QRCodeGenerated:
          rt.phase = 'qr';
          rt.qr = `data:image/png;base64,${ev.data.image}`;
          break;
        case E.QRCodeExpired:
          rt.phase = 'expired';
          rt.qr = null;
          ev.actions.retry();
          break;
        case E.QRCodeScanned:
          rt.phase = 'scanned';
          rt.qr = null;
          break;
        case E.QRCodeDeclined:
          rt.declinedAt = Date.now();
          rt.qr = null;
          ev.actions.retry();
          break;
        case E.GotLoginInfo:
          this.saveSession(id, { cookie: ev.data.cookie, imei: ev.data.imei, userAgent: ev.data.userAgent });
          break;
        default:
      }
    });
    if (!api) throw Object.assign(new Error('qr login aborted'), { code: 'aborted' });
    return this.online(id, rt, api);
  }

  /**
   * Moves a nick here from its Zalo Web (plan P4): logs in with the session read from its Chrome profile, saves it
   * encrypted, starts listening. Throws when Zalo refuses the session (the caller turns Chrome back on). The uid.
   */
  async adopt(id, creds) {
    const { Zalo } = this.zca();
    const zalo = new Zalo({ selfListen: true, checkUpdate: false, logging: false });
    const api = await zalo.login(creds);
    const uid = String(api.getOwnId());
    this.saveSession(id, creds);
    const cur = this.rt.get(id);
    if (cur) this.stop(cur);
    const rt = this.newRuntime(uid);
    this.rt.set(id, rt);
    this.online(id, rt, api);
    return uid;
  }

  /** Logged in: listen, sync friends and groups, run the send loop. */
  online(id, rt, api) {
    if (this.rt.get(id) !== rt) {
      try {
        api?.listener?.stop();
      } catch {
        // never started
      }
      return;
    }
    rt.api = api;
    rt.uid = String(api.getOwnId());
    rt.qr = null;
    rt.cursor = this.loadCursor(id, rt.uid);
    this.listen(id, rt, api);
    this.later(rt, this.t.firstSyncMs, async () => {
      await this.syncGroups(id, rt);
      await this.syncFriends(id, rt);
      await this.syncFriendRequests(id, rt);
    });
    this.every(rt, this.t.groupsEveryMs, async () => {
      await this.syncGroups(id, rt);
      await this.syncFriendRequests(id, rt);
    });
    this.every(rt, this.t.friendsEveryMs, () => this.syncFriends(id, rt));
    void this.sendLoop(id, rt);
  }

  listen(id, rt, api) {
    const l = api.listener;
    rt.listener = l;
    // A handler error (an unexpected payload) is logged by name only and never reaches zca-js's socket loop.
    const mine = (name, fn) => (...a) => {
      if (!this.alive(id, rt)) return;
      try {
        fn(...a);
      } catch (e) {
        this.log(`${id}: ${name} handler failed (${e?.name ?? 'error'})`);
      }
    };
    l.on(
      'connected',
      mine('connected', () => {
        rt.phase = 'online';
        rt.closeCode = null;
        this.log(`${id}: direct session online`);
        this.catchUp(id, rt);
      }),
    );
    l.on(
      'closed',
      mine('closed', (code) => {
        rt.phase = 'lost';
        rt.closeCode = code;
        this.log(`${id}: direct session closed (${lostReason(code)}, code ${code})`);
      }),
    );
    l.on('error', mine('error', () => this.log(`${id}: listener error`)));
    l.on('message', mine('message', (m) => this.onMessage(id, rt, m)));
    l.on('old_messages', mine('old_messages', (msgs, type) => this.onOldMessages(id, rt, msgs, type)));
    l.on('undo', mine('undo', (u) => this.enqueue(id, rt, 'recalls', map.recallItem(u))));
    l.on('reaction', mine('reaction', (r) => map.reactionItems(r).forEach((it) => this.enqueue(id, rt, 'reactions', it))));
    l.on('group_event', mine('group_event', (e) => this.onGroupEvent(id, rt, e)));
    l.on('delivered_messages', mine('delivered_messages', (list) => map.statusItems('delivered', list, rt.uid).forEach((it) => this.enqueue(id, rt, 'statuses', it))));
    l.on('seen_messages', mine('seen_messages', (list) => map.statusItems('seen', list, rt.uid).forEach((it) => this.enqueue(id, rt, 'statuses', it))));
    // A request received / taken back / accepted elsewhere: friends and pending requests again (debounced).
    l.on(
      'friend_event',
      mine('friend_event', () =>
        this.debounced(rt, 'friends', this.t.userInfoDelayMs, async () => {
          await this.syncFriends(id, rt);
          await this.syncFriendRequests(id, rt);
        }),
      ),
    );
    l.on('typing', mine('typing', (t) => this.onTyping(id, rt, t)));
    l.start({ retryOnClose: true });
    // Assume online once started; `closed` flips it.
    rt.phase = 'online';
  }

  alive(id, rt) {
    return this.rt.get(id) === rt && !rt.stopped;
  }

  /** The API bound this nick to the slot (anti mis-scan check passed): only then is anything ingested or sent. */
  bound(id, rt) {
    const s = this.slotOf(id);
    return !!(s && s.uid && rt.uid && String(s.uid) === rt.uid && this.cfg.api && this.cfg.token);
  }

  // ---------------------------------------------------------------- timers

  later(rt, ms, fn) {
    const t = setTimeout(() => {
      rt.timers.delete(t);
      if (!rt.stopped) Promise.resolve().then(fn).catch(() => undefined);
    }, ms);
    rt.timers.add(t);
  }

  every(rt, ms, fn) {
    const t = setInterval(() => {
      if (!rt.stopped) Promise.resolve().then(fn).catch(() => undefined);
    }, ms);
    rt.timers.add(t);
  }

  /** Runs `fn` once after `ms`, however many times it is asked meanwhile. */
  debounced(rt, key, ms, fn) {
    if (rt.debounce.has(key)) return;
    rt.debounce.add(key);
    this.later(rt, ms, () => {
      rt.debounce.delete(key);
      return fn();
    });
  }

  // ---------------------------------------------------------------- receive

  onMessage(id, rt, m) {
    const d = m && m.data;
    if (!d) return;
    if (map.isUndoMessage(m)) {
      this.enqueue(id, rt, 'recalls', map.recallFromMessage(m));
      return;
    }
    this.remember(rt, m);
    const item = map.messageItem(m);
    if (!item) return;
    this.noteShape(id, rt, d);
    if (m.isSelf && item.cliMsgId) this.resolveEcho(rt, item.msgId, item.cliMsgId);
    // 1-1 partner not among the friends: fetch the profile (name, avatar) once.
    if (m.type !== GROUP) this.noteUser(id, rt, m.isSelf ? String(m.threadId) : String(d.uidFrom ?? ''));
    if (!m.isSelf) this.noteName(rt, d.uidFrom, d.dName);
    this.enqueue(id, rt, 'messages', item);
  }

  /** Pages of `requestOldMessages` (catch-up): ingested like live messages; asks the next page from the newest id. */
  onOldMessages(id, rt, msgs, type) {
    if (!Array.isArray(msgs)) return;
    for (const m of msgs) this.onMessage(id, rt, m);
    const key = type === GROUP ? 'group' : 'user';
    const newest = msgs.reduce((acc, m) => maxId(acc, m?.data?.msgId != null ? String(m.data.msgId) : null), null);
    const c = (rt.catchup[key] = rt.catchup[key] || { pages: 0, last: null });
    if (msgs.length) this.log(`${id}: caught up ${msgs.length} ${key} message(s)`);
    if (msgs.length >= 20 && newest && newest !== c.last && c.pages < CATCHUP_MAX_PAGES) {
      c.pages += 1;
      c.last = newest;
      this.later(rt, 1000, () => rt.listener?.requestOldMessages(type, newest));
    }
  }

  /** After each (re)connect: what Zalo delivered to this session after the newest message already ingested. */
  catchUp(id, rt) {
    rt.catchup = {};
    for (const [type, key] of [
      [USER, 'user'],
      [GROUP, 'group'],
    ]) {
      try {
        rt.listener?.requestOldMessages(type, rt.cursor[key] || null);
      } catch {
        this.log(`${id}: catch-up request failed (${key})`);
      }
    }
  }

  onGroupEvent(id, rt, e) {
    const gid = e && (e.threadId || e.data?.groupId);
    if (!gid) return;
    for (const m of Array.isArray(e.data?.updateMembers) ? e.data.updateMembers : []) this.noteName(rt, m?.id, m?.dName);
    // The line Zalo shows in the group ("A đã tham gia nhóm"…).
    this.enqueue(id, rt, 'messages', map.groupEventItem(e, rt.uid, (u) => rt.names.get(u)));
    rt.dirtyGroups.add(String(gid).replace(/^g/, ''));
    this.debounced(rt, 'groups', this.t.userInfoDelayMs, () => {
      const ids = [...rt.dirtyGroups];
      rt.dirtyGroups.clear();
      return this.refreshGroups(id, rt, ids);
    });
  }

  /** Display names seen (messages, friends, group events), in memory only: subjects of group system lines. */
  noteName(rt, uid, name) {
    if (uid === null || uid === undefined || typeof name !== 'string' || !name.trim()) return;
    rt.names.set(String(uid), name.trim().slice(0, 100));
    if (rt.names.size > 5000) rt.names.delete(rt.names.keys().next().value);
  }

  /**
   * Someone is typing in a conversation: a realtime "đang soạn tin…" for the open chat (nothing stored), at most one
   * call every 3 seconds per conversation.
   */
  onTyping(id, rt, t) {
    if (!this.bound(id, rt)) return;
    const threadId = map.threadIdOf(t && t.type === GROUP ? GROUP : USER, t && t.threadId);
    if (!threadId) return;
    const last = rt.typingAt.get(threadId) || 0;
    if (Date.now() - last < 3000) return;
    rt.typingAt.set(threadId, Date.now());
    if (rt.typingAt.size > 500) rt.typingAt.delete(rt.typingAt.keys().next().value);
    const who = t && t.data && t.data.uid != null ? String(t.data.uid) : null;
    void this.apiCall('POST', '/api/ingest/typing', { uid: rt.uid, threadId, ...(who ? { who } : {}) }, 5000).catch(() => undefined);
  }

  /**
   * Pending friend requests, received and sent, as full lists (the API marks the ones no longer listed as gone):
   * the Dashboard lists them and accepts / rejects them. Skipped when Zalo does not answer (nothing is marked gone).
   */
  async syncFriendRequests(id, rt) {
    if (!this.alive(id, rt) || !rt.api || !this.bound(id, rt)) return;
    const lists = [
      ['received', () => rt.api.getFriendRecommendations(), map.receivedRequests],
      ['sent', () => rt.api.getSentFriendRequest(), map.sentRequests],
    ];
    for (const [direction, load, rows] of lists) {
      let items;
      try {
        items = rows(await load()).slice(0, 500);
      } catch (e) {
        this.log(`${id}: ${direction} friend requests not read (${e?.code ?? e?.name ?? 'error'})`);
        continue;
      }
      try {
        await this.apiCall('POST', `/api/contacts/${enc(rt.uid)}/friend-requests/dom`, { direction, count: items.length, complete: true, items }, 20_000);
        rt.requestsSynced = true;
      } catch (e) {
        this.log(`${id}: ${direction} friend requests not saved (${e.status || e.name || 'error'})`);
      }
    }
  }

  /** Messages as zca-js delivered them, in memory only: exact quotes for replies, msgId of a reaction target. */
  remember(rt, m) {
    const d = m.data;
    if (!d || d.msgId == null) return;
    const msgId = String(d.msgId);
    rt.recent.delete(msgId);
    rt.recent.set(msgId, d);
    if (d.cliMsgId != null) rt.byCli.set(String(d.cliMsgId), msgId);
    while (rt.recent.size > RECENT_MAX) {
      const [oldId, old] = rt.recent.entries().next().value;
      rt.recent.delete(oldId);
      if (old && old.cliMsgId != null && rt.byCli.get(String(old.cliMsgId)) === oldId) rt.byCli.delete(String(old.cliMsgId));
    }
  }

  /** P2.0 probe: key names and value types of each new non-text kind (never values), to refine the mapping. */
  noteShape(id, rt, d) {
    if (typeof d.content === 'string' || rt.shapes.has(String(d.msgType))) return;
    rt.shapes.add(String(d.msgType));
    let params = null;
    try {
      params = typeof d.content?.params === 'string' && d.content.params ? JSON.parse(d.content.params) : null;
    } catch {
      params = 'unparsable';
    }
    this.probe(id, { ev: 'shape', msgType: String(d.msgType), content: map.shapeOf(d.content), params: map.shapeOf(params) });
  }

  noteUser(id, rt, uid) {
    if (!/^\d{1,40}$/.test(uid) || uid === rt.uid || rt.friends.has(uid) || rt.knownUsers.has(uid)) return;
    rt.unknownUsers.add(uid);
    this.debounced(rt, 'users', this.t.userInfoDelayMs, () => this.lookupUsers(id, rt));
  }

  async lookupUsers(id, rt) {
    const ids = [...rt.unknownUsers].filter((u) => !rt.friends.has(u) && !rt.knownUsers.has(u)).slice(0, 50);
    for (const u of ids) rt.unknownUsers.delete(u);
    if (!ids.length || !rt.api) return;
    try {
      const res = await rt.api.getUserInfo(ids);
      let n = 0;
      for (const [key, p] of Object.entries(res?.changed_profiles || {})) {
        const item = map.contactItem({ ...p, userId: p?.userId || key.split('_')[0] });
        if (item) this.noteName(rt, item.userId, item.displayName);
        if (item) {
          this.enqueue(id, rt, 'contacts', item);
          n += 1;
        }
      }
      for (const u of ids) rt.knownUsers.add(u);
      this.log(`${id}: ${n} profile(s) of new contacts`);
    } catch (e) {
      this.log(`${id}: profile lookup failed (${e?.code ?? e?.name ?? 'error'})`);
    }
    if (rt.unknownUsers.size) this.debounced(rt, 'users', this.t.userInfoDelayMs, () => this.lookupUsers(id, rt));
  }

  async syncGroups(id, rt) {
    if (!this.alive(id, rt) || !rt.api) return;
    try {
      const res = await rt.api.getAllGroups();
      const vers = res?.gridVerMap || {};
      const changed = Object.keys(vers).filter((g) => rt.groupVers.get(g) !== String(vers[g]));
      await this.refreshGroups(id, rt, changed, vers);
      this.log(`${id}: ${Object.keys(vers).length} group(s), ${changed.length} refreshed`);
    } catch (e) {
      this.log(`${id}: group list failed (${e?.code ?? e?.name ?? 'error'})`);
    }
  }

  async refreshGroups(id, rt, ids, vers = {}) {
    for (let i = 0; i < ids.length && this.alive(id, rt); i += GROUP_INFO_CHUNK) {
      if (i) await sleep(this.t.groupInfoGapMs);
      const chunk = ids.slice(i, i + GROUP_INFO_CHUNK);
      const info = await rt.api.getGroupInfo(chunk);
      for (const [gid, g] of Object.entries(info?.gridInfoMap || {})) {
        const item = map.groupItem({ ...g, groupId: g?.groupId || gid });
        if (item) this.enqueue(id, rt, 'groups', item);
        if (vers[gid] !== undefined) rt.groupVers.set(gid, String(vers[gid]));
      }
    }
  }

  async syncFriends(id, rt) {
    if (!this.alive(id, rt) || !rt.api) return;
    try {
      const friends = await rt.api.getAllFriends();
      let n = 0;
      for (const u of Array.isArray(friends) ? friends : []) {
        const item = map.contactItem(u, true);
        if (!item) continue;
        rt.friends.add(item.userId);
        this.noteName(rt, item.userId, item.displayName);
        this.enqueue(id, rt, 'contacts', item);
        n += 1;
      }
      this.log(`${id}: ${n} friend(s)`);
    } catch (e) {
      this.log(`${id}: friend list failed (${e?.code ?? e?.name ?? 'error'})`);
    }
  }

  // ---------------------------------------------------------------- ingest queue

  enqueue(id, rt, stream, item) {
    if (!item || !this.alive(id, rt)) return;
    const q = rt.q;
    if (EVENT_STREAMS.has(stream)) {
      if (q[stream].length >= QUEUE_MAX) q[stream].shift();
      q[stream].push(item);
    } else {
      const m = q[stream];
      const key = itemKey(stream, item);
      m.delete(key);
      if (m.size >= QUEUE_MAX) {
        m.delete(m.keys().next().value);
        this.log(`${id}: ${stream} queue full, oldest item dropped`);
      }
      m.set(key, item);
    }
    this.scheduleFlush(id, rt, this.queueSize(rt) >= 100 ? 0 : this.t.flushDelayMs);
  }

  queueSize(rt) {
    const q = rt.q;
    return q.groups.size + q.contacts.size + q.messages.size + q.recalls.size + q.reactions.length + q.statuses.length;
  }

  scheduleFlush(id, rt, delay) {
    if (rt.flushTimer || rt.stopped) return;
    rt.flushTimer = setTimeout(() => {
      rt.flushTimer = null;
      void this.flush(id, rt);
    }, Math.max(delay, rt.retryMs));
  }

  /** Posts every queued item, stream by stream; on failure keeps them and retries with a growing delay. */
  async flush(id, rt) {
    if (!this.alive(id, rt)) return false;
    if (rt.flushing) {
      rt.flushAgain = true;
      return false;
    }
    if (!this.bound(id, rt)) {
      if (this.queueSize(rt)) this.scheduleFlush(id, rt, 5000);
      return false;
    }
    rt.flushing = true;
    let ok = true;
    try {
      for (const stream of STREAM_ORDER) {
        while (ok && this.alive(id, rt)) {
          const batch = EVENT_STREAMS.has(stream) ? rt.q[stream].slice(0, BATCH_MAX) : [...rt.q[stream].values()].slice(0, BATCH_MAX);
          if (!batch.length) break;
          ok = await this.post(id, rt, stream, batch);
          if (!ok) break;
          if (EVENT_STREAMS.has(stream)) rt.q[stream].splice(0, batch.length);
          // An item replaced meanwhile (newer version of the same message) stays queued.
          else for (const it of batch) if (rt.q[stream].get(itemKey(stream, it)) === it) rt.q[stream].delete(itemKey(stream, it));
        }
        if (!ok) break;
      }
    } finally {
      rt.flushing = false;
    }
    if (!ok) {
      rt.retryMs = Math.min(this.t.retryMaxMs, rt.retryMs ? rt.retryMs * 2 : 2000);
      this.scheduleFlush(id, rt, rt.retryMs);
    } else {
      rt.retryMs = 0;
      if (rt.flushAgain || this.queueSize(rt)) {
        rt.flushAgain = false;
        this.scheduleFlush(id, rt, this.t.flushDelayMs);
      }
    }
    return ok;
  }

  /** One ingest call. True = done with these items (accepted, or refused as a batch and dropped). */
  async post(id, rt, stream, batch) {
    const path = INGEST_PATH[stream] || `/api/ingest/${stream}`;
    const target = path.replace('/api/ingest/', '');
    try {
      const r = await this.apiCall('POST', path, { uid: rt.uid, items: batch }, 30_000);
      if (stream === 'messages') this.advanceCursor(id, rt, batch);
      const rejected = Array.isArray(r?.rejected) ? r.rejected : [];
      if (rejected.length) {
        // Reasons are field paths and zod messages, never values.
        const reasons = [...new Set(rejected.map((x) => String(x?.reason ?? '').slice(0, 120)))].slice(0, 3).join('; ');
        this.log(`${id}: ingest ${target}: ${rejected.length} of ${batch.length} rejected (${reasons})`);
      }
      return true;
    } catch (e) {
      // An API without the status route (older build) must not hold back the messages behind it.
      if (e.status === 400 || e.status === 413 || (stream === 'statuses' && e.status === 404)) {
        this.log(`${id}: ingest ${target}: batch of ${batch.length} refused (HTTP ${e.status}), dropped`);
        return true;
      }
      this.log(`${id}: ingest ${target} failed (${e.status || e.name || 'error'}), retrying`);
      return false;
    }
  }

  advanceCursor(id, rt, batch) {
    const before = `${rt.cursor.user}|${rt.cursor.group}`;
    for (const it of batch) {
      // Only Zalo msgIds: group system lines carry `sys:` ids that must never steer the catch-up.
      if (!/^\d+$/.test(String(it.msgId))) continue;
      const key = String(it.threadId).startsWith('g') ? 'group' : 'user';
      rt.cursor[key] = maxId(rt.cursor[key], String(it.msgId));
    }
    if (`${rt.cursor.user}|${rt.cursor.group}` !== before) this.saveCursor(id, rt);
  }

  /** Flushes now and waits until the queue is empty (or `ms` passed). */
  async drain(id, rt, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end && this.alive(id, rt)) {
      if (!this.queueSize(rt) && !rt.flushing) return true;
      if (rt.flushing) {
        await sleep(50);
        continue;
      }
      clearTimeout(rt.flushTimer);
      rt.flushTimer = null;
      if (!(await this.flush(id, rt))) await sleep(200);
    }
    return !this.queueSize(rt);
  }

  /** Asks the queue to flush (e.g. right after the API bound the nick). */
  kick(id) {
    const rt = this.rt.get(id);
    // Just bound: the pending friend requests were skipped until now.
    if (rt && !rt.requestsSynced && rt.api) this.debounced(rt, 'requests', 1000, () => this.syncFriendRequests(id, rt));
    if (rt && this.queueSize(rt)) {
      clearTimeout(rt.flushTimer);
      rt.flushTimer = null;
      rt.retryMs = 0;
      this.scheduleFlush(id, rt, 0);
    }
  }

  // ---------------------------------------------------------------- VClinks API

  async apiCall(method, p, body, timeoutMs = 15_000) {
    if (!this.cfg.api || !this.cfg.token) throw Object.assign(new Error('VCLINKS_API / VCLINKS_TOKEN missing'), { status: 0 });
    const res = await this.fetchImpl(`${this.cfg.api}${p}`, {
      method,
      headers: { Authorization: `Bearer ${this.cfg.token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg = data && (Array.isArray(data.message) ? data.message.join('; ') : data.message || data.error);
      throw Object.assign(new Error(typeof msg === 'string' ? msg.slice(0, 300) : `HTTP ${res.status}`), { status: res.status });
    }
    return data;
  }

  /** Bytes of an outbox attachment (GET /api/media/:id). */
  async download(id) {
    const res = await this.fetchImpl(`${this.cfg.api}/api/media/${enc(id)}`, {
      headers: { Authorization: `Bearer ${this.cfg.token}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw Object.assign(new Error(`không tải được tệp đính kèm (HTTP ${res.status})`), { local: true });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MEDIA_MAX_BYTES) throw Object.assign(new Error('tệp đính kèm quá lớn'), { local: true });
    return { buf, mime: (res.headers.get('content-type') || '').split(';')[0] };
  }

  // ---------------------------------------------------------------- send

  /**
   * Long-polls the nick's approved outbox items once the nick is bound, claims and sends them one at a time. The API
   * paces the nick at claim (M1a-06).
   */
  async sendLoop(id, rt) {
    if (rt.sending) return;
    rt.sending = true;
    try {
      while (this.alive(id, rt)) {
        if (rt.phase !== 'online' || !this.bound(id, rt)) {
          await sleep(this.t.sendIdleMs);
          continue;
        }
        let items;
        const t0 = Date.now();
        try {
          items = await this.apiCall('GET', `/api/outbox/pending?uid=${enc(rt.uid)}&commands=1&onlyThreads=&wait=${POLL_WAIT_SEC}`, undefined, (POLL_WAIT_SEC + 10) * 1000);
        } catch (e) {
          this.log(`${id}: outbox poll failed (${e.status || e.name || 'error'})`);
          await sleep(this.t.pollErrorMs);
          continue;
        }
        if (!Array.isArray(items) || !items.length) {
          if (Date.now() - t0 < 1000) await sleep(this.t.sendIdleMs);
          continue;
        }
        for (const item of items) {
          if (!this.alive(id, rt) || rt.phase !== 'online') break;
          const r = await this.sendOne(id, rt, item);
          if (r === 'paced') break;
          if (r !== 'skipped') await sleep(this.t.sendGapMs);
        }
      }
    } finally {
      rt.sending = false;
    }
  }

  /** claim → send → result for one item: 'sent' | 'failed' | 'skipped' | 'paced'. */
  async sendOne(id, rt, item) {
    // CLAUDE.md §12.1, checked again here: never send an item without its approval.
    if (!item || item.uid !== rt.uid || !item.approvedBy || !item.approvedAt || item.status !== 'approved') return 'skipped';
    let claimed;
    try {
      claimed = await this.apiCall('POST', `/api/outbox/${enc(item.id)}/claim`, {});
    } catch (e) {
      // The nick's send pace (or the friend-request gate): the rest waits for a later poll.
      if (e.status === 409 && /nhịp gửi/i.test(e.message)) return 'paced';
      return 'skipped';
    }
    if (!claimed || !claimed.approvedBy || !claimed.approvedAt) {
      await this.report(id, item.id, { ok: false, error: 'thiếu thông tin duyệt' });
      return 'failed';
    }
    let outcome;
    try {
      outcome = await this.perform(id, rt, { ...claimed, target: item.target });
    } catch (e) {
      outcome = { ok: false, error: map.errorText(e) };
    }
    const result = outcome.ok
      ? {
          ok: true,
          sentAt: new Date().toISOString(),
          ...(outcome.cliMsgId ? { cliMsgId: outcome.cliMsgId } : {}),
          ...(outcome.cliMsgIds?.length ? { cliMsgIds: outcome.cliMsgIds.slice(0, 50) } : {}),
          ...(outcome.replyCliMsgId ? { replyCliMsgId: outcome.replyCliMsgId } : {}),
        }
      : { ok: false, error: String(outcome.error || 'lỗi không rõ').slice(0, 300) };
    await this.report(id, claimed.id, result);
    this.log(`${id}: outbox ${claimed.id} ${claimed.action || 'send_text'} → ${outcome.ok ? 'sent' : 'failed'}`);
    return outcome.ok ? 'sent' : 'failed';
  }

  async report(id, outboxId, result) {
    try {
      await this.apiCall('POST', `/api/outbox/${enc(outboxId)}/result`, result);
    } catch (e) {
      this.log(`${id}: could not report outbox ${outboxId} (${e.status || e.name || 'error'})`);
    }
  }

  /** Performs one claimed item with zca-js. Returns { ok, cliMsgId?, cliMsgIds?, replyCliMsgId? } or { ok: false, error }. */
  async perform(id, rt, item) {
    const api = rt.api;
    const dest = map.destOf(item.threadId);
    const fail = (error) => ({ ok: false, error });
    switch (item.action || 'send_text') {
      case 'send_text':
        return this.sendText(id, rt, item, dest);
      case 'send_images':
      case 'send_file':
        return this.sendFiles(id, rt, item, dest);
      case 'send_quote': {
        const file = await this.sendFiles(id, rt, item, dest);
        const words = String(item.quote?.message || '').trim();
        if (!file.ok || !words) return file;
        await sleep(this.t.sendGapMs);
        const text = await this.sendText(id, rt, { ...item, text: words, mentions: undefined, replyToCliMsgId: undefined }, dest).catch((e) => fail(map.errorText(e)));
        if (!text.ok) return fail(`đã gửi file báo giá ${item.quote?.no ?? ''} nhưng chưa gửi được lời nhắn (${text.error}); hãy kiểm tra Zalo, đừng gửi lại file`);
        return { ok: true, cliMsgId: text.cliMsgId, cliMsgIds: [...(file.cliMsgIds || []), ...(text.cliMsgIds || [])] };
      }
      case 'send_card': {
        const userId = item.card?.userId;
        if (!userId) return fail('Danh thiếp cần chọn người từ danh bạ (thiếu mã Zalo của người đó)');
        const r = await api.sendCard({ userId: String(userId) }, dest.id, dest.type);
        return this.afterSend(id, rt, [r?.msgId]);
      }
      case 'react': {
        const code = map.REACTION_CODE[item.reaction?.icon];
        const t = this.targetOf(rt, item.reaction?.cliMsgId, item.target);
        if (!code) return fail('Cảm xúc này chưa hỗ trợ');
        if (!t) return fail('Không tìm thấy tin cần thả cảm xúc');
        await api.addReaction(code, { data: { msgId: t.msgId, cliMsgId: t.cliMsgId }, threadId: dest.id, type: dest.type });
        return { ok: true };
      }
      case 'pin_conversation':
        await api.setPinnedConversations(item.pin !== false, dest.id, dest.type);
        return { ok: true };
      case 'mark_unread':
        await api.addUnreadMark(dest.id, dest.type);
        return { ok: true };
      case 'mark_read':
        await api.removeUnreadMark(dest.id, dest.type);
        return { ok: true };
      case 'friend_accept': {
        const f = item.friend || {};
        if (!f.userId) return fail('Thiếu mã Zalo của người gửi lời mời');
        await api.acceptFriendRequest(String(f.userId));
        if (f.alias) await api.changeFriendAlias(f.alias, String(f.userId)).catch(() => undefined);
        return { ok: true };
      }
      case 'friend_reject': {
        const f = item.friend || {};
        if (!f.userId) return fail('Thiếu mã Zalo của người gửi lời mời');
        await api.rejectFriendRequest(String(f.userId));
        return { ok: true };
      }
      case 'friend_request': {
        const f = item.friend || {};
        let userId = f.userId;
        if (!userId && f.phone) userId = (await api.findUser(f.phone))?.uid;
        if (!userId) return fail('Không tìm thấy nick Zalo của số điện thoại này');
        await api.sendFriendRequest(f.greeting || '', String(userId));
        return { ok: true };
      }
      case 'create_poll':
        if (dest.type !== GROUP) return fail('Bình chọn chỉ tạo được trong nhóm');
        await api.createPoll({ question: item.poll?.question, options: item.poll?.options || [] }, dest.id);
        return { ok: true };
      case 'send_sticker': {
        const st = item.sticker || {};
        if (!st.id || st.cateId === undefined || st.type === undefined) {
          return fail('Nick kết nối trực tiếp gửi sticker chọn từ ô tìm sticker (bộ "Củ hành" của Zalo Web không gửi được)');
        }
        const r = await api.sendSticker({ id: Number(st.id), cateId: Number(st.cateId), type: Number(st.type) }, dest.id, dest.type);
        return this.afterSend(id, rt, [r?.msgId]);
      }
      default:
        return fail(`Nick kết nối trực tiếp chưa hỗ trợ lệnh ${item.action}`);
    }
  }

  async sendText(id, rt, item, dest) {
    const text = String(item.text || '');
    if (!text.trim()) return { ok: false, error: 'tin trống' };
    const msg = { msg: text };
    if (dest.type === GROUP && item.mentions?.length) {
      const mentions = map.mentionsFor(text, item.mentions);
      if (mentions.length) msg.mentions = mentions;
    }
    if (item.replyToCliMsgId) {
      const cachedId = rt.byCli.get(String(item.replyToCliMsgId));
      const quote = map.quoteFor(cachedId ? rt.recent.get(cachedId) : null, item.target, rt.uid);
      if (quote) msg.quote = quote;
      else this.log(`${id}: reply target unknown, sent without the quote`);
    }
    const res = await rt.api.sendMessage(msg, dest.id, dest.type);
    const out = await this.afterSend(id, rt, [res?.message?.msgId]);
    return msg.quote && out.cliMsgId ? { ...out, replyCliMsgId: out.cliMsgId } : out;
  }

  async sendFiles(id, rt, item, dest) {
    const atts = Array.isArray(item.attachments) ? item.attachments : [];
    if (!atts.length) return { ok: false, error: 'không có tệp đính kèm' };
    const sources = [];
    for (const a of atts) {
      const { buf, mime } = await this.download(a.id);
      sources.push({ data: buf, filename: map.fileNameFor(a.name, a.mime || mime), metadata: { totalSize: buf.length, ...map.imageSize(buf) } });
    }
    const res = await rt.api.sendMessage({ msg: '', attachments: sources }, dest.id, dest.type);
    return this.afterSend(id, rt, [...(res?.attachment || []).map((x) => x?.msgId), res?.message?.msgId]);
  }

  /** cliMsgIds of what was just sent (from the listener's echo, matched by msgId); the echo is ingested first. */
  async afterSend(id, rt, msgIds) {
    const ids = msgIds.filter((x) => x !== undefined && x !== null).map(String);
    const clis = [];
    for (const mid of ids) {
      const cli = await this.waitEcho(rt, mid, this.t.echoWaitMs);
      if (cli) clis.push(cli);
    }
    await this.drain(id, rt, 5000);
    return { ok: true, ...(clis.length ? { cliMsgId: clis[clis.length - 1], cliMsgIds: clis } : {}) };
  }

  resolveEcho(rt, msgId, cliMsgId) {
    rt.echo.set(msgId, cliMsgId);
    if (rt.echo.size > 500) rt.echo.delete(rt.echo.keys().next().value);
    const w = rt.waiters.get(msgId);
    if (w) {
      rt.waiters.delete(msgId);
      w(cliMsgId);
    }
  }

  waitEcho(rt, msgId, ms) {
    if (rt.echo.has(msgId)) return Promise.resolve(rt.echo.get(msgId));
    return new Promise((resolve) => {
      rt.waiters.set(msgId, resolve);
      const t = setTimeout(() => {
        rt.timers.delete(t);
        if (rt.waiters.get(msgId) === resolve) rt.waiters.delete(msgId);
        resolve(null);
      }, ms);
      rt.timers.add(t);
    });
  }

  /**
   * Zalo's sticker search for the composer: keyword → up to 40 stickers (id, category, type, image). Cached an hour
   * per keyword. Null when the session is not online.
   */
  async stickers(id, q) {
    const rt = this.rt.get(id);
    if (!rt || !rt.api || rt.phase !== 'online') return null;
    const key = String(q || '').trim().toLowerCase().slice(0, 50) || 'chào';
    const hit = rt.stickerCache.get(key);
    if (hit && Date.now() - hit.at < STICKER_CACHE_MS) return hit.items;
    const ids = ((await rt.api.getStickers(key)) || []).filter((x) => Number.isInteger(Number(x))).slice(0, 40);
    const details = ids.length ? await rt.api.getStickersDetail(ids) : [];
    const items = (Array.isArray(details) ? details : [])
      .filter((d) => d && Number(d.id) > 0)
      .map((d) => ({
        id: Number(d.id),
        cateId: Number(d.cateId) || 0,
        type: Number(d.type) || 0,
        url: [d.stickerWebpUrl, d.stickerUrl].find((u) => typeof u === 'string' && /^https:\/\//.test(u)) || map.stickerUrl(Number(d.id)),
      }));
    rt.stickerCache.set(key, { at: Date.now(), items });
    if (rt.stickerCache.size > 200) rt.stickerCache.delete(rt.stickerCache.keys().next().value);
    return items;
  }

  /** msgId + cliMsgId of a message of the thread, from memory or from the stored message the API sent along. */
  targetOf(rt, cliMsgId, target) {
    const cached = cliMsgId ? rt.byCli.get(String(cliMsgId)) : null;
    if (cached) return { msgId: cached, cliMsgId: String(cliMsgId) };
    if (target?.msgId && target?.cliMsgId) return { msgId: String(target.msgId), cliMsgId: String(target.cliMsgId) };
    return null;
  }

  // ---------------------------------------------------------------- lifecycle

  stop(rt) {
    rt.stopped = true;
    try {
      rt.listener?.stop();
    } catch {
      // already stopped
    }
    for (const t of rt.timers) clearTimeout(t);
    rt.timers.clear();
    clearTimeout(rt.flushTimer);
    rt.flushTimer = null;
    for (const w of rt.waiters.values()) w(null);
    rt.waiters.clear();
  }

  /** Drops the session (wrong account, rescan from scratch): stop, delete the saved session, back to a fresh QR. */
  reset(id) {
    this.forget(id);
    this.start(id);
  }

  /** Stops the session and deletes its saved credentials and cursor (the profile directory is wiped by the caller). */
  forget(id) {
    const cur = this.rt.get(id);
    if (cur) this.stop(cur);
    this.rt.delete(id);
    for (const f of [SESSION_FILE, CURSOR_FILE]) {
      try {
        fs.rmSync(path.join(this.dir(id), f), { force: true });
      } catch {
        // nothing saved
      }
    }
  }
}

module.exports = { DirectSessions, sessionKey, encryptSession, decryptSession, stateOf, lostReason, maxId };
