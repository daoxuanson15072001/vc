// node --test tools/chrome-driver/test/*.test.js
// Synthetic zca-js payloads (shapes from zca-js 2.2.0 types and the P0 probe); no real message content.
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../farm-direct-map');

const OWN = '836061738303156140';
const groupMsg = (data, extra = {}) => ({ type: 1, threadId: '4816372702126795745', isSelf: false, data: { msgId: '8342591539249', cliMsgId: '1791257266839', uidFrom: '111', idTo: '4816372702126795745', dName: 'Anh Tuấn', ts: '1791257267584', msgType: 'webchat', content: 'giá má phanh?', ttl: 0, ...data }, ...extra });

test('text in a group: g-prefixed thread, sender, plain text, direct source, complete; raw keeps no content', () => {
  const it = m.messageItem(groupMsg({ propertyExt: { color: 0, size: 0, type: 0, subType: 0, ext: '{}' }, paramsExt: { countUnread: 1, containType: 0, platformType: 1 }, realMsgId: '0' }));
  assert.deepEqual(it, {
    msgId: '8342591539249',
    cliMsgId: '1791257266839',
    threadId: 'g4816372702126795745',
    fromUid: '111',
    toUid: 'g4816372702126795745',
    senderName: 'Anh Tuấn',
    msgType: 'webchat',
    text: 'giá má phanh?',
    content: null,
    sentAt: 1791257267584,
    contentStatus: 'complete',
    contentSource: 'direct',
    raw: { propertyExt: { color: 0, size: 0, type: 0, subType: 0, ext: '{}' }, paramsExt: { countUnread: 1, containType: 0, platformType: 1 }, source: 'zca-js' },
  });
  assert.equal(JSON.stringify(it.raw).includes('má phanh'), false);
});

test("own messages get fromUid '0' (zca-js rewrites it to the account uid); 1-1 thread is the partner", () => {
  const it = m.messageItem({ type: 0, threadId: '333', isSelf: true, data: { msgId: '5', cliMsgId: '6', uidFrom: OWN, idTo: '333', ts: 1791257267000, msgType: 'webchat', content: 'Dạ em chào anh' } });
  assert.equal(it.fromUid, '0');
  assert.equal(it.threadId, '333');
  assert.equal(it.toUid, '333');
  assert.equal(it.status, 1, 'own messages start at "Đã gửi"');
  assert.equal(m.messageItem(groupMsg({})).status, undefined);
  assert.equal(m.messageItem({ type: 0, threadId: '333', isSelf: false, data: { msgId: '', ts: 1 } }), null);
  assert.equal(m.messageItem({ type: 0, threadId: '333', isSelf: false, data: { msgId: '7', uidFrom: '333', ts: 'x' } }), null);
});

