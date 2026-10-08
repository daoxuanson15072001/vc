import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIELD_MAPPING,
  fieldMappingSpecSchema,
  findSensitivePaths,
  isEncryptedRecord,
  mapRecord,
  mergeDefaultMapping,
  stripEncryptedValues,
  stripSensitive,
  validateItems,
  validateThreadNames,
} from '../src';

const ctx = { uid: '111', groupIds: new Set(['g900']) };

describe('sensitive field guard', () => {
  it('flags E2EE material, tokens and cookies at any depth', () => {
    const paths = findSensitivePaths({
      e2ee_session: 'x',
      nested: { refresh_token: 'y', list: [{ cookie: 'z' }, { e2ee_identity_key: 1 }] },
      password: 'p',
      otp: '123456',
    });
    expect(paths).toEqual(
      expect.arrayContaining([
        'e2ee_session',
        'nested.refresh_token',
        'nested.list[0].cookie',
        'nested.list[1].e2ee_identity_key',
        'password',
        'otp',
      ]),
    );
  });

  it('flags the bare e2ee object found on Zalo group records', () => {
    expect(findSensitivePaths({ userId: 'g1', e2ee: { v: 1 } })).toEqual(['e2ee']);
  });

  it('does not flag legit Zalo fields such as e2eeStatus', () => {
    expect(findSensitivePaths({ e2eeStatus: 0, msgType: 'webchat', footprint: 1 })).toEqual([]);
  });

  it('strips sensitive keys without touching the rest', () => {
    expect(stripSensitive({ a: 1, access_token: 't', b: { e2ee_session: 's', c: 2 } })).toEqual({
      a: 1,
      b: { c: 2 },
    });
  });
});

describe('validateItems', () => {
  const msg = {
    msgId: '7001',
    threadId: '222',
    fromUid: '222',
    sentAt: '1727500000000',
    text: 'Chào anh',
  };

  it('accepts a valid message and coerces sentAt to a number', () => {
    const { valid, rejected } = validateItems('messages', [msg]);
    expect(rejected).toEqual([]);
    expect(valid[0].item.sentAt).toBe(1727500000000);
  });

  it('rejects items carrying sensitive fields, even inside raw', () => {
    const { valid, rejected } = validateItems('messages', [
      { ...msg, raw: { e2ee_session: 'secret' } },
      { ...msg, msgId: '7002', refresh_token: 'x' },
      { ...msg, msgId: '7003' },
    ]);
    expect(valid.map((v) => v.item.msgId)).toEqual(['7003']);
    expect(rejected).toHaveLength(2);
    expect(rejected[0]).toMatchObject({ index: 0, id: '7001' });
    expect(rejected[0].reason).toMatch(/^sensitive_field: raw\.e2ee_session/);
    expect(rejected[1].reason).toMatch(/refresh_token/);
  });

  it('rejects unknown top-level fields and missing required fields', () => {
    const { rejected } = validateItems('messages', [{ ...msg, foo: 1 }, { msgId: '1' }]);
    expect(rejected).toHaveLength(2);
    expect(rejected[0].reason).toMatch(/Unrecognized key/);
  });

  it('rejects items whose raw record is Zalo Web ciphertext (ev)', () => {
    const { valid, rejected } = validateItems('messages', [
      { ...msg, raw: { msgId: '7001', message: 'lk4njWs4ssRmcxFy61oYAU76', ev: 1 } },
      { ...msg, msgId: '7002', raw: { msgId: '7002', ev: 0 } },
    ]);
    expect(valid.map((v) => v.item.msgId)).toEqual(['7002']);
    expect(rejected).toEqual([{ index: 0, id: '7001', reason: 'encrypted_record' }]);
  });

  it('rejects contacts with a token nested in bizInfo', () => {
    const { rejected } = validateItems('contacts', [{ userId: '5', bizInfo: { zpw_token: 'x' } }]);
    expect(rejected[0].reason).toMatch(/bizInfo\.zpw_token/);
  });
});

