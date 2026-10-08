// Pure mapping between zca-js objects (máy Zalo direct mode) and VClinks shapes: ingest items on the way in,
// zca-js call arguments on the way out (docs/01-quan-ly-du-an/ke-hoach-zalo-truc-tiep-zca-js.md §3, §4, §12).
// No I/O and no logging here. What these functions return carries message content: callers never log it
// (CLAUDE.md §12.3). Unit tests: test/farm-direct-map.test.js.

/** zca-js ThreadType */
const USER = 0;
const GROUP = 1;

/** VClinks reaction icon id ↔ Zalo code (mirror of REACTION_CODE in packages/shared/src/schemas.ts). */
const REACTION_CODE = { 0: '/-heart', 3: '/-strong', 5: ':>', 32: ':o', 2: ':-((', 20: ':-h' };
const REACTION_ID = Object.fromEntries(Object.entries(REACTION_CODE).map(([id, code]) => [code, id]));

/** Keys the API refuses anywhere in an item (mirror of packages/shared/src/sensitive.ts): dropped before sending. */
const SENSITIVE_KEYS = [/^e2ee(_|$)/i, /token/i, /cookie/i, /passw(or)?d/i, /secret/i, /private_?key/i, /(^|[_-])otp([_-]|$)/i, /^otp[A-Z]/];

/** Placeholder text of message kinds the Dashboard has no view for. */
const OTHER_LABEL = {
  'chat.ecard': 'Thiệp',
  'chat.todo': 'Giao việc',
  'group.poll': 'Bình chọn',
  'chat.poll': 'Bình chọn',
  'chat.list': 'Danh sách',
  'chat.forward': 'Tin chuyển tiếp',
};

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

// ------------------------------------------------------------------ small helpers