test('attachments become the Dashboard content body; unknown kinds get a placeholder, never an empty bubble', () => {
  const photo = m.messageItem(groupMsg({ msgType: 'chat.photo', content: { title: '', description: '', href: 'https://f.zdn.test/n.jpg', thumb: 'https://f.zdn.test/t.jpg', params: JSON.stringify({ hd: 'https://f.zdn.test/hd.jpg', width: 800 }) } }));
  assert.deepEqual(photo.content, { images: ['https://f.zdn.test/hd.jpg'], kind: 'image' });
  // Always sent (null when absent), so a newer mapping clears what an older one stored.
  assert.equal(photo.text, null);

  const file = m.contentOf('share.file', { title: 'bao-gia.pdf', href: 'https://dl.zdn.test/f', params: JSON.stringify({ fileSize: '1288490', fileExt: 'pdf' }) });
  assert.deepEqual(file.content, { files: [{ name: 'bao-gia.pdf', size: '1.2 MB', ext: 'pdf', url: 'https://dl.zdn.test/f' }], kind: 'file' });

  // A sticker shows its image (from its id); id / category / type stay in raw.sticker.
  const st = m.messageItem(groupMsg({ msgType: 'chat.sticker', content: { id: 46991, catId: 10, type: 7 } }));
  assert.deepEqual(st.content, { images: ['https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=46991&size=130'], kind: 'sticker' });
  assert.equal(st.text, null);
  assert.deepEqual(st.raw.sticker, { id: 46991, catId: 10, type: 7 });
  assert.deepEqual(m.contentOf('chat.sticker', {}), { text: '[Sticker]', content: { kind: 'sticker' } });
  assert.deepEqual(m.contentOf('chat.voice', { href: 'https://v.zdn.test/a.m4a', params: '{"duration":12400}' }).content, { voice: { url: 'https://v.zdn.test/a.m4a', durationSec: 12 }, kind: 'voice' });
  assert.deepEqual(m.contentOf('chat.video.msg', { href: 'https://v.zdn.test/v.mp4', thumb: 'https://v.zdn.test/v.jpg', params: '{"duration":3000}' }).content, {
    video: { url: 'https://v.zdn.test/v.mp4', thumb: 'https://v.zdn.test/v.jpg', durationSec: 3 },
    kind: 'video',
  });
  const link = m.contentOf('chat.recommended', { action: 'recommened.link', title: 'Phụ tùng', href: 'https://vc.test/p/1', params: '' });
  assert.equal(link.text, 'https://vc.test/p/1');
  assert.deepEqual(link.content, { links: ['https://vc.test/p/1'], card: { title: 'Phụ tùng', url: 'https://vc.test/p/1' }, kind: 'card' });
  const loc = m.contentOf('chat.location.new', { title: 'Cửa hàng', description: 'Số 1 Phố Huế', href: 'https://maps.test/x', params: '{"latitude":21.01,"longitude":105.85}' });
  assert.deepEqual(loc.content, { location: { lat: 21.01, lng: 105.85, title: 'Cửa hàng', address: 'Số 1 Phố Huế', url: 'https://maps.test/x' }, kind: 'location' });
  assert.deepEqual(m.contentOf('chat.todo', {}), { text: '[Giao việc]', content: { kind: 'other' } });
  assert.deepEqual(m.contentOf('chat.something.new', { title: 'Tiêu đề' }), { text: 'Tiêu đề', content: { kind: 'other' } });
  // Non-https media links are not kept.
  assert.deepEqual(m.contentOf('chat.photo', { href: 'http://insecure.test/a.jpg' }).content, { kind: 'image' });
});

test('a call message is a call line, not a link; its codes stay in raw.call', () => {
  const call = m.messageItem(
    groupMsg(
      { msgType: 'chat.recommended', content: { title: 'sendBubbleMessage', description: '', href: '', thumb: '', childnumber: 0, action: 'recommened.calltime', params: JSON.stringify({ callId: 77, duration: 95, reason: 0, isCaller: 0, isEnableCallback: 1, calltype: 0 }) } },
      { type: 0, threadId: '333' },
    ),
  );
  assert.deepEqual(call.content, { call: { outcome: 'ended', durationSec: 95 }, kind: 'call' });
  assert.equal(call.text, null);
  assert.deepEqual(call.raw.call, { calltype: 0, reason: 0, isCaller: 0, duration: 95 });
  assert.deepEqual(m.contentOf('chat.recommended', { action: 'recommened.calltime', params: '{"callId":1,"duration":0,"isCaller":0}' }).content.call, { outcome: 'missed' });
  assert.deepEqual(m.contentOf('chat.recommended', { action: 'recommened.calltime', params: '{"callId":1,"duration":0,"isCaller":1}' }).content.call, { outcome: 'unknown' });
});

test('a recall delivered as a message (chat.undo in a catch-up page) becomes the recall of its target', () => {
  const undo = { type: 1, threadId: '2304978249003015626', isSelf: false, data: { msgId: '8342600000000', cliMsgId: '1791257400000', msgType: 'chat.undo', uidFrom: '272', ts: '1791257400100', content: { globalMsgId: 8342591539249, cliMsgId: 1791257266839, deleteMsg: 1, srcId: {}, destId: {} } } };
  assert.equal(m.isUndoMessage(undo), true);
  assert.equal(m.isUndoMessage(groupMsg({})), false);
  assert.deepEqual(m.recallFromMessage(undo), { msgId: '8342591539249', cliMsgId: '1791257266839', threadId: 'g2304978249003015626', fromUid: '272', msgType: '20', sentAt: 1791257400100 });
});