describe('mapRecord with the default mapping', () => {
  const m = DEFAULT_FIELD_MAPPING.streams;

  it('maps an incoming 1-1 text message and derives threadId from the sender', () => {
    const r = mapRecord(
      'messages',
      m.messages,
      { msgId: 1, fromUid: '222', toUid: '111', message: 'Báo giá lọc gió', sendDttm: '1727500000000', dName: 'A' },
      ctx,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item).toMatchObject({ threadId: '222', text: 'Báo giá lọc gió', senderName: 'A' });
    const { valid, rejected } = validateItems('messages', [r.item]);
    expect(rejected).toEqual([]);
    expect(valid).toHaveLength(1);
  });

  it('uses the peer as thread for my own messages and the group for group messages', () => {
    const own = mapRecord('messages', m.messages, { msgId: 2, fromUid: '0', toUid: '333', message: 'ok', sendDttm: 1 }, ctx);
    const grp = mapRecord('messages', m.messages, { msgId: 3, fromUid: '444', toUid: 'g900', message: 'hi', sendDttm: 1 }, ctx);
    expect(own.ok && own.item.threadId).toBe('333');
    expect(grp.ok && grp.item.threadId).toBe('g900');
  });

  it('files group messages under the group even when no group record was read in this run (incremental sync)', () => {
    const noGroups = { ...ctx, groupIds: new Set<string>() };
    const grp = mapRecord('messages', m.messages, { msgId: 4, fromUid: '444', toUid: 'g4469801440488432189', message: 'xk bán', sendDttm: 1 }, noGroups);
    const peer = mapRecord('messages', m.messages, { msgId: 5, fromUid: '444', toUid: '111', message: 'hi', sendDttm: 1 }, noGroups);
    expect(grp.ok && grp.item.threadId).toBe('g4469801440488432189');
    expect(peer.ok && peer.item.threadId).toBe('444');
  });

  it('keeps structured bodies as content and strips secrets from raw', () => {
    const r = mapRecord(
      'messages',
      m.messages,
      { msgId: 4, fromUid: '222', toUid: '111', sendDttm: 1, message: { title: 'file.pdf', href: 'u' }, e2ee_session: 'x' },
      ctx,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item.content).toEqual({ title: 'file.pdf', href: 'u' });
    expect(r.item.text).toBeUndefined();
    expect(findSensitivePaths(r.item)).toEqual([]);
  });

  it('reports missing required fields as drift', () => {
    const r = mapRecord('messages', m.messages, { id: 1, content: 'renamed' }, ctx);
    expect(r).toEqual({ ok: false, missing: expect.arrayContaining(['msgId', 'fromUid', 'sentAt']) });
  });

  it('maps contacts: isFr → isFriend, oaInfo → isOA', () => {
    const r = mapRecord('contacts', m.contacts, { userId: '9', isFr: 1, oaInfo: { id: 1 }, phoneNumber: '09' }, ctx);
    expect(r.ok && r.item).toMatchObject({ userId: '9', isFriend: true, isOA: true, phone: '09' });
    expect(r.ok && validateItems('contacts', [r.item]).rejected).toEqual([]);
  });
});

describe('mapRecord on encrypted records (metadata only)', () => {
  const m = DEFAULT_FIELD_MAPPING.streams;
  const CIPHER = 'lk4njWs4ssRmcxFy61oYAU76vmSyDd+x5JiglmWzlY=';

  it('ingests message metadata, drops ciphertext, marks content pending', () => {
    const r = mapRecord(
      'messages',
      m.messages,
      { msgId: '83132', fromUid: '222', toUid: '111', sendDttm: '1790573135240', message: CIPHER, dName: CIPHER, ev: 1 },
      ctx,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item).toMatchObject({
      msgId: '83132',
      threadId: '222',
      fromUid: '222',
      encrypted: true,
      contentStatus: 'pending',
    });
    // No ciphertext survives, in the item or in raw.
    expect(r.item.text).toBeUndefined();
    expect(r.item.senderName).toBeUndefined();
    expect(JSON.stringify(r.item)).not.toContain(CIPHER);
    expect((r.item.raw as Record<string, unknown>).ev).toBeUndefined();
    // Metadata is kept.
    expect((r.item.raw as Record<string, unknown>).sendDttm).toBe('1790573135240');
    // Passes the ingest schema.
    expect(validateItems('messages', [r.item]).rejected).toEqual([]);
  });

  it('ingests contact metadata and drops encrypted name/phone', () => {
    const r = mapRecord(
      'contacts',
      m.contacts,
      { userId: '9', displayName: CIPHER, zaloName: CIPHER, phoneNumber: CIPHER, username: 't_abc', isFr: 1, ev: 1 },
      ctx,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item).toMatchObject({ userId: '9', username: 't_abc', isFriend: true, encrypted: true });
    expect(r.item.displayName).toBeUndefined();
    expect(r.item.phone).toBeUndefined();
    expect(JSON.stringify(r.item)).not.toContain(CIPHER);
    expect(validateItems('contacts', [r.item]).rejected).toEqual([]);
  });

  it('completes recalled / sticker messages with a placeholder (empty bubble in the DOM)', () => {
    const recalled = mapRecord(
      'messages',
      m.messages,
      { msgId: '5', fromUid: '222', toUid: '111', sendDttm: 1, msgType: 20, message: CIPHER, ev: 1 },
      ctx,
    );
    expect(recalled.ok && recalled.item).toMatchObject({ text: '[Đã thu hồi]', contentStatus: 'complete', encrypted: true });
    const sticker = mapRecord('messages', m.messages, { msgId: '6', fromUid: '222', toUid: '111', sendDttm: 1, msgType: 4 }, ctx);
    expect(sticker.ok && sticker.item.text).toBe('[Sticker]');
    const photo = mapRecord('messages', m.messages, { msgId: '7', fromUid: '222', toUid: '111', sendDttm: 1, msgType: 2, ev: 1 }, ctx);
    expect(photo.ok && photo.item.contentStatus).toBe('pending');
  });

  it('marks a non-encrypted message content complete', () => {
    const r = mapRecord('messages', m.messages, { msgId: '1', fromUid: '222', toUid: '111', message: 'Chào', sendDttm: 1 }, ctx);
    expect(r.ok && r.item.contentStatus).toBe('complete');
    expect(r.ok && r.item.encrypted).toBeUndefined();
  });
});

