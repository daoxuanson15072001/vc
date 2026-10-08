// node --test tools/chrome-driver/test/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { DirectSessions, sessionKey, encryptSession, decryptSession, stateOf, lostReason, maxId } = require('../farm-direct');

const KEY_HEX = 'a'.repeat(64);
const creds = { cookie: [{ key: 'zpw_sek', value: 'secret-value' }], imei: 'imei-123', userAgent: 'UA' };
const ID = 'zs_0123456789abcdef';
const OWN = '836061738303156140';
const GROUP_ID = '4816372702126795745';
const FAST = {
  flushDelayMs: 5,
  retryMaxMs: 40,
  firstSyncMs: 5,
  groupsEveryMs: 1e9,
  friendsEveryMs: 1e9,
  userInfoDelayMs: 20,
  groupInfoGapMs: 1,
  sendIdleMs: 10,
  sendGapMs: 1,
  echoWaitMs: 300,
  pollErrorMs: 10,
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await sleep(10);
  }
  throw new Error('condition not met in time');
}

/** A VClinks API stand-in: records every call, answers through `handler`. */
function fakeFetch(handler) {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = new URL(url);
    const call = {
      method: init.method || 'GET',
      path: u.pathname,
      search: u.searchParams,
      body: init.body ? JSON.parse(init.body) : undefined,
      raw: `${url} ${JSON.stringify(init.headers || {})} ${init.body || ''}`,
    };
    calls.push(call);
    const [status, data] = (await handler(call)) || [200, { accepted: 0, updated: 0, rejected: [] }];
    return { ok: status < 400, status, text: async () => JSON.stringify(data ?? null), headers: { get: () => 'application/json' } };
  };
  f.calls = calls;
  return f;
}

/** zca-js API stand-in: the listener is an EventEmitter; sendMessage echoes the sent message like selfListen. */
function fakeZalo() {
  const listener = new EventEmitter();
  listener.started = 0;
  listener.old = [];
  listener.start = () => {
    listener.started += 1;
  };
  listener.stop = () => {};
  listener.requestOldMessages = (type, last) => listener.old.push([type, last]);
  const calls = [];
  let n = 0;
  const api = {
    listener,
    calls,
    getOwnId: () => OWN,
    getAllGroups: async () => ({ gridVerMap: { [GROUP_ID]: '7' } }),
    getGroupInfo: async (ids) => ({ gridInfoMap: Object.fromEntries(ids.map((g) => [g, { groupId: g, name: 'Nhóm đại lý', memberIds: ['111', '222'], adminIds: ['111'], e2ee: 1 }])) }),
    getAllFriends: async () => [{ userId: '111', displayName: 'Anh Tuấn', zaloName: 'Tuấn', isFr: 1, phoneNumber: '0912345678' }],
    getUserInfo: async (ids) => ({ changed_profiles: Object.fromEntries(ids.map((u) => [`${u}_0`, { userId: u, displayName: 'Khách lạ', zaloName: 'Khach' }])) }),
    sendMessage: async (msg, threadId, type) => {
      calls.push(['sendMessage', msg, threadId, type]);
      n += 1;
      const msgId = String(9_000_000 + n);
      const cliMsgId = String(1_791_257_000_000 + n);
      setTimeout(
        () =>
          listener.emit('message', {
            type,
            threadId,
            isSelf: true,
            data: { msgId, cliMsgId, uidFrom: OWN, idTo: threadId, msgType: 'webchat', ts: String(Date.now()), content: msg.msg },
          }),
        5,
      );
      return { message: { msgId: Number(msgId) }, attachment: [] };
    },
    addReaction: async (...a) => {
      calls.push(['addReaction', ...a]);
      return {};
    },
    sendSticker: async (...a) => {
      calls.push(['sendSticker', ...a]);
      return { msgId: 9_100_000 };
    },
    getStickers: async (q) => {
      calls.push(['getStickers', q]);
      return [46991, 46992];
    },
    getStickersDetail: async (ids) => ids.map((id) => ({ id, cateId: 10, type: 7, stickerUrl: `https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=${id}&size=130`, stickerWebpUrl: null })),
    getFriendRecommendations: async () => ({ recommItems: [{ recommItemType: 1, dataInfo: { userId: '555', displayName: 'Khách A', recommType: 2, recommTime: 1791260000000, recommInfo: { message: 'Chào shop' } } }] }),
    getSentFriendRequest: async () => ({}),
  };
  return api;
}