test('reply keeps the quote ids the Dashboard resolves; mentions and raw lose sensitive keys', () => {
  const it = m.messageItem(
    groupMsg({
      quote: { ownerId: 222, cliMsgId: 1791257000000, globalMsgId: 8342500000000, cliMsgType: 1, ts: 1791257000001, msg: 'tin gốc', attach: '', fromD: 'Chị Lan', ttl: 0 },
      mentions: [{ uid: '222', pos: 0, len: 4, type: 0, token: 'x' }],
      propertyExt: { color: 0, secretKey: 'x' },
    }),
  );
  assert.deepEqual(it.quote, { ownerId: '222', cliMsgId: '1791257000000', globalMsgId: '8342500000000', cliMsgType: 1, ts: 1791257000001, msg: 'tin gốc', fromD: 'Chị Lan' });
  assert.deepEqual(it.mentions, [{ uid: '222', pos: 0, len: 4, type: 0 }]);
  assert.deepEqual(it.raw.propertyExt, { color: 0 });
});

test('recall: the recalled message again with msgType 20 and the undo time (the API keeps the send time)', () => {
  const u = { threadId: '4816372702126795745', isGroup: true, isSelf: false, data: { uidFrom: '111', ts: '1791257300000', content: { globalMsgId: 8342591539249, cliMsgId: 1791257266839, deleteMsg: 1 } } };
  assert.deepEqual(m.recallItem(u), { msgId: '8342591539249', cliMsgId: '1791257266839', threadId: 'g4816372702126795745', fromUid: '111', msgType: '20', sentAt: 1791257300000 });
  assert.equal(m.recallItem({ ...u, data: { ...u.data, content: {} } }), null);
});

test('reactions: Zalo code → VClinks icon id; own reaction is "0"; taking it back is icon null', () => {
  const r = (rIcon, rType, extra = {}) => ({
    threadId: '4816372702126795745',
    isGroup: true,
    isSelf: false,
    data: { uidFrom: '111', ts: '1791257301000', content: { rMsg: [{ gMsgID: '8342591539249', cMsgID: '1791257266839', msgType: 1 }], rIcon, rType, source: 6 } },
    ...extra,
  });
  assert.deepEqual(m.reactionItems(r('/-heart', 5)), [
    { msgId: '8342591539249', cliMsgId: '1791257266839', threadId: 'g4816372702126795745', delta: { reactor: '111', icon: '0' }, lastSender: '111', lastUpdate: 1791257301000 },
  ]);
  assert.equal(m.reactionItems(r('/-strong', 3))[0].delta.icon, '3');
  assert.equal(m.reactionItems(r(':-bye', 36))[0].delta.icon, '36');
  assert.equal(m.reactionItems(r('', -1))[0].delta.icon, null);
  assert.equal(m.reactionItems(r('/-heart', 5, { isSelf: true }))[0].delta.reactor, '0');
  const dm = m.reactionItems({ threadId: '333', isGroup: false, isSelf: false, data: { uidFrom: '333', ts: '1', content: { rMsg: [{ gMsgID: '9' }], rIcon: ':>', rType: 0 } } });
  assert.equal(dm[0].threadId, '333');
  assert.equal(dm[0].delta.icon, '5');
});