describe('stripEncryptedValues', () => {
  it('removes ev and long ciphertext but keeps ids, numbers and short strings', () => {
    const out = stripEncryptedValues({
      msgId: '8313252062690',
      sendDttm: '1790573135240',
      username: 't_m7eggbdabi',
      gender: 0,
      memberIds: ['u1', 'u2'],
      message: 'lk4njWs4ssRmcxFy61oYAU76vmSyDd+x5JiglmWzlY=',
      ev: 1,
    });
    expect(out).toEqual({
      msgId: '8313252062690',
      sendDttm: '1790573135240',
      username: 't_m7eggbdabi',
      gender: 0,
      memberIds: ['u1', 'u2'],
    });
  });
});

describe('mapRecord for conversations', () => {
  it('derives type from isGroup', () => {
    const spec = { ...DEFAULT_FIELD_MAPPING.streams.conversations, fields: { threadId: 'userId', isGroup: 'isGroup' } };
    const g = mapRecord('conversations', spec, { userId: '9', isGroup: 1 }, { uid: '1', groupIds: new Set() });
    const u = mapRecord('conversations', spec, { userId: '8', isGroup: 0 }, { uid: '1', groupIds: new Set() });
    expect(g.ok && g.item).toMatchObject({ threadId: '9', type: 'group' });
    expect(u.ok && u.item).toMatchObject({ threadId: '8', type: 'user' });
    expect(g.ok && 'isGroup' in g.item).toBe(false);
  });

  it('maps Zalo pin flags and pin timestamps to a boolean', () => {
    const spec = DEFAULT_FIELD_MAPPING.streams.conversations;
    const ctx = { uid: '1', groupIds: new Set<string>() };
    const pinned = (v: unknown) => {
      const r = mapRecord('conversations', spec, { userId: '9', pinned: v }, ctx);
      return r.ok ? r.item.pinned : 'fail';
    };
    expect([pinned(1), pinned(true), pinned(1727000000000), pinned('1')]).toEqual([true, true, true, true]);
    expect([pinned(0), pinned(false), pinned(''), pinned(null), pinned('0')]).toEqual([false, false, false, false, false]);
    expect(mapRecord('conversations', spec, { userId: '9' }, ctx)).toMatchObject({ ok: true, item: { threadId: '9' } });
  });
});