const num = (v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const str = (v, max = 1000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const idStr = (v) => (v === null || v === undefined || v === '' || String(v) === '0' ? undefined : String(v));
const httpsUrl = (u) => (typeof u === 'string' && u.length <= 4000 && /^https:\/\/\S+$/i.test(u) ? u : undefined);
const linkUrl = (u) => (typeof u === 'string' && u.length <= 4000 && /^https?:\/\/\S+$/i.test(u) ? u : undefined);

/** Drops undefined, null and empty-string fields (ingest items never send them). */
function defined(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

/** Deep copy without any key the API would refuse. */
function clean(v, depth = 0) {
  if (depth > 16 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => clean(x, depth + 1));
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (x !== undefined && !SENSITIVE_KEYS.some((re) => re.test(k))) out[k] = clean(x, depth + 1);
  }
  return out;
}

/** `params` of an attachment: a JSON string in zca-js messages. */
function paramsOf(c) {
  const p = c && c.params;
  if (p && typeof p === 'object') return p;
  if (typeof p !== 'string' || !p) return {};
  try {
    const v = JSON.parse(p);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** "12.3 MB", the way Zalo shows a file size. */
function sizeText(bytes) {
  const n = num(bytes);
  if (!n || n < 0) return undefined;
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${i ? v.toFixed(v < 10 ? 1 : 0) : Math.round(v)} ${units[i]}`;
}

/**
 * Call line of a call message (`chat.recommended` whose params carry `callId`). `duration` is read as seconds
 * (0 = not picked up); `calltype` and `reason` are kept in `raw.call` until their codes are confirmed.
 */
function callOf(p) {
  const d = num(p.duration);
  const secs = d && d > 0 ? Math.min(86_400, Math.round(d)) : undefined;
  return defined({ outcome: secs ? 'ended' : Number(p.isCaller) === 1 ? 'unknown' : 'missed', durationSec: secs });
}

/** Image of a Zalo sticker by its id (the link Zalo Web keeps in its `sticker` store). */
function stickerUrl(id) {
  return `https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=${id}&size=130`;
}

/** Seconds of a Zalo media duration (milliseconds in `params`). */
function seconds(ms) {
  const n = num(ms);
  return n && n > 0 ? Math.min(86_400, Math.round(n / 1000)) : undefined;
}

// ------------------------------------------------------------------ threads

/** VClinks thread id: groups carry the 'g' prefix the extension uses (zca-js gives the bare group id). */
function threadIdOf(type, id) {
  const s = id === null || id === undefined ? '' : String(id);
  return type === GROUP && s && !s.startsWith('g') ? `g${s}` : s;
}

/** zca-js destination of a VClinks thread id. */
function destOf(threadId) {
  const s = String(threadId ?? '');
  return s.startsWith('g') ? { id: s.slice(1), type: GROUP } : { id: s, type: USER };
}

// ------------------------------------------------------------------ messages in

/**
 * Text and Dashboard content body (`MessageContentBody`: images, files, voice, video, card, location, call, kind) of
 * one zca-js message, plus technical facts for `raw` (`meta`). Kinds the Dashboard cannot show get a short
 * placeholder, never "Đang chờ nội dung". Payload shapes: probe file of the máy Zalo (P2.0, 06/10/2026).
 */
function contentOf(msgType, c) {
  const t = String(msgType || '');
  if (typeof c === 'string') return { text: c };
  if (!c || typeof c !== 'object') return { text: '' };
  const p = paramsOf(c);
  const title = str(c.title, 2000);
  const desc = str(c.description, 2000);
  switch (t) {
    case 'chat.photo':
    case 'chat.doodle': {
      const url = httpsUrl(p.hd) || httpsUrl(c.href) || httpsUrl(c.oriUrl) || httpsUrl(c.normalUrl) || httpsUrl(c.thumb);
      return { text: title, content: defined({ images: url ? [url] : undefined, kind: 'image' }) };
    }
    case 'chat.gif': {
      const url = httpsUrl(c.href) || httpsUrl(c.thumb);
      return url ? { content: { images: [url], kind: 'image' } } : { text: '[GIF]', content: { kind: 'image' } };
    }
    case 'chat.sticker': {
      // The sticker image, from its id; id / category / type stay in raw.sticker to send the same sticker back.
      const sid = num(c.id);
      if (!sid || sid <= 0) return { text: '[Sticker]', content: { kind: 'sticker' } };
      return { content: { images: [stickerUrl(Math.trunc(sid))], kind: 'sticker' }, meta: { sticker: defined({ id: Math.trunc(sid), catId: num(c.catId), type: num(c.type) }) } };
    }
    case 'share.file':
      return {
        content: {
          files: [defined({ name: (title || 'Tệp đính kèm').slice(0, 500), size: sizeText(p.fileSize), ext: str(p.fileExt, 20), url: httpsUrl(c.href) })],
          kind: 'file',
        },
      };
    case 'chat.voice':
      return { content: { voice: defined({ url: httpsUrl(c.href), durationSec: seconds(p.duration) }), kind: 'voice' } };
    case 'chat.video.msg':
      return { text: title, content: { video: defined({ url: httpsUrl(c.href), thumb: httpsUrl(c.thumb), durationSec: seconds(p.duration) }), kind: 'video' } };
    case 'chat.location.new': {
      const lat = num(p.latitude ?? p.lat);
      const lng = num(p.longitude ?? p.lng ?? p.long);
      const ok = lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      return { content: { location: defined({ lat: ok ? lat : undefined, lng: ok ? lng : undefined, title, address: desc, url: httpsUrl(c.href) }), kind: 'location' } };
    }
    case 'chat.recommended':
    case 'chat.link':
    case 'share.link':
    case 'chat.webcontent': {
      if (p.callId !== undefined || p.calltype !== undefined) {
        const meta = { call: defined({ calltype: num(p.calltype), reason: num(p.reason), isCaller: num(p.isCaller), duration: num(p.duration) }) };
        return { content: { call: callOf(p), kind: 'call' }, meta };
      }
      if (c.action === 'recommened.user') {
        return { text: title, content: { card: defined({ title, userId: str(String(p.userId ?? p.uid ?? ''), 128) }), kind: 'card' } };
      }
      const href = linkUrl(c.href);
      const card = title || httpsUrl(c.href) ? defined({ title, url: httpsUrl(c.href) }) : undefined;
      return { text: href || title || desc || '[Liên kết]', content: defined({ links: href ? [href] : undefined, card, kind: 'card' }) };
    }
    default:
      return { text: title || desc || `[${OTHER_LABEL[t] || 'Tin nhắn'}]`, content: { kind: 'other' } };
  }
}

/** Quote reference stored as `quoteRef`: the API resolves it by `cliMsgId` / `globalMsgId`. */
function quoteRef(q) {
  if (!q || typeof q !== 'object') return undefined;
  const ref = defined({
    ownerId: idStr(q.ownerId),
    cliMsgId: idStr(q.cliMsgId),
    globalMsgId: idStr(q.globalMsgId),
    cliMsgType: num(q.cliMsgType),
    ts: num(q.ts),
    msg: typeof q.msg === 'string' ? q.msg.slice(0, 2000) : undefined,
    fromD: str(q.fromD, 200),
  });
  return ref.cliMsgId || ref.globalMsgId ? ref : undefined;
}

/** Technical fields kept in `raw` ("Xem nội dung gốc"): no content, no sensitive key. */
function rawOf(d) {
  const raw = defined({
    propertyExt: d.propertyExt && typeof d.propertyExt === 'object' ? clean(d.propertyExt) : undefined,
    paramsExt: d.paramsExt && typeof d.paramsExt === 'object' ? clean(d.paramsExt) : undefined,
    status: num(d.status),
    cmd: num(d.cmd),
    st: num(d.st),
    at: num(d.at),
    realMsgId: idStr(d.realMsgId),
    source: 'zca-js',
  });
  return raw;
}

/**
 * `messages` ingest item of a zca-js message (live or caught up after a reconnect). Own messages get
 * `fromUid: '0'` like the extension's (zca-js rewrites '0' to the account's uid). Null when unusable.
 */
function messageItem(m) {
  const d = (m && m.data) || {};
  const type = m && m.type === GROUP ? GROUP : USER;
  const threadId = threadIdOf(type, m && m.threadId);
  const ts = num(d.ts);
  const fromUid = m && m.isSelf ? '0' : idStr(d.uidFrom);
  if (!idStr(d.msgId) || !threadId || !fromUid || !ts || ts <= 0) return null;
  const { text, content, meta } = contentOf(d.msgType, d.content);
  const item = defined({
    msgId: String(d.msgId),
    cliMsgId: idStr(d.cliMsgId),
    threadId,
    fromUid,
    toUid: type === GROUP ? threadId : idStr(d.idTo),
    senderName: str(d.dName, 200),
    msgType: str(String(d.msgType ?? ''), 100) || 'webchat',
    quote: quoteRef(d.quote),
    mentions: Array.isArray(d.mentions) && d.mentions.length ? clean(d.mentions.slice(0, 500)) : undefined,
    sentAt: Math.trunc(ts),
    ttl: num(d.ttl) > 0 ? Math.trunc(num(d.ttl)) : undefined,
    // Own messages start at "Đã gửi"; delivered / seen events move them up (the API never moves them down).
    status: m && m.isSelf ? 1 : undefined,
    contentStatus: 'complete',
    contentSource: 'direct',
    raw: { ...rawOf(d), ...(meta || {}) },
  });
  // Always sent, null when absent: a re-ingest with a newer mapping clears what an older one stored.
  item.text = typeof text === 'string' && text ? text.slice(0, 100_000) : null;
  item.content = content && Object.keys(content).length ? content : null;
  return item;
}

/** A recall that arrives as a message (msgType 'chat.undo', e.g. in a catch-up page) instead of an `undo` event. */
function isUndoMessage(m) {
  return !!m && !!m.data && String(m.data.msgType) === 'chat.undo';
}

/** Recall item of a 'chat.undo' message: same as the `undo` event. */
function recallFromMessage(m) {
  return recallItem({ threadId: m.threadId, isGroup: m.type === GROUP, isSelf: m.isSelf, data: m.data });
}

/**
 * Recall (zca-js `undo`): the recalled message again with msgType '20'. The API keeps its text and send time
 * and flags it `recalled`. Null when the target is unknown.
 */
function recallItem(u) {
  const d = (u && u.data) || {};
  const c = (d && d.content) || {};
  const threadId = threadIdOf(u && u.isGroup ? GROUP : USER, u && u.threadId);
  const ts = num(d.ts);
  const fromUid = u && u.isSelf ? '0' : idStr(d.uidFrom);
  if (!idStr(c.globalMsgId) || !threadId || !fromUid || !ts || ts <= 0) return null;
  return defined({ msgId: String(c.globalMsgId), cliMsgId: idStr(c.cliMsgId), threadId, fromUid, msgType: '20', sentAt: Math.trunc(ts) });
}

/**
 * Reaction events (one per target message) for the `reactions` stream: `delta` = who put which icon, or null when
 * they took their reactions back. Icons are VClinks ids (REACTION_CODE); other Zalo icons keep Zalo's number.
 */
function reactionItems(r) {
  const d = (r && r.data) || {};
  const c = (d && d.content) || {};
  const threadId = threadIdOf(r && r.isGroup ? GROUP : USER, r && r.threadId);
  const reactor = r && r.isSelf ? '0' : idStr(d.uidFrom);
  if (!threadId || !reactor) return [];
  const code = typeof c.rIcon === 'string' ? c.rIcon : '';
  const icon = code ? (REACTION_ID[code] ?? (Number.isInteger(c.rType) && c.rType >= 0 ? String(c.rType) : code.slice(0, 16))) : null;
  const ts = num(d.ts);
  return (Array.isArray(c.rMsg) ? c.rMsg : [])
    .filter((t) => t && idStr(t.gMsgID))
    .map((t) => ({
      msgId: String(t.gMsgID),
      ...(idStr(t.cMsgID) ? { cliMsgId: String(t.cMsgID) } : {}),
      threadId,
      delta: { reactor, icon },
      lastSender: reactor,
      ...(ts && ts > 0 ? { lastUpdate: Math.trunc(ts) } : {}),
    }));
}

/**
 * `message-status` items of zca-js `delivered_messages` / `seen_messages` events. 1-1: the other side received / read
 * the nick's messages up to `msgId`. Groups: members other than the nick did; the nick itself among the readers =
 * it read the group on another device (`read`: unread to 0). Events about the nick's own device are skipped.
 */
function statusItems(kind, list, ownUid) {
  const out = [];
  for (const e of Array.isArray(list) ? list : []) {
    const d = (e && e.data) || {};
    const group = e && e.type === GROUP;
    const threadId = threadIdOf(group ? GROUP : USER, e && e.threadId);
    const msgId = idStr(d.msgId);
    if (!threadId) continue;
    if (!group) {
      if (msgId) out.push({ threadId, event: kind, msgId });
      continue;
    }
    const who = (kind === 'seen' ? d.seenUids : d.deliveredUids) || [];
    const others = who.some((u) => String(u) !== String(ownUid));
    if (kind === 'seen' && who.some((u) => String(u) === String(ownUid))) out.push({ threadId, event: 'read', ...(msgId ? { msgId } : {}) });
    if (others && msgId) out.push({ threadId, event: kind, msgId });
  }
  return out;
}

/** zca-js group event type → the `act` the Dashboard words (MessageBubble SYSTEM_EVENT_TEXT); other events show nothing. */
const GROUP_ACT = {
  join: 'join',
  leave: 'leave',
  remove_member: 'remove_member',
  block_member: 'remove_member',
  update: 'update_name',
  update_avatar: 'update_avatar',
  new_link: 'new_link',
  add_admin: 'add_admin',
  remove_admin: 'remove_admin',
  new_pin_topic: 'pin',
  unpin_topic: 'unpin',
};
/** Acts whose sentence is about the members it happened to ("A đã rời nhóm"), not about who did it. */
const MEMBER_ACTS = new Set(['join', 'leave', 'remove_member', 'add_admin', 'remove_admin']);

/** Epoch ms of a Zalo time that may come in seconds. */
const msOf = (v) => {
  const n = num(v);
  if (!n || n <= 0) return undefined;
  return Math.trunc(n < 1e12 ? n * 1000 : n);
};

/**
 * System line of a zca-js group event (joined / left / removed, renamed, new avatar, deputy, pin) as a `messages` item
 * with `systemEvent`, worded by the Dashboard. The subject is who it happened to, or who did it. The id
 * `sys:<group>:<type>:<time>` is not a Zalo msgId: kept out of the catch-up cursor. Null for events not shown.
 */
function groupEventItem(e, ownUid, nameOf = () => undefined) {
  const act = GROUP_ACT[e && e.type];
  if (!act) return null;
  const d = (e && e.data) || {};
  const gid = idStr(d.groupId) || idStr(e.threadId);
  if (!gid) return null;
  const at = msOf(d.time) || Date.now();
  const members = (Array.isArray(d.updateMembers) ? d.updateMembers : []).filter((m) => m && idStr(m.id));
  const actor = idStr(d.actorId) || idStr(d.sourceId) || idStr(d.creatorId);
  const subjects = MEMBER_ACTS.has(act) && members.length ? members.map((m) => ({ uid: String(m.id), name: str(m.dName, 100) || nameOf(String(m.id)) })) : actor ? [{ uid: actor, name: nameOf(actor) }] : [];
  const self = subjects.length === 1 && subjects[0].uid === String(ownUid);
  const names = subjects.map((s) => s.name).filter(Boolean);
  const senderName = names.length > 3 ? `${names.slice(0, 3).join(', ')} và ${names.length - 3} người khác` : names.join(', ');
  const first = subjects[0] ? subjects[0].uid : actor;
  return defined({
    msgId: `sys:${gid}:${e.type}:${at}`,
    threadId: threadIdOf(GROUP, gid),
    fromUid: self ? '0' : first || '0',
    senderName: self ? undefined : str(senderName, 200),
    msgType: 'group.event',
    sentAt: at,
    systemEvent: defined({ act, actorId: self ? '0' : first }),
    contentStatus: 'complete',
    contentSource: 'direct',
  });
}

/** "03/08": the day a friend request was made, as the Dashboard lists it (Vietnam time, UTC+7, no DST). */
function dateText(t) {
  const ms = msOf(t);
  if (!ms) return undefined;
  const vn = new Date(ms + 7 * 3600_000);
  const two = (n) => String(n).padStart(2, '0');
  return `${two(vn.getUTCDate())}/${two(vn.getUTCMonth() + 1)}`;
}

const requestRow = (userId, d, message, at) =>
  defined({
    userId: String(userId),
    name: str(d.displayName, 200) || str(d.zaloName, 200) || String(userId),
    avatar: httpsUrl(d.avatar),
    message: str(message, 500),
    dateText: dateText(at),
  });

/**
 * Pending friend requests as the rows of POST /api/contacts/:uid/friend-requests/dom (strict: digits-only userId,
 * name, https avatar, greeting, day). Received = zca-js recommendations of type 2; sent = getSentFriendRequest.
 */
function receivedRequests(res) {
  return (res && Array.isArray(res.recommItems) ? res.recommItems : [])
    .map((r) => r && r.dataInfo)
    .filter((d) => d && Number(d.recommType) === 2 && /^\d{1,40}$/.test(String(d.userId)))
    .map((d) => requestRow(d.userId, d, d.recommInfo && d.recommInfo.message, d.recommTime));
}

function sentRequests(res) {
  return Object.values(res && typeof res === 'object' ? res : {})
    .filter((d) => d && /^\d{1,40}$/.test(String(d.userId)))
    .map((d) => requestRow(d.userId, d, d.fReqInfo && d.fReqInfo.message, d.fReqInfo && d.fReqInfo.time));
}

/** `contacts` item of a zca-js user (friend list or getUserInfo). */
function contactItem(u, isFriend) {
  if (!u || !idStr(u.userId)) return null;
  return defined({
    userId: String(u.userId),
    displayName: str(u.displayName, 500) || str(u.zaloName, 500),
    zaloName: str(u.zaloName, 500),
    username: str(u.username, 200),
    phone: str(u.phoneNumber, 30),
    avatar: httpsUrl(u.avatar),
    gender: Number.isInteger(u.gender) ? u.gender : undefined,
    isFriend: typeof isFriend === 'boolean' ? isFriend : u.isFr === 1 ? true : undefined,
    lastActionTime: num(u.lastActionTime) > 0 ? Math.trunc(num(u.lastActionTime)) : undefined,
  });
}

/** `groups` item of a zca-js group info; members from `memberIds`, else from `memVerList` ("uid_version"). */
function groupItem(g) {
  if (!g || !idStr(g.groupId)) return null;
  const members = Array.isArray(g.memberIds) && g.memberIds.length ? g.memberIds : Array.isArray(g.memVerList) ? g.memVerList.map((s) => String(s).split('_')[0]) : [];
  const ids = members.map(String).filter((x) => /^\d{1,40}$/.test(x)).slice(0, 10_000);
  return defined({
    groupId: threadIdOf(GROUP, g.groupId),
    name: str(g.name, 500),
    avatar: httpsUrl(g.fullAvt) || httpsUrl(g.avt),
    memberIds: ids.length ? ids : undefined,
    adminIds: Array.isArray(g.adminIds) && g.adminIds.length ? g.adminIds.map(String).slice(0, 10_000) : undefined,
    creatorId: idStr(g.creatorId),
  });
}

/** Key names and value types of a zca-js payload, never the values (probe file, P2.0). */
function shapeOf(v, depth = 0) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.length && depth < 3 ? [shapeOf(v[0], depth + 1)] : [];
  if (typeof v !== 'object') return typeof v;
  if (depth >= 3) return 'object';
  const out = {};
  for (const k of Object.keys(v).slice(0, 40)) out[k] = shapeOf(v[k], depth + 1);
  return out;
}

// ------------------------------------------------------------------ sends out

/** zca-js mentions of a group text: `@Name` positions; a name without uid stays plain text. */
function mentionsFor(text, mentions) {
  const out = [];
  const used = new Set();
  for (const m of Array.isArray(mentions) ? mentions : []) {
    if (!m || !m.uid || !m.name) continue;
    const tag = `@${m.name}`;
    let pos = text.indexOf(tag);
    while (pos >= 0 && used.has(pos)) pos = text.indexOf(tag, pos + 1);
    if (pos < 0) continue;
    used.add(pos);
    out.push({ pos, uid: String(m.uid), len: tag.length });
  }
  return out.sort((a, b) => a.pos - b.pos);
}

/**
 * zca-js `quote` of a reply: the message as received when the agent still holds it (exact quote), else
 * rebuilt as a text quote from the stored message (`OutboxItem.target`). Null when nothing is known.
 */
function quoteFor(cached, target, ownUid) {
  if (cached && cached.msgId) {
    return {
      content: cached.content,
      msgType: cached.msgType,
      propertyExt: cached.propertyExt,
      uidFrom: String(cached.uidFrom),
      msgId: String(cached.msgId),
      cliMsgId: String(cached.cliMsgId),
      ts: String(cached.ts),
      ttl: Number(cached.ttl) || 0,
    };
  }
  if (!target || !target.msgId) return null;
  const from = target.fromUid === '0' || target.fromUid === '-1' || !target.fromUid ? ownUid : target.fromUid;
  const ts = Date.parse(target.sentAt || '') || Number(target.cliMsgId) || Date.now();
  return {
    content: target.text || '…',
    msgType: 'webchat',
    propertyExt: undefined,
    uidFrom: String(from),
    msgId: String(target.msgId),
    cliMsgId: String(target.cliMsgId),
    ts: String(ts),
    ttl: Number(target.ttl) || 0,
  };
}

/** Width / height of a PNG, JPEG, GIF or WebP from its header (zca-js wants them for photos); {} otherwise. */
function imageSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return {};
  if (buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.toString('ascii', 0, 3) === 'GIF') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' && buf.length >= 30) {
    const f = buf.toString('ascii', 12, 16);
    if (f === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (f === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (f === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    return {};
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 8 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        i += marker === 0xff ? 1 : 2;
        continue;
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return {};
}

/** File name zca-js accepts (it needs "name.ext"): no path characters, an extension from the mime when missing. */
function fileNameFor(name, mime) {
  let n = String(name || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 180);
  if (!n) n = 'tep';
  if (!/\.[A-Za-z0-9]{1,8}$/.test(n)) n = `${n}.${MIME_EXT[mime] || 'bin'}`;
  return n;
}

/** Short Vietnamese failure reason for the outbox (never the message text). */
/**
 * zca-js messages are Zalo's own words, except a few that embed the library's whole context (its
 * "Invalid context {…}" carries cookie, imei and secret key). Such a text never goes to the API (CLAUDE.md §12.2).
 */
const LEAKY_ERROR = /invalid context|cookie|imei|secret|zpw_|user-?agent|[{}]/i;

function errorText(e) {
  const code = e && e.code !== undefined && e.code !== null ? ` (mã ${e.code})` : '';
  const raw = String((e && e.message) || e || 'lỗi không rõ').replace(/\s+/g, ' ');
  const msg = LEAKY_ERROR.test(raw) ? 'lỗi bên trong thư viện Zalo (chi tiết không hiện để giữ kín phiên đăng nhập)' : raw.slice(0, 200);
  return `Zalo không nhận lệnh${code}: ${msg}`.slice(0, 300);
}

module.exports = {
  USER,
  GROUP,
  REACTION_CODE,
  threadIdOf,
  destOf,
  contentOf,
  messageItem,
  isUndoMessage,
  recallFromMessage,
  recallItem,
  reactionItems,
  statusItems,
  groupEventItem,
  receivedRequests,
  sentRequests,
  dateText,
  stickerUrl,
  contactItem,
  groupItem,
  shapeOf,
  mentionsFor,
  quoteFor,
  imageSize,
  fileNameFor,
  errorText,
  sizeText,
};