test('delivered / seen events: 1-1 = the other side; groups = other members, or the nick itself reading elsewhere', () => {
  const OWN_UID = '836';
  assert.deepEqual(m.statusItems('delivered', [{ type: 0, threadId: '333', isSelf: false, data: { msgId: '9', deliveredUids: ['333'] } }], OWN_UID), [
    { threadId: '333', event: 'delivered', msgId: '9' },
  ]);
  assert.deepEqual(m.statusItems('seen', [{ type: 0, threadId: '333', isSelf: false, data: { idTo: '333', msgId: '9' } }], OWN_UID), [{ threadId: '333', event: 'seen', msgId: '9' }]);
  // Group: others saw the nick's messages.
  assert.deepEqual(m.statusItems('seen', [{ type: 1, threadId: '48', isSelf: false, data: { groupId: '48', msgId: '7', seenUids: ['111'] } }], OWN_UID), [{ threadId: 'g48', event: 'seen', msgId: '7' }]);
  // Group: the nick read it on the phone (and someone else too).
  assert.deepEqual(m.statusItems('seen', [{ type: 1, threadId: '48', isSelf: true, data: { groupId: '48', msgId: '7', seenUids: ['836', '111'] } }], OWN_UID), [
    { threadId: 'g48', event: 'read', msgId: '7' },
    { threadId: 'g48', event: 'seen', msgId: '7' },
  ]);
  // Delivered only to the nick's own device: nothing about its own messages.
  assert.deepEqual(m.statusItems('delivered', [{ type: 1, threadId: '48', isSelf: true, data: { groupId: '48', msgId: '7', deliveredUids: ['836'] } }], OWN_UID), []);
  assert.deepEqual(m.statusItems('seen', [{ type: 0, threadId: '333', data: {} }], OWN_UID), []);
});

test('group events become the system line Zalo shows; the subject is who it happened to', () => {
  const T = 1791260000000;
  const ev = (type, data) => ({ type, threadId: '48', isSelf: false, act: type, data: { groupId: '48', time: String(T), sourceId: '111', ...data } });
  assert.deepEqual(m.groupEventItem(ev('join', { updateMembers: [{ id: '222', dName: 'Chị Lan' }] }), OWN), {
    msgId: `sys:48:join:${T}`,
    threadId: 'g48',
    fromUid: '222',
    senderName: 'Chị Lan',
    msgType: 'group.event',
    sentAt: T,
    systemEvent: { act: 'join', actorId: '222' },
    contentStatus: 'complete',
    contentSource: 'direct',
  });
  const many = m.groupEventItem(ev('remove_member', { updateMembers: ['1', '2', '3', '4', '5'].map((i) => ({ id: i, dName: `Người ${i}` })) }), OWN);
  assert.equal(many.senderName, 'Người 1, Người 2, Người 3 và 2 người khác');
  assert.equal(many.systemEvent.act, 'remove_member');
  // Rename: the subject is who did it, named from what the agent saw before.
  const rename = m.groupEventItem(ev('update', { updateMembers: [] }), OWN, (u) => (u === '111' ? 'Anh Tuấn' : undefined));
  assert.deepEqual([rename.systemEvent, rename.senderName], [{ act: 'update_name', actorId: '111' }, 'Anh Tuấn']);
  // The nick itself: "Bạn".
  const me = m.groupEventItem(ev('leave', { updateMembers: [{ id: OWN, dName: 'Nick' }] }), OWN);
  assert.deepEqual([me.fromUid, me.systemEvent.actorId, me.senderName], ['0', '0', undefined]);
  assert.equal(m.groupEventItem(ev('block_member', { updateMembers: [{ id: '9', dName: 'X' }] }), OWN).systemEvent.act, 'remove_member');
  assert.equal(m.groupEventItem(ev('new_pin_topic', { actorId: '111' }), OWN).systemEvent.act, 'pin');
  assert.equal(m.groupEventItem(ev('update_setting', {}), OWN), null);
  assert.equal(m.groupEventItem(ev('join_request', {}), OWN), null);
  // A time in seconds is read as such.
  assert.equal(m.groupEventItem(ev('new_link', { time: '1791260000' }), OWN).sentAt, 1791260000000);
});