describe('field mapping spec', () => {
  it('accepts the default mapping', () => {
    expect(fieldMappingSpecSchema.safeParse(DEFAULT_FIELD_MAPPING).success).toBe(true);
  });

  it('refuses mappings that point at E2EE stores or token fields', () => {
    const bad = structuredClone(DEFAULT_FIELD_MAPPING);
    bad.streams.messages.store = 'e2ee_session';
    expect(fieldMappingSpecSchema.safeParse(bad).success).toBe(false);
    const bad2 = structuredClone(DEFAULT_FIELD_MAPPING);
    bad2.streams.contacts.fields.phone = 'auth.refresh_token';
    expect(fieldMappingSpecSchema.safeParse(bad2).success).toBe(false);
  });

  it('keeps DOM selectors optional so older mappings stay valid', () => {
    const { dom: _dom, ...noDom } = DEFAULT_FIELD_MAPPING;
    expect(fieldMappingSpecSchema.safeParse(noDom).success).toBe(true);
  });

  it('refuses DOM tokens that could break out of an attribute selector, and bad regexes', () => {
    const bad = structuredClone(DEFAULT_FIELD_MAPPING);
    bad.dom!.bubbleIdPrefix = 'x"],script[src';
    expect(fieldMappingSpecSchema.safeParse(bad).success).toBe(false);
    const bad2 = structuredClone(DEFAULT_FIELD_MAPPING);
    bad2.dom!.imageSkip = '(unclosed';
    expect(fieldMappingSpecSchema.safeParse(bad2).success).toBe(false);
  });
});

describe('isEncryptedRecord', () => {
  it('flags a non-zero ev only', () => {
    expect(isEncryptedRecord({ ev: 1 })).toBe(true);
    expect(isEncryptedRecord({ ev: '2' })).toBe(true);
    expect(isEncryptedRecord({ ev: 0 })).toBe(false);
    expect(isEncryptedRecord({ ev: null })).toBe(false);
    expect(isEncryptedRecord({ msgId: '1' })).toBe(false);
    expect(isEncryptedRecord(null)).toBe(false);
    expect(isEncryptedRecord([{ ev: 1 }])).toBe(false);
  });
});

describe('validateThreadNames (sidebar extras)', () => {
  it('accepts optional avatar/unread/labels and drops non-https avatars', () => {
    const { valid, rejected } = validateThreadNames([
      { threadId: '1', name: 'A', avatar: 'https://s120.zdn.vn/a.jpg', unread: 5, labels: ['Khách hàng'] },
      { threadId: '2', name: 'B', avatar: 'http://x/a.jpg' },
      { threadId: '3', name: 'C', avatar: 'data:image/png;base64,AAA' },
    ]);
    expect(rejected).toEqual([]);
    expect(valid[0].item).toEqual({ threadId: '1', name: 'A', avatar: 'https://s120.zdn.vn/a.jpg', unread: 5, labels: ['Khách hàng'] });
    expect(valid[1].item.avatar).toBeUndefined();
    expect(valid[2].item.avatar).toBeUndefined();
  });

  it('rejects a bad unread count and unknown fields (e.g. a preview)', () => {
    const { valid, rejected } = validateThreadNames([
      { threadId: '1', name: 'A', unread: -1 },
      { threadId: '2', name: 'B', lastPreview: 'Bạn: ok' },
    ]);
    expect(valid).toEqual([]);
    expect(rejected.map((r) => r.id)).toEqual(['1', '2']);
  });
});