const customerInGroup = (msgId, text) => ({
  type: 1,
  threadId: GROUP_ID,
  isSelf: false,
  data: { msgId, cliMsgId: String(Number(msgId) + 1), uidFrom: '111', idTo: GROUP_ID, dName: 'Anh Tuấn', ts: String(Date.now()), msgType: 'webchat', content: text },
});
const strangerDm = (msgId, text) => ({
  type: 0,
  threadId: '333',
  isSelf: false,
  data: { msgId, cliMsgId: String(Number(msgId) + 1), uidFrom: '333', idTo: OWN, dName: 'Khách lạ', ts: String(Date.now()), msgType: 'webchat', content: text },
});

function session(dir, slot, handler) {
  const logs = [];
  const f = fakeFetch(handler);
  const s = new DirectSessions({ farmDir: dir, sessionKeyHex: KEY_HEX, api: 'http://api.test', token: 'tok', timing: FAST }, (m) => logs.push(m), { slotOf: () => slot, fetch: f });
  const zalo = fakeZalo();
  const rt = s.newRuntime();
  s.rt.set(ID, rt);
  s.online(ID, rt, zalo);
  return { s, f, zalo, rt, logs };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'direct-'));

test('session file: AES-256-GCM round trip; the wrong key or a changed byte is refused; no plaintext inside', () => {
  const key = sessionKey(KEY_HEX);
  const buf = encryptSession(creds, key);
  assert.deepEqual(decryptSession(buf, key), creds);
  assert.equal(buf.toString('latin1').includes('secret-value'), false);
  assert.throws(() => decryptSession(buf, sessionKey('b'.repeat(64))));
  const bad = Buffer.from(buf);
  bad[bad.length - 1] ^= 1;
  assert.throws(() => decryptSession(bad, key));
  assert.throws(() => sessionKey('short'), /64 hex/);
});