test('friend requests: received (type 2 only) and sent, as the Dashboard rows (strict fields)', () => {
  const recv = m.receivedRequests({
    recommItems: [
      { recommItemType: 1, dataInfo: { userId: '555', displayName: 'Khách A', avatar: 'https://a.test/1.jpg', recommType: 2, recommTime: 1791260000000, recommInfo: { message: 'Chào shop' } } },
      { recommItemType: 1, dataInfo: { userId: '556', displayName: 'Gợi ý', recommType: 1 } },
      { recommItemType: 1, dataInfo: { userId: 'abc', displayName: 'Lạ', recommType: 2 } },
    ],
  });
  assert.equal(recv.length, 1);
  assert.deepEqual(Object.keys(recv[0]).sort(), ['avatar', 'dateText', 'message', 'name', 'userId']);
  assert.deepEqual([recv[0].userId, recv[0].name, recv[0].message], ['555', 'Khách A', 'Chào shop']);
  assert.equal(recv[0].dateText, '06/10');
  assert.equal(m.dateText(Date.UTC(2026, 9, 6, 18, 30)), '07/10', 'after 17:00 UTC it is already the next day in Vietnam');
  const sent = m.sentRequests({ 777: { userId: '777', zaloName: 'Đại lý B', avatar: 'http://not-https.test/a.jpg', fReqInfo: { message: '', src: 1, time: 1791260000 } } });
  assert.deepEqual(sent, [{ userId: '777', name: 'Đại lý B', dateText: sent[0].dateText }]);
  assert.deepEqual(m.receivedRequests(null), []);
  assert.deepEqual(m.sentRequests(undefined), []);
});

test('friends and groups: plain names, friend flag, g-prefixed group, members from memVerList, no e2ee key', () => {
  assert.deepEqual(m.contactItem({ userId: '111', displayName: 'Anh Tuấn', zaloName: 'Tuấn', username: '', phoneNumber: '0912345678', avatar: 'https://a.test/1.jpg', gender: 0, isFr: 1, lastActionTime: 1791200000000 }, true), {
    userId: '111',
    displayName: 'Anh Tuấn',
    zaloName: 'Tuấn',
    phone: '0912345678',
    avatar: 'https://a.test/1.jpg',
    gender: 0,
    isFriend: true,
    lastActionTime: 1791200000000,
  });
  assert.equal(m.contactItem({ userId: '333', zaloName: 'Khách' }).displayName, 'Khách');
  assert.equal(m.contactItem({ userId: '333', isFr: 0 }, false).isFriend, false);
  const g = m.groupItem({ groupId: '4816372702126795745', name: 'Đại lý miền Bắc', avt: 'https://a.test/g.jpg', memberIds: [], memVerList: ['111_3', '222_1'], adminIds: ['111'], creatorId: '111', e2ee: 1, version: '7' });
  assert.deepEqual(g, { groupId: 'g4816372702126795745', name: 'Đại lý miền Bắc', avatar: 'https://a.test/g.jpg', memberIds: ['111', '222'], adminIds: ['111'], creatorId: '111' });
});

test('threads and destinations round-trip; mentions positions; quote from memory or from the stored message', () => {
  assert.equal(m.threadIdOf(1, '48'), 'g48');
  assert.equal(m.threadIdOf(1, 'g48'), 'g48');
  assert.equal(m.threadIdOf(0, '48'), '48');
  assert.deepEqual(m.destOf('g48'), { id: '48', type: 1 });
  assert.deepEqual(m.destOf('333'), { id: '333', type: 0 });

  const text = '@Lan @Tuấn ơi, @Lan xem giúp';
  assert.deepEqual(
    m.mentionsFor(text, [
      { name: 'Lan', uid: '222' },
      { name: 'Tuấn', uid: '111' },
      { name: 'Lan', uid: '222' },
      { name: 'Không uid' },
    ]),
    [
      { pos: 0, uid: '222', len: 4 },
      { pos: 5, uid: '111', len: 5 },
      { pos: 15, uid: '222', len: 4 },
    ],
  );

  const cached = { msgId: '9', cliMsgId: '8', msgType: 'chat.photo', content: { href: 'https://f.test/a.jpg' }, propertyExt: undefined, uidFrom: '111', ts: '1791257267584', ttl: 0 };
  assert.deepEqual(m.quoteFor(cached, null, OWN), { content: { href: 'https://f.test/a.jpg' }, msgType: 'chat.photo', propertyExt: undefined, uidFrom: '111', msgId: '9', cliMsgId: '8', ts: '1791257267584', ttl: 0 });
  const fromDb = m.quoteFor(null, { msgId: '9', cliMsgId: '8', fromUid: '0', msgType: 'webchat', sentAt: new Date(1791257267584).toISOString(), text: 'Dạ vâng' }, OWN);
  assert.deepEqual(fromDb, { content: 'Dạ vâng', msgType: 'webchat', propertyExt: undefined, uidFrom: OWN, msgId: '9', cliMsgId: '8', ts: '1791257267584', ttl: 0 });
  assert.equal(m.quoteFor(null, null, OWN), null);
});

