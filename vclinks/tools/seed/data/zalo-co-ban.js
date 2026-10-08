'use strict';
/**
 * M1-00 seed: fake Zalo accounts TD-NK02…NK08, a few customers, conversations and sample messages.
 * TD-NK01 is the real driver nick and is never seeded (it comes from the extension).
 * Each later session adds its own file next to this one and lists it in ../seed-td.js.
 * Times derive from T (see ../seed-td.js) so the data stays identical between runs.
 */
const MIN = 60_000;

const NICKS = [
  ['02', 'Linh VCparts'],
  ['03', 'Tú VCparts'],
  ['04', 'Hải VCparts'],
  ['05', 'Toàn VCparts'],
  ['06', 'VCparts HN 06'],
  ['07', 'Phương VCparts'],
  ['08', 'Trang VCedu'],
];
/** TD §1.2: fake Zalo uids are `9000000000000xx`. */
const nickUid = (n) => `90000000000${n}`;

// Customers of TD-NK02 (TD-K01 Garage Minh Phát, TD-K02 chị Mai, TD-K03 Garage Minh Khoa).
const CUSTOMERS = [
  { userId: '9100000000101', displayName: 'Trần Văn Tuấn (Garage Minh Phát)', phone: '0900000101' },
  { userId: '9100000000201', displayName: 'Phạm Thị Mai', phone: '0900000201' },
  { userId: '9100000000301', displayName: 'Ngô Minh Khoa (Garage Minh Khoa)', phone: '0900000301' },
];
const SCRIPT = [
  ['in', 'Chào em, bên em còn má phanh Hilux 2018 không?', -30],
  ['out', 'Dạ anh cho em xin số khung (VIN) để em tra đúng mã ạ.', -25],
  ['in', 'Số khung MR0FZ29G800123456 nhé.', -20],
  ['out', 'Dạ em tra rồi gửi anh báo giá trong ít phút ạ.', -15],
];

module.exports = function build(T) {
  const SEED = { seed: 'TD' };
  const accounts = NICKS.map(([n, label]) => ({ uid: nickUid(n), label }));
  const uid = nickUid('02');
  const contacts = CUSTOMERS.map((c) => ({ ...c, isFriend: true, lastActionTime: T - 15 * MIN, raw: SEED }));
  const conversations = CUSTOMERS.map((c) => ({ threadId: c.userId, type: 'user', lastMsgAt: T - 15 * MIN, unread: 0, raw: SEED }));
  const messages = [];
  CUSTOMERS.forEach((c, ci) => {
    SCRIPT.forEach(([dir, text, offMin], i) => {
      const incoming = dir === 'in';
      messages.push({
        msgId: String(7000 + ci * 10 + i),
        threadId: c.userId,
        fromUid: incoming ? c.userId : '0',
        toUid: incoming ? uid : c.userId,
        senderName: incoming ? c.displayName : 'Linh VCparts',
        msgType: 'webchat',
        text,
        sentAt: T + offMin * MIN,
        raw: SEED,
      });
    });
  });
  return { accounts, perAccount: [{ uid, contacts, conversations, messages }] };
};