test('saved session lands only in <slot>/session.enc with owner-only permissions; forget deletes it and the cursor', () => {
  const dir = tmp();
  try {
    const s = new DirectSessions({ farmDir: dir, sessionKeyHex: KEY_HEX }, () => {});
    s.saveSession(ID, creds);
    const file = path.join(dir, ID, 'session.enc');
    assert.deepEqual(s.loadSession(ID), creds);
    if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    // A slot directory made earlier with a looser mode is closed to the owner on the next write.
    if (process.platform !== 'win32') {
      fs.chmodSync(path.join(dir, ID), 0o755);
      s.saveSession(ID, creds);
      assert.equal(fs.statSync(path.join(dir, ID)).mode & 0o777, 0o700);
    }
    fs.writeFileSync(path.join(dir, ID, 'cursor.json'), '{}');
    s.forget(ID);
    assert.equal(fs.existsSync(file), false);
    assert.equal(fs.existsSync(path.join(dir, ID, 'cursor.json')), false);
    assert.equal(s.loadSession(ID), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('state for the API: same shape as a Chrome slot; QR only when asked; declined note; lost reasons', () => {
  assert.deepEqual(stateOf(undefined, true), { page: 'down', uids: [] });
  assert.deepEqual(stateOf({ phase: 'starting' }, true), { page: 'down', uids: [] });
  const qr = { phase: 'qr', qr: 'data:image/png;base64,AAA' };
  assert.deepEqual(stateOf(qr, true), { page: 'login', view: 'qr', qr: 'data:image/png;base64,AAA', uids: [] });
  assert.equal(stateOf(qr, false).qr, null);
  assert.equal(stateOf({ ...qr, declinedAt: Date.now() }, true).note, 'declined');
  assert.equal(stateOf({ ...qr, declinedAt: Date.now() - 120_000 }, true).note, undefined);
  assert.deepEqual(stateOf({ phase: 'scanned' }, true), { page: 'login', view: 'scanned', qr: null, uids: [] });
  assert.deepEqual(stateOf({ phase: 'online', uid: '836' }, false), { page: 'chat', uids: ['836'] });
  assert.deepEqual(stateOf({ phase: 'lost', uid: '836', closeCode: 3000 }, false), { page: 'down', uids: ['836'], lost: 'duplicate_web' });
  assert.equal(lostReason(3003), 'duplicate_web');
  assert.equal(lostReason(1006), 'direct_down');
  assert.equal(maxId('8342591539249', '8342591539250'), '8342591539250');
  assert.equal(maxId(null, '5'), '5');
  assert.equal(maxId('10', '9'), '10');
});

test('receive: nothing leaves before the API binds the nick; then groups, contacts, messages in that order; cursor saved', async () => {
  const dir = tmp();
  const slot = { uid: null };
  const { s, f, zalo, logs } = session(dir, slot, () => [200, { accepted: 1, updated: 0, unchanged: 0, rejected: [] }]);
  try {
    zalo.listener.emit('connected');
    assert.deepEqual(zalo.listener.old, [
      [0, null],
      [1, null],
    ]);
    zalo.listener.emit('message', customerInGroup('8342591539249', 'giá má phanh trước?'));
    zalo.listener.emit('message', strangerDm('8342591539300', 'shop còn hàng không'));
    await sleep(80);
    assert.equal(f.calls.filter((c) => c.path.startsWith('/api/ingest/')).length, 0, 'nothing posted while unbound');

    slot.uid = OWN;
    s.kick(ID);
    await until(() => f.calls.some((c) => c.path === '/api/ingest/messages'));
    const order = f.calls.filter((c) => c.path.startsWith('/api/ingest/')).map((c) => c.path.replace('/api/ingest/', ''));
    assert.deepEqual(order.slice(0, 3), ['groups', 'contacts', 'messages']);

    const groups = f.calls.find((c) => c.path === '/api/ingest/groups').body;
    assert.equal(groups.uid, OWN);
    assert.deepEqual(groups.items, [{ groupId: `g${GROUP_ID}`, name: 'Nhóm đại lý', memberIds: ['111', '222'], adminIds: ['111'] }]);
    const msgs = f.calls.find((c) => c.path === '/api/ingest/messages').body.items;
    assert.deepEqual(
      msgs.map((m) => [m.threadId, m.fromUid, m.text, m.contentSource]),
      [
        [`g${GROUP_ID}`, '111', 'giá má phanh trước?', 'direct'],
        ['333', '333', 'shop còn hàng không', 'direct'],
      ],
    );
    // The stranger's profile was looked up (not a friend), the friend was not.
    const contacts = f.calls.filter((c) => c.path === '/api/ingest/contacts').flatMap((c) => c.body.items.map((i) => i.userId));
    assert.deepEqual(contacts.sort(), ['111', '333']);

    const cursor = JSON.parse(fs.readFileSync(path.join(dir, ID, 'cursor.json'), 'utf8'));
    assert.deepEqual(cursor, { uid: OWN, map: 3, user: '8342591539300', group: '8342591539249' });
    for (const secret of ['má phanh', 'còn hàng', 'Tuấn', '0912345678', 'Khách lạ']) {
      assert.equal(logs.join('\n').includes(secret), false, `log must not contain "${secret}"`);
    }
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('receive: a cursor of an older mapping is ignored, so the next connect asks Zalo for everything again', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, ID), { recursive: true });
  fs.writeFileSync(path.join(dir, ID, 'cursor.json'), JSON.stringify({ uid: OWN, user: '5', group: '6' }));
  const { s, zalo } = session(dir, { uid: OWN }, () => [200, { accepted: 1, rejected: [] }]);
  try {
    zalo.listener.emit('connected');
    assert.deepEqual(zalo.listener.old, [
      [0, null],
      [1, null],
    ]);
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const dir2 = tmp();
  fs.mkdirSync(path.join(dir2, ID), { recursive: true });
  fs.writeFileSync(path.join(dir2, ID, 'cursor.json'), JSON.stringify({ uid: OWN, map: 3, user: '5', group: '6' }));
  const again = session(dir2, { uid: OWN }, () => [200, { accepted: 1, rejected: [] }]);
  try {
    again.zalo.listener.emit('connected');
    assert.deepEqual(again.zalo.listener.old, [
      [0, '5'],
      [1, '6'],
    ]);
  } finally {
    again.s.forget(ID);
    fs.rmSync(dir2, { recursive: true, force: true });
  }
});

test('receive: a recall in a catch-up page goes out as the recall of its target, after the messages', async () => {
  const dir = tmp();
  const { s, f, zalo } = session(dir, { uid: OWN }, () => [200, { accepted: 1, rejected: [] }]);
  try {
    const original = customerInGroup('8342591539249', 'tin sẽ thu hồi');
    const undo = { type: 1, threadId: GROUP_ID, isSelf: false, data: { msgId: '8342591539999', cliMsgId: '1791257400000', msgType: 'chat.undo', uidFrom: '111', ts: String(Date.now()), content: { globalMsgId: 8342591539249, cliMsgId: 8342591539250, deleteMsg: 1 } } };
    zalo.listener.emit('old_messages', [original, undo], 1);
    await until(() => f.calls.filter((c) => c.path === '/api/ingest/messages').length >= 2);
    const posts = f.calls.filter((c) => c.path === '/api/ingest/messages').map((c) => c.body.items);
    assert.deepEqual(posts[0].map((i) => [i.msgId, i.msgType]), [['8342591539249', 'webchat']]);
    assert.deepEqual(posts[1].map((i) => [i.msgId, i.msgType]), [['8342591539249', '20']]);
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('receive: while the API is down items stay queued and the cursor does not move; they go out once it is back', async () => {
  const dir = tmp();
  const slot = { uid: OWN };
  let down = true;
  const { s, f, zalo } = session(dir, slot, (c) => (c.path.startsWith('/api/ingest/') && down ? [503, { message: 'down' }] : [200, { accepted: 1, rejected: [] }]));
  try {
    zalo.listener.emit('message', customerInGroup('8342591539249', 'tin 1'));
    await until(() => f.calls.filter((c) => c.path === '/api/ingest/groups' || c.path === '/api/ingest/messages').length >= 2);
    assert.equal(fs.existsSync(path.join(dir, ID, 'cursor.json')), false);
    down = false;
    await until(() => fs.existsSync(path.join(dir, ID, 'cursor.json')));
    const posted = f.calls.filter((c) => c.path === '/api/ingest/messages' && c.body.items.some((i) => i.msgId === '8342591539249'));
    assert.ok(posted.length >= 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, ID, 'cursor.json'), 'utf8')).group, '8342591539249');
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('send: nothing before the API binds the nick; then approved items are claimed, sent to the bare group id, reported with the echo cliMsgId', async () => {
  const dir = tmp();
  const slot = { uid: null };
  const approved = { id: 'ob1', uid: OWN, channel: 'zalo', threadId: `g${GROUP_ID}`, text: 'Dạ em chào anh\nGiá 120k ạ', status: 'approved', approvedBy: 'u1', approvedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
  const unapproved = { ...approved, id: 'ob2', approvedBy: '' };
  let served = false;
  const { s, f, zalo } = session(dir, slot, (c) => {
    if (c.path === '/api/outbox/pending') {
      if (served) return [200, []];
      served = true;
      return [200, [approved, unapproved]];
    }
    if (c.path === '/api/outbox/ob1/claim') return [200, { ...approved, status: 'sending' }];
    if (c.path.endsWith('/claim')) return [200, { ...unapproved, status: 'sending' }];
    return [200, { accepted: 1, rejected: [] }];
  });
  try {
    await sleep(60);
    assert.equal(f.calls.some((c) => c.path === '/api/outbox/pending'), false, 'no poll before the nick is bound');
    slot.uid = OWN;
    await until(() => f.calls.some((c) => c.path === '/api/outbox/ob1/result'));
    const poll = f.calls.find((c) => c.path === '/api/outbox/pending');
    assert.equal(poll.search.get('uid'), OWN);
    assert.equal(poll.search.get('commands'), '1');
    assert.deepEqual(zalo.calls[0], ['sendMessage', { msg: 'Dạ em chào anh\nGiá 120k ạ' }, GROUP_ID, 1]);
    assert.equal(f.calls.some((c) => c.path === '/api/outbox/ob2/claim'), false, 'an item without approval is never claimed');

    const resultIdx = f.calls.findIndex((c) => c.path === '/api/outbox/ob1/result');
    const echoIdx = f.calls.findIndex((c) => c.path === '/api/ingest/messages' && c.body.items.some((i) => i.fromUid === '0'));
    assert.ok(echoIdx >= 0 && echoIdx < resultIdx, 'the echo is ingested before the result');
    const echo = f.calls[echoIdx].body.items.find((i) => i.fromUid === '0');
    assert.equal(echo.text, 'Dạ em chào anh\nGiá 120k ạ');
    const result = f.calls[resultIdx].body;
    assert.equal(result.ok, true);
    assert.equal(result.cliMsgId, echo.cliMsgId);
    assert.deepEqual(result.cliMsgIds, [echo.cliMsgId]);
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('send: a reply quotes the message held in memory; a reaction targets it; the send pace stops the round', async () => {
  const dir = tmp();
  const slot = { uid: null };
  const base = { uid: OWN, channel: 'zalo', threadId: `g${GROUP_ID}`, status: 'approved', approvedBy: 'u1', approvedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
  const reply = { ...base, id: 'ob1', text: 'Dạ có ạ', replyToCliMsgId: '8342591539250' };
  const react = { ...base, id: 'ob2', action: 'react', text: '[Cảm xúc]', reaction: { cliMsgId: '8342591539250', icon: '0' } };
  const paced = { ...base, id: 'ob3', text: 'tin thứ ba' };
  const later = { ...base, id: 'ob4', text: 'tin thứ tư' };
  let round = 0;
  const { s, f, zalo } = session(dir, slot, (c) => {
    if (c.path === '/api/outbox/pending') {
      round += 1;
      return [200, round === 1 ? [reply, react, paced, later] : []];
    }
    if (c.path === '/api/outbox/ob3/claim') return [409, { message: 'Chưa tới nhịp gửi của nick: chờ 2 giây' }];
    const m = /^\/api\/outbox\/(ob\d)\/claim$/.exec(c.path);
    if (m) return [200, { ...[reply, react, paced, later].find((x) => x.id === m[1]), status: 'sending' }];
    return [200, { accepted: 1, rejected: [] }];
  });
  try {
    zalo.listener.emit('message', customerInGroup('8342591539249', 'còn má phanh không shop'));
    await sleep(30);
    slot.uid = OWN;
    await until(() => f.calls.some((c) => c.path === '/api/outbox/ob2/result'));
    await sleep(60);
    const sent = zalo.calls.find((x) => x[0] === 'sendMessage');
    assert.equal(sent[1].quote.msgId, '8342591539249');
    assert.equal(sent[1].quote.cliMsgId, '8342591539250');
    assert.equal(sent[1].quote.content, 'còn má phanh không shop');
    const replyResult = f.calls.find((c) => c.path === '/api/outbox/ob1/result').body;
    assert.equal(replyResult.replyCliMsgId, replyResult.cliMsgId);
    const reaction = zalo.calls.find((x) => x[0] === 'addReaction');
    assert.deepEqual(reaction.slice(1), ['/-heart', { data: { msgId: '8342591539249', cliMsgId: '8342591539250' }, threadId: GROUP_ID, type: 1 }]);
    assert.equal(f.calls.some((c) => c.path === '/api/outbox/ob4/claim'), false, 'after a pace refusal the rest waits');
    assert.equal(f.calls.some((c) => c.path === '/api/outbox/ob3/result'), false);
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('handover (P4): adopt logs in with the Zalo Web session, saves it encrypted and starts listening', async () => {
  const dir = tmp();
  try {
    const s = new DirectSessions({ farmDir: dir, sessionKeyHex: KEY_HEX, api: 'http://api.test', token: 'tok', timing: FAST }, () => {}, { slotOf: () => ({ uid: OWN }), fetch: fakeFetch(() => [200, []]) });
    const zalo = fakeZalo();
    let given = null;
    s.lib = {
      Zalo: class {
        async login(creds) {
          given = creds;
          return zalo;
        }
      },
    };
    const uid = await s.adopt(ID, creds);
    assert.equal(uid, OWN);
    assert.deepEqual(given, creds);
    assert.deepEqual(s.loadSession(ID), creds);
    assert.equal(fs.readFileSync(path.join(dir, ID, 'session.enc')).toString('latin1').includes('secret-value'), false);
    assert.equal(zalo.listener.started, 1);
    assert.deepEqual(s.state(ID, false), { page: 'chat', uids: [OWN] });
    s.lib = { Zalo: class { async login() { throw Object.assign(new Error('refused'), { code: 'X' }); } } };
    await assert.rejects(() => s.adopt('zs_fedcba9876543210', creds));
    assert.equal(fs.existsSync(path.join(dir, 'zs_fedcba9876543210', 'session.enc')), false, 'a refused session is not saved');
    s.forget(ID);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('P5: the Zalo session never leaves the máy Zalo (QR login, resume, receive, typing, a failed send)', async () => {
  const dir = tmp();
  const SECRET = { cookie: 'COOKIE-7f3a-zpw', imei: 'IMEI-5d1c-0042', userAgent: 'UA-Secret-Agent/1.0', enk: 'ENK-9b2e-key' };
  const loginInfo = { cookie: [{ key: 'zpw_sek', value: SECRET.cookie, domain: 'chat.zalo.me', path: '/' }], imei: SECRET.imei, userAgent: SECRET.userAgent };
  const E = { QRCodeGenerated: 0, QRCodeExpired: 1, QRCodeScanned: 2, QRCodeDeclined: 3, GotLoginInfo: 4 };
  const first = fakeZalo();
  const second = fakeZalo();
  // The send fails the way zca-js fails on a broken context: its message carries the whole context.
  first.sendMessage = async () => {
    throw new Error(`Invalid context ${JSON.stringify({ cookie: loginInfo.cookie, imei: SECRET.imei, secretKey: SECRET.enk, userAgent: SECRET.userAgent })}`);
  };
  const options = [];
  const resumed = [];
  const lib = {
    LoginQRCallbackEventType: E,
    Zalo: class {
      constructor(o) {
        options.push(o);
      }
      async loginQR(_o, cb) {
        cb({ type: E.QRCodeGenerated, data: { image: 'iVBORw0KGgo=', code: 'qr-code' }, actions: {} });
        cb({ type: E.QRCodeScanned, data: { avatar: '', display_name: 'Nick thử' }, actions: {} });
        cb({ type: E.GotLoginInfo, data: { ...loginInfo }, actions: {} });
        return first;
      }
      async login(c) {
        resumed.push(c);
        return second;
      }
    },
  };
  const approved = { id: 'ob9', uid: OWN, channel: 'zalo', threadId: '333', text: 'Dạ shop gửi giá ạ', status: 'approved', approvedBy: 'u1', approvedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
  let served = false;
  const f = fakeFetch((c) => {
    if (c.path === '/api/outbox/pending') {
      if (served) return [200, []];
      served = true;
      return [200, [approved]];
    }
    if (c.path === '/api/outbox/ob9/claim') return [200, { ...approved, status: 'sending' }];
    return [200, { accepted: 1, updated: 0, rejected: [] }];
  });
  const logs = [];
  const make = () => {
    const s = new DirectSessions({ farmDir: dir, sessionKeyHex: KEY_HEX, api: 'http://api.test', token: 'tok', timing: FAST }, (m) => logs.push(m), { slotOf: () => ({ uid: OWN }), fetch: f });
    s.lib = lib;
    return s;
  };
  const s = make();
  let s2 = null;
  try {
    s.start(ID);
    await until(() => first.listener.started === 1);
    first.listener.emit('connected');
    first.listener.emit('message', strangerDm('8342591539300', 'Cho em xin giá má phanh'));
    first.listener.emit('typing', { type: 0, threadId: '333', isSelf: false, data: { uid: '333', ts: String(Date.now()), isPC: 1 } });
    await until(() => f.calls.some((c) => c.path === '/api/outbox/ob9/result'));
    await until(() => f.calls.some((c) => c.path === '/api/ingest/messages'));
    const result = f.calls.find((c) => c.path === '/api/outbox/ob9/result').body;
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Zalo không nhận lệnh: lỗi bên trong thư viện Zalo (chi tiết không hiện để giữ kín phiên đăng nhập)');

    // The máy Zalo restarts: the saved session is read back and handed to zca-js as it came.
    s.stop(s.rt.get(ID));
    s.rt.delete(ID);
    s2 = make();
    s2.start(ID);
    await until(() => second.listener.started === 1);
    assert.deepEqual(resumed, [loginInfo]);
    second.listener.emit('connected');
    second.listener.emit('message', strangerDm('8342591539400', 'Còn hàng không shop'));
    await until(() => f.calls.some((c) => c.path === '/api/ingest/messages' && c.body.items.some((i) => i.msgId === '8342591539400')));

    // zca-js never checks npm for updates and never logs (its logger prints whole requests).
    assert.ok(options.length >= 2);
    for (const o of options) assert.deepEqual([o.checkUpdate, o.logging], [false, false]);
    // Saved only encrypted, owner-only, next to ids-only files.
    const slotDir = path.join(dir, ID);
    const sessionFile = fs.readFileSync(path.join(slotDir, 'session.enc')).toString('latin1');
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(path.join(slotDir, 'session.enc')).mode & 0o777, 0o600);
      assert.equal(fs.statSync(slotDir).mode & 0o777, 0o700);
    }
    const nextToIt = fs
      .readdirSync(slotDir)
      .filter((n) => n !== 'session.enc')
      .map((n) => fs.readFileSync(path.join(slotDir, n), 'utf8'))
      .join('\n');
    const where = {
      'API calls (URL, headers, body)': f.calls.map((c) => c.raw).join('\n'),
      'agent log': logs.join('\n'),
      'slot state given to the API': JSON.stringify([s2.state(ID, true), s2.state(ID, false)]),
      'files next to the session': nextToIt,
      'session file (encrypted)': sessionFile,
    };
    for (const [place, text] of Object.entries(where)) {
      for (const v of [...Object.values(SECRET), KEY_HEX]) assert.equal(text.includes(v), false, `${place} must not contain ${v}`);
    }
    for (const content of ['má phanh', 'Còn hàng']) assert.equal(logs.join('\n').includes(content), false, 'no message content in the log');

    // Disconnect: the session is gone.
    s2.forget(ID);
    assert.equal(fs.existsSync(path.join(slotDir, 'session.enc')), false);
  } finally {
    s.forget(ID);
    s2?.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('group events: a system line in the group, never moving the catch-up cursor; friend requests synced as full lists', async () => {
  const dir = tmp();
  const { s, f, zalo } = session(dir, { uid: OWN }, () => [200, { accepted: 1, rejected: [], received: 1 }]);
  try {
    // Pending requests go out once bound: received with its row, sent as an (empty) full list.
    await until(() => f.calls.filter((c) => c.path === `/api/contacts/${OWN}/friend-requests/dom`).length >= 2);
    const lists = f.calls.filter((c) => c.path === `/api/contacts/${OWN}/friend-requests/dom`).map((c) => c.body);
    assert.deepEqual(
      lists.map((b) => [b.direction, b.complete, b.count, b.items.map((i) => i.userId)]),
      [
        ['received', true, 1, ['555']],
        ['sent', true, 0, []],
      ],
    );
    zalo.listener.emit('message', customerInGroup('8342591539249', 'tin thường'));
    zalo.listener.emit('group_event', { type: 'join', act: 'join', threadId: GROUP_ID, isSelf: false, data: { groupId: GROUP_ID, time: String(Date.now()), sourceId: '111', updateMembers: [{ id: '222', dName: 'Chị Lan' }] } });
    await until(() => f.calls.some((c) => c.path === '/api/ingest/messages' && c.body.items.some((i) => i.systemEvent)));
    const sys = f.calls.flatMap((c) => (c.path === '/api/ingest/messages' ? c.body.items : [])).find((i) => i.systemEvent);
    assert.deepEqual([sys.threadId, sys.senderName, sys.systemEvent], [`g${GROUP_ID}`, 'Chị Lan', { act: 'join', actorId: '222' }]);
    await until(() => fs.existsSync(path.join(dir, ID, 'cursor.json')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, ID, 'cursor.json'), 'utf8')).group, '8342591539249');
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('typing: a realtime call per conversation at most every 3 seconds, only once bound', async () => {
  const dir = tmp();
  const slot = { uid: null };
  const { s, f, zalo } = session(dir, slot, () => [200, { ok: true }]);
  try {
    const typing = () => zalo.listener.emit('typing', { type: 0, threadId: '333', isSelf: false, data: { uid: '333', ts: String(Date.now()), isPC: 1 } });
    typing();
    await sleep(30);
    assert.equal(f.calls.some((c) => c.path === '/api/ingest/typing'), false, 'nothing before the nick is bound');
    slot.uid = OWN;
    typing();
    typing();
    typing();
    await until(() => f.calls.some((c) => c.path === '/api/ingest/typing'));
    await sleep(50);
    const calls = f.calls.filter((c) => c.path === '/api/ingest/typing');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body, { uid: OWN, threadId: '333', who: '333' });
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('receive: delivered / seen events go to the status route after the messages', async () => {
  const dir = tmp();
  const { s, f, zalo } = session(dir, { uid: OWN }, () => [200, { accepted: 1, updated: 1, rejected: [] }]);
  try {
    zalo.listener.emit('delivered_messages', [{ type: 0, threadId: '333', isSelf: false, data: { msgId: '9', deliveredUids: ['333'] } }]);
    zalo.listener.emit('seen_messages', [{ type: 1, threadId: GROUP_ID, isSelf: true, data: { groupId: GROUP_ID, msgId: '7', seenUids: [OWN] } }]);
    await until(() => f.calls.some((c) => c.path === '/api/ingest/message-status'));
    const items = f.calls.filter((c) => c.path === '/api/ingest/message-status').flatMap((c) => c.body.items);
    assert.deepEqual(items, [
      { threadId: '333', event: 'delivered', msgId: '9' },
      { threadId: `g${GROUP_ID}`, event: 'read', msgId: '7' },
    ]);
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('stickers: Zalo search cached per keyword; a picked sticker is sent by id; the default set is refused clearly', async () => {
  const dir = tmp();
  const base = { uid: OWN, channel: 'zalo', threadId: `g${GROUP_ID}`, status: 'approved', approvedBy: 'u1', approvedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
  const picked = { ...base, id: 'ob1', action: 'send_sticker', text: '[Sticker]', sticker: { set: 'Zalo', index: 1, id: 46991, cateId: 10, type: 7 } };
  const onion = { ...base, id: 'ob2', action: 'send_sticker', text: '[Sticker]', sticker: { set: 'Củ hành', index: 3 } };
  let round = 0;
  const { s, f, zalo } = session(dir, { uid: OWN }, (c) => {
    if (c.path === '/api/outbox/pending') {
      round += 1;
      return [200, round === 1 ? [picked, onion] : []];
    }
    const mm = /^\/api\/outbox\/(ob\d)\/claim$/.exec(c.path);
    if (mm) return [200, { ...[picked, onion].find((x) => x.id === mm[1]), status: 'sending' }];
    return [200, { accepted: 1, rejected: [] }];
  });
  try {
    const found = await s.stickers(ID, 'Chào');
    assert.deepEqual(found.map((x) => x.id), [46991, 46992]);
    assert.equal(found[0].url, 'https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=46991&size=130');
    await s.stickers(ID, 'chào ');
    assert.equal(zalo.calls.filter((x) => x[0] === 'getStickers').length, 1, 'second search from the cache');

    await until(() => f.calls.some((c) => c.path === '/api/outbox/ob2/result'));
    const sent = zalo.calls.find((x) => x[0] === 'sendSticker');
    assert.deepEqual(sent.slice(1), [{ id: 46991, cateId: 10, type: 7 }, GROUP_ID, 1]);
    assert.equal(f.calls.find((c) => c.path === '/api/outbox/ob1/result').body.ok, true);
    const refused = f.calls.find((c) => c.path === '/api/outbox/ob2/result').body;
    assert.equal(refused.ok, false);
    assert.match(refused.error, /ô tìm sticker/);
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('send: unsupported commands fail with a reason instead of hanging; a missing reply target still sends the text', async () => {
  const dir = tmp();
  const slot = { uid: OWN };
  const base = { uid: OWN, channel: 'zalo', threadId: '333', status: 'approved', approvedBy: 'u1', approvedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
  const sticker = { ...base, id: 'ob1', action: 'send_sticker', text: '[Sticker]', sticker: { set: 'Mặc định', index: 1 } };
  const reply = { ...base, id: 'ob2', text: 'Dạ', replyToCliMsgId: '999' };
  let round = 0;
  const { s, f, zalo } = session(dir, slot, (c) => {
    if (c.path === '/api/outbox/pending') {
      round += 1;
      return [200, round === 1 ? [sticker, reply] : []];
    }
    const m = /^\/api\/outbox\/(ob\d)\/claim$/.exec(c.path);
    if (m) return [200, { ...[sticker, reply].find((x) => x.id === m[1]), status: 'sending' }];
    return [200, { accepted: 1, rejected: [] }];
  });
  try {
    await until(() => f.calls.some((c) => c.path === '/api/outbox/ob2/result'));
    const r1 = f.calls.find((c) => c.path === '/api/outbox/ob1/result').body;
    assert.equal(r1.ok, false);
    assert.match(r1.error, /sticker/);
    const r2 = f.calls.find((c) => c.path === '/api/outbox/ob2/result').body;
    assert.equal(r2.ok, true);
    assert.equal(zalo.calls[0][1].quote, undefined);
    assert.deepEqual(zalo.calls[0].slice(2), ['333', 0]);
  } finally {
    s.forget(ID);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