test('image size from the header (PNG, GIF, JPEG, WebP); file names zca-js accepts', () => {
  const png = Buffer.alloc(32);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  assert.deepEqual(m.imageSize(png), { width: 640, height: 480 });
  const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([0x20, 0x03, 0x58, 0x02]), Buffer.alloc(20)]);
  assert.deepEqual(m.imageSize(gif), { width: 800, height: 600 });
  // JPEG: SOI, APP0 (length 16), SOF0 with height 300, width 400.
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Buffer.alloc(14), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x90, 0x03, ...Buffer.alloc(12)]);
  assert.deepEqual(m.imageSize(jpg), { width: 400, height: 300 });
  const webp = Buffer.alloc(32);
  webp.write('RIFF', 0, 'ascii');
  webp.write('WEBP', 8, 'ascii');
  webp.write('VP8X', 12, 'ascii');
  webp.writeUIntLE(1023, 24, 3);
  webp.writeUIntLE(767, 27, 3);
  assert.deepEqual(m.imageSize(webp), { width: 1024, height: 768 });
  assert.deepEqual(m.imageSize(Buffer.from('not an image at all, really')), {});

  assert.equal(m.fileNameFor('Báo giá 12/2026.pdf', 'application/pdf'), 'Báo giá 12_2026.pdf');
  assert.equal(m.fileNameFor('anh-xe', 'image/jpeg'), 'anh-xe.jpg');
  assert.equal(m.fileNameFor('', 'application/x-unknown'), 'tep.bin');
});

test('probe shapes keep key names and types, never values; error text has no message content', () => {
  const shape = m.shapeOf({ title: 'bao-gia.pdf', href: 'https://dl.zdn.test/f', params: '{"fileSize":"1"}', nested: { a: 1, list: ['x'] } });
  assert.deepEqual(shape, { title: 'string', href: 'string', params: 'string', nested: { a: 'number', list: ['string'] } });
  assert.equal(JSON.stringify(shape).includes('bao-gia'), false);
  const e = Object.assign(new Error('Request failed with status code 404'), { code: 114 });
  assert.equal(m.errorText(e), 'Zalo không nhận lệnh (mã 114): Request failed with status code 404');
  // zca-js puts its whole context (cookie, imei, secret key) into some messages: those never reach the API.
  const leaky = new Error(`Invalid context ${JSON.stringify({ cookie: [{ key: 'zpw_sek', value: 'COOKIE-1' }], imei: 'IMEI-1', secretKey: 'ENK-1' }, null, 2)}`);
  for (const err of [leaky, new Error('bad cookie jar'), new Error('Response: {"data":1}'), 'userAgent mismatch']) {
    const text = m.errorText(err);
    assert.equal(text, 'Zalo không nhận lệnh: lỗi bên trong thư viện Zalo (chi tiết không hiện để giữ kín phiên đăng nhập)');
  }
  assert.equal(m.errorText(Object.assign(new Error('Tham số không hợp lệ'), { code: 112 })), 'Zalo không nhận lệnh (mã 112): Tham số không hợp lệ');
  assert.equal(m.sizeText(512), '512 B');
  assert.equal(m.sizeText(20 * 1024 * 1024), '20 MB');
});