describe('optional streams (reactions, labels, read_state — surveyed 28/09/2026)', () => {
  const ctx = { uid: '111', groupIds: new Set<string>() };

  it('a v1 mapping without the optional streams is still valid, and the defaults fill them in', () => {
    const { reactions, labels, read_state, ...core } = DEFAULT_FIELD_MAPPING.streams;
    const v1 = { streams: core, dom: DEFAULT_FIELD_MAPPING.dom };
    expect(fieldMappingSpecSchema.safeParse(v1).success).toBe(true);
    const { spec, added } = mergeDefaultMapping(fieldMappingSpecSchema.parse(v1));
    expect(added).toEqual(expect.arrayContaining(['reactions', 'labels', 'read_state']));
    expect(spec.streams.reactions).toEqual(reactions);
    expect(spec.streams.labels).toEqual(labels);
    expect(spec.streams.read_state).toEqual(read_state);
    // Nothing to add the second time; approved paths are never overridden.
    const custom = { ...spec, streams: { ...spec.streams, contacts: { ...spec.streams.contacts, fields: { ...spec.streams.contacts.fields, phone: 'phone_v2' } } } };
    const again = mergeDefaultMapping(custom);
    expect(again.added).toEqual([]);
    expect(again.spec.streams.contacts.fields.phone).toBe('phone_v2');
  });

  it('adds fields the defaults gained (conversations.labelId, messages.status…) to an older stream', () => {
    const old = { ...DEFAULT_FIELD_MAPPING.streams.conversations, fields: { threadId: 'userId', isGroup: 'isGroup' } };
    const { spec, added } = mergeDefaultMapping({ ...DEFAULT_FIELD_MAPPING, streams: { ...DEFAULT_FIELD_MAPPING.streams, conversations: old } });
    expect(added).toEqual(expect.arrayContaining(['conversations.pinned', 'conversations.labelId']));
    expect(spec.streams.conversations.fields.labelId).toBe('label');
  });

  it('maps a reaction record: { reactor: { icon: count } }, ids as strings', () => {
    const rec = { rMsgId: '8315498399272', rClientMsgId: 1790608559166, idTo: 'g6910418193163461340', reactions: { '0': { '3': 2 }, '5970247071522722784': { '5': 1, bad: 'x' } }, currentIcon: 3, lastSender: '0', lastUpdate: 1790609510991, msgType: 'chat.reaction' };
    const r = mapRecord('reactions', DEFAULT_FIELD_MAPPING.streams.reactions!, rec, ctx);
    expect(r.ok && r.item).toMatchObject({ msgId: '8315498399272', cliMsgId: '1790608559166', threadId: 'g6910418193163461340', reactions: { '0': { '3': 2 }, '5970247071522722784': { '5': 1 } }, currentIcon: 3, lastSender: '0', lastUpdate: 1790609510991 });
    expect(validateItems('reactions', [r.ok && r.item]).rejected).toEqual([]);
  });

  it('maps a label record: the encrypted name is dropped (it comes from the sidebar), ids kept', () => {
    const rec = { id: 7, text: 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=', color: '#d91b1b', emoji: '', conversations: ['111', 222], offset: 3, createTime: 1727000000000, ev: 1 };
    const r = mapRecord('labels', DEFAULT_FIELD_MAPPING.streams.labels!, rec, ctx);
    expect(r.ok && r.item).toMatchObject({ labelId: '7', color: '#d91b1b', conversationIds: ['111', '222'], createdAt: 1727000000000, encrypted: true });
    expect(r.ok && 'name' in r.item).toBe(false);
    expect(validateItems('labels', [r.ok && r.item]).rejected).toEqual([]);
  });

  it('maps unreadInfo to read_state', () => {
    const r = mapRecord('read_state', DEFAULT_FIELD_MAPPING.streams.read_state!, { userId: '222', mId: 8315498399272, timestamp: 1790608559167 }, ctx);
    expect(r.ok && r.item).toMatchObject({ threadId: '222', lastReadMsgId: '8315498399272', at: 1790608559167 });
    expect(validateItems('read_state', [r.ok && r.item]).rejected).toEqual([]);
  });

  it('derives forwarded, status, ttl and group system events on messages', () => {
    const sm = DEFAULT_FIELD_MAPPING.streams.messages;
    const base = { msgId: '1', cliMsgId: '11', fromUid: '222', toUid: '111', msgType: 1, sendDttm: '1727500000000', message: 'hi', status: 3, ttl: 0 };
    const fwd = mapRecord('messages', sm, { ...base, reference: { type: 3, data: { id: 'x', ts: 1, logSrcType: 1, fwLvl: 1 } } }, ctx);
    expect(fwd.ok && fwd.item).toMatchObject({ forwarded: true, status: 3 });
    expect(fwd.ok && 'reference' in fwd.item).toBe(false);
    const plain = mapRecord('messages', sm, { ...base, reference: { type: 3, data: { id: 'x', ts: 1, logSrcType: 5 } } }, ctx);
    expect(plain.ok && 'forwarded' in plain.item).toBe(false);
    const ev = mapRecord('messages', sm, { ...base, msgId: '2', act: 'add_member', updateMemberIds: ['333', 444], eventInfo: { source: { id: '222', dName: 'X' }, updateMembers: [{ id: '333' }] } }, ctx);
    expect(ev.ok && ev.item).toMatchObject({ systemEvent: { act: 'add_member', actorId: '222', memberIds: ['333', '444'] } });
    expect(ev.ok && 'act' in ev.item).toBe(false);
    expect(validateItems('messages', [fwd.ok && fwd.item, ev.ok && ev.item]).rejected).toEqual([]);
    const ttl = mapRecord('messages', sm, { ...base, msgId: '3', ttl: 86400000 }, ctx);
    expect(ttl.ok && ttl.item.ttl).toBe(86400000);
  });
});
