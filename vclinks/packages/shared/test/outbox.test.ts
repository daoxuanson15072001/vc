import { describe, expect, it } from 'vitest';
import {
  outboxAttachmentUploadSchema,
  outboxCancelSchema,
  outboxCreateSchema,
  outboxLabel,
  outboxListQuerySchema,
  outboxResultSchema,
  outboxSources,
  outboxTransition,
  NON_MESSAGE_ACTIONS,
  FRIEND_ACTIONS,
  OUTBOX_EVENTS,
  OUTBOX_EXPIRE_MS,
  OUTBOX_RECONNECT_HOLD_MS,
  OUTBOX_STATUSES,
  OUTBOX_STATUS_LABELS,
  OUTBOX_TRANSITIONS,
  onBehalfLabel,
  type OutboxEvent,
  type OutboxStatus,
} from '../src/outbox';

describe('outbox schemas', () => {
  it('trims text and enforces 1..2000 chars', () => {
    expect(outboxCreateSchema.parse({ uid: 111, threadId: '222', text: '  Dạ anh  ' })).toEqual({
      uid: '111',
      threadId: '222',
      text: 'Dạ anh',
    });
    expect(outboxCreateSchema.safeParse({ uid: '1', threadId: '2', text: '   ' }).success).toBe(false);
    expect(outboxCreateSchema.safeParse({ uid: '1', threadId: '2', text: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('requires an error reason on failure and an ISO sentAt', () => {
    expect(outboxResultSchema.safeParse({ ok: false }).success).toBe(false);
    expect(outboxResultSchema.safeParse({ ok: false, error: 'không tìm thấy hội thoại' }).success).toBe(true);
    expect(outboxResultSchema.safeParse({ ok: true, sentAt: '2026-09-28T03:00:00.000Z' }).success).toBe(true);
    expect(outboxResultSchema.safeParse({ ok: true, sentAt: 'hôm qua' }).success).toBe(false);
  });
});

describe('outbox commands', () => {
  const base = { uid: '111', threadId: 'g9' };
  const img = 'a'.repeat(64);
  const ok = (v: unknown) => outboxCreateSchema.safeParse(v).success;

  it('keeps plain text items unchanged (no action = send_text)', () => {
    expect(outboxCreateSchema.parse({ ...base, text: 'Dạ' })).toEqual({ ...base, text: 'Dạ' });
    expect(ok({ ...base, action: 'send_text' })).toBe(false);
  });

  it('requires every mention to appear as @Name in the text', () => {
    expect(ok({ ...base, text: 'Chào @A.A vợ nhé', mentions: [{ name: 'A.A vợ' }] })).toBe(true);
    expect(ok({ ...base, text: 'Chào anh', mentions: [{ name: 'A.A vợ' }] })).toBe(false);
  });

  it('checks each action has exactly its own payload', () => {
    expect(ok({ ...base, action: 'send_images', attachments: [img, img.replace(/a/g, 'b')] })).toBe(true);
    expect(ok({ ...base, action: 'send_images', attachments: [] })).toBe(false);
    expect(ok({ ...base, action: 'send_images', attachments: [img], text: 'caption' })).toBe(false);
    expect(ok({ ...base, action: 'send_file', attachments: [img] })).toBe(true);
    expect(ok({ ...base, action: 'send_file', attachments: [img, img] })).toBe(false);
    expect(ok({ ...base, action: 'send_card', card: { name: '9C_Hiệp Lễ', withPhone: true } })).toBe(true);
    expect(ok({ ...base, action: 'create_poll', poll: { question: 'Ăn trưa?', options: ['Cơm', 'Phở'] } })).toBe(true);
    expect(ok({ ...base, action: 'create_poll', poll: { question: 'Ăn trưa?', options: ['Cơm'] } })).toBe(false);
    expect(ok({ ...base, action: 'create_poll', poll: { question: 'x'.repeat(201), options: ['a', 'b'] } })).toBe(false);
  });

  it('labels commands for lists and the approval filter', () => {
    expect(outboxLabel({ action: 'send_images', attachments: [{ name: 'a' }, { name: 'b' }] })).toBe('[2 ảnh]');
    expect(outboxLabel({ action: 'send_file', attachments: [{ name: 'bao-gia.pdf' }] })).toBe('[File] bao-gia.pdf');
    expect(outboxLabel({ action: 'send_card', card: { name: 'An' } })).toBe('[Danh thiếp] An');
    expect(outboxLabel({ action: 'create_poll', poll: { question: 'Ăn trưa?' } })).toBe('[Bình chọn] Ăn trưa?');
    expect(outboxLabel({ text: 'Dạ' })).toBe('Dạ');
  });

  it('rejects attachment names with path parts', () => {
    const b = { mime: 'application/pdf', dataBase64: 'AAAA' };
    expect(outboxAttachmentUploadSchema.safeParse({ ...b, fileName: 'bao gia.pdf' }).success).toBe(true);
    expect(outboxAttachmentUploadSchema.safeParse({ ...b, fileName: '../x.pdf' }).success).toBe(false);
  });
});

describe('state commands: react, pin_conversation, mark_read / mark_unread (28/09/2026)', () => {
  const base = { uid: '476214826876503713', threadId: 'g6910418193163461340' };
  it('react needs a message and one of Zalo\'s six icons; nothing else', () => {
    expect(outboxCreateSchema.safeParse({ ...base, action: 'react', reaction: { cliMsgId: '1790608559166', icon: '3' } }).success).toBe(true);
    expect(outboxCreateSchema.safeParse({ ...base, action: 'react', reaction: { cliMsgId: '1', icon: '9' } }).success).toBe(false);
    expect(outboxCreateSchema.safeParse({ ...base, action: 'react' }).success).toBe(false);
    expect(outboxCreateSchema.safeParse({ ...base, action: 'react', reaction: { cliMsgId: '1', icon: '3' }, text: 'x' }).success).toBe(false);
    expect(outboxLabel({ action: 'react', reaction: { icon: '3' } })).toBe('[Cảm xúc 👍]');
    expect(outboxLabel({ action: 'react', reaction: { icon: '0' } })).toBe('[Cảm xúc ❤️]');
  });
  it('pin_conversation needs a boolean; mark_read / mark_unread take nothing', () => {
    expect(outboxCreateSchema.safeParse({ ...base, action: 'pin_conversation', pin: true }).success).toBe(true);
    expect(outboxCreateSchema.safeParse({ ...base, action: 'pin_conversation' }).success).toBe(false);
    expect(outboxCreateSchema.safeParse({ ...base, action: 'mark_read' }).success).toBe(true);
    expect(outboxCreateSchema.safeParse({ ...base, action: 'mark_unread', text: 'x' }).success).toBe(false);
    expect(outboxLabel({ action: 'pin_conversation', pin: false })).toBe('[Bỏ ghim hội thoại]');
    expect(outboxLabel({ action: 'mark_unread' })).toBe('[Đánh dấu chưa đọc]');
    expect(NON_MESSAGE_ACTIONS).toEqual(['react', 'pin_conversation', 'mark_read', 'mark_unread', ...FRIEND_ACTIONS]);
  });
});

describe('send_sticker', () => {
  const base = { uid: '111', threadId: '222' };
  const ok = (v: unknown) => outboxCreateSchema.safeParse(v).success;
  const thumb = 'https://stc-chat.zdn.vn/images/stickers/default/thumb/3.png';

  it('needs a set title and a 1-based position; the thumbnail is optional', () => {
    expect(ok({ ...base, action: 'send_sticker', sticker: { set: 'Củ hành', index: 3, thumbUrl: thumb } })).toBe(true);
    expect(ok({ ...base, action: 'send_sticker', sticker: { set: 'Củ hành', index: 3 } })).toBe(true);
    expect(ok({ ...base, action: 'send_sticker', sticker: { set: 'Củ hành', index: 0 } })).toBe(false);
    expect(ok({ ...base, action: 'send_sticker', sticker: { set: '', index: 1 } })).toBe(false);
    expect(ok({ ...base, action: 'send_sticker', sticker: { set: 'Củ hành', index: 1, thumbUrl: 'not a url' } })).toBe(false);
    expect(ok({ ...base, action: 'send_sticker' })).toBe(false);
    expect(ok({ ...base, action: 'send_sticker', sticker: { set: 'Củ hành', index: 1 }, text: 'x' })).toBe(false);
    expect(ok({ ...base, action: 'send_card', card: { name: 'An' }, sticker: { set: 'Củ hành', index: 1 } })).toBe(false);
  });

  it('is labelled with the set and position', () => {
    expect(outboxLabel({ action: 'send_sticker', sticker: { set: 'Củ hành', index: 3 } })).toBe('[Sticker] Củ hành #3');
  });
});

describe('outbox state machine (03 Sơ đồ 2, SZ-11, SZ-28)', () => {
  // Every edge of the diagram that M1a-05 implements; anything else must be refused.
  const expected: [OutboxStatus, OutboxEvent, OutboxStatus][] = [
    ['approved', 'claim', 'sending'],
    ['sending', 'sent', 'sent'],
    ['approved', 'sent', 'sent'],
    ['sending', 'fail', 'failed'],
    ['approved', 'expire', 'expired'],
    ['awaiting_confirm', 'expire', 'expired'],
    ['approved', 'reconnect', 'awaiting_confirm'],
    ['failed', 'retry', 'approved'],
    ['expired', 'retry', 'approved'],
    ['sending', 'retry', 'approved'],
    ['awaiting_confirm', 'confirm', 'approved'],
    ['approved', 'cancel', 'cancelled'],
    ['failed', 'cancel', 'cancelled'],
    ['expired', 'cancel', 'cancelled'],
    ['awaiting_confirm', 'cancel', 'cancelled'],
    // M1b-10: Cần duyệt lại (D40, PQ-51)
    ['approved', 'hold', 'needs_reapproval'],
    ['failed', 'hold', 'needs_reapproval'],
    ['expired', 'hold', 'needs_reapproval'],
    ['awaiting_confirm', 'hold', 'needs_reapproval'],
    ['needs_reapproval', 'reapprove', 'approved'],
    ['needs_reapproval', 'cancel', 'cancelled'],
  ];

  it.each(expected)('%s --%s--> %s', (from, event, to) => {
    expect(outboxTransition(from, event)).toBe(to);
  });

  it('refuses every other (status, event) pair', () => {
    const allowed = new Set(expected.map(([f, e]) => `${f}:${e}`));
    for (const from of OUTBOX_STATUSES) {
      for (const event of OUTBOX_EVENTS) {
        if (!allowed.has(`${from}:${event}`)) expect(outboxTransition(from, event)).toBeNull();
      }
    }
  });

  it('terminal statuses have no way out; sending cannot be cancelled', () => {
    for (const event of OUTBOX_EVENTS) {
      expect(outboxTransition('sent', event)).toBeNull();
      expect(outboxTransition('cancelled', event)).toBeNull();
    }
    expect(outboxTransition('sending', 'cancel')).toBeNull();
  });

  it('awaiting_confirm never goes back to approved without a re-approval event', () => {
    const out = OUTBOX_TRANSITIONS.filter((t) => t.from === 'awaiting_confirm' && t.to === 'approved').map((t) => t.event);
    expect(out).toEqual(['confirm']);
    // Only re-approvals (retry / confirm) enter `approved` (CLAUDE.md §12.1).
    expect([...new Set(OUTBOX_TRANSITIONS.filter((t) => t.to === 'approved').map((t) => t.event))].sort()).toEqual(['confirm', 'reapprove', 'retry']);
  });

  it('needs_reapproval: no retry, no expiry, no claim; only reapprove or cancel; sending is never held', () => {
    expect(outboxTransition('needs_reapproval', 'retry')).toBeNull();
    expect(outboxTransition('needs_reapproval', 'expire')).toBeNull();
    expect(outboxTransition('needs_reapproval', 'claim')).toBeNull();
    expect(outboxTransition('needs_reapproval', 'confirm')).toBeNull();
    expect(outboxTransition('sending', 'hold')).toBeNull();
    expect(OUTBOX_TRANSITIONS.filter((t) => t.from === 'needs_reapproval').map((t) => t.event).sort()).toEqual(['cancel', 'reapprove']);
    expect(outboxSources('hold').sort()).toEqual(['approved', 'awaiting_confirm', 'expired', 'failed']);
    expect(outboxSources('reapprove')).toEqual(['needs_reapproval']);
  });

  it('outboxSources lists the from-statuses per event', () => {
    expect(outboxSources('cancel').sort()).toEqual(['approved', 'awaiting_confirm', 'expired', 'failed', 'needs_reapproval']);
    expect(outboxSources('expire').sort()).toEqual(['approved', 'awaiting_confirm']);
    expect(outboxSources('reconnect')).toEqual(['approved']);
  });

  it('labels every status in Vietnamese; timers per spec', () => {
    for (const s of OUTBOX_STATUSES) expect(OUTBOX_STATUS_LABELS[s]).toBeTruthy();
    expect(OUTBOX_EXPIRE_MS).toBe(30 * 60_000);
    expect(OUTBOX_RECONNECT_HOLD_MS).toBe(2 * 60_000);
  });

  it('list query: comma statuses, mine flag, rejects unknown statuses', () => {
    expect(outboxListQuerySchema.parse({ status: 'failed,expired', mine: '1' })).toMatchObject({ status: ['failed', 'expired'], mine: '1', limit: 20 });
    expect(outboxListQuerySchema.safeParse({ status: 'bogus' }).success).toBe(false);
    expect(outboxCancelSchema.parse({})).toEqual({ reason: 'user' });
    expect(outboxCancelSchema.safeParse({ reason: 'x' }).success).toBe(false);
  });
});

describe('friend commands (M1a-04)', () => {
  const base = { uid: '1', threadId: '2' };
  const ok = (v: unknown) => outboxCreateSchema.safeParse(v).success;

  it('accepts friend_accept with id, name, alias and greeting', () => {
    expect(ok({ ...base, action: 'friend_accept', friend: { userId: '2', name: 'Hương', alias: 'Hương gara', greeting: 'Chào chị' } })).toBe(true);
    expect(ok({ ...base, action: 'friend_accept', friend: { name: 'Hương' } })).toBe(false);
    expect(ok({ ...base, action: 'friend_accept', friend: { userId: '2', name: 'Hương', phone: '0912345678' } })).toBe(false);
    expect(ok({ ...base, action: 'friend_accept', friend: { userId: '2', name: 'Hương' }, text: 'x' })).toBe(false);
  });
  it('friend_reject carries only id and name', () => {
    expect(ok({ ...base, action: 'friend_reject', friend: { userId: '2', name: 'Hương' } })).toBe(true);
    expect(ok({ ...base, action: 'friend_reject', friend: { userId: '2', name: 'Hương', greeting: 'hi' } })).toBe(false);
  });
  it('friend_request needs a Vietnamese phone, no user id', () => {
    expect(ok({ ...base, action: 'friend_request', friend: { phone: '0912345678', greeting: 'Chào anh' } })).toBe(true);
    expect(ok({ ...base, action: 'friend_request', friend: { phone: '+84912345678' } })).toBe(true);
    expect(ok({ ...base, action: 'friend_request', friend: { phone: '12345' } })).toBe(false);
    expect(ok({ ...base, action: 'friend_request', friend: { phone: '0912345678', userId: '5' } })).toBe(false);
    expect(ok({ ...base, action: 'friend_request' })).toBe(false);
  });
  it('greeting over 150 characters is refused', () => {
    expect(ok({ ...base, action: 'friend_request', friend: { phone: '0912345678', greeting: 'x'.repeat(151) } })).toBe(false);
  });
  it('labels and message-bubble flags', () => {
    expect(outboxLabel({ action: 'friend_accept', friend: { name: 'Hương' } })).toBe('[Kết bạn] Hương');
    expect(outboxLabel({ action: 'friend_reject', friend: { name: 'Hương' } })).toBe('[Từ chối kết bạn] Hương');
    expect(outboxLabel({ action: 'friend_request', friend: { phone: '0912345678' } })).toBe('[Mời kết bạn] 0912345678');
    for (const a of ['friend_accept', 'friend_reject', 'friend_request'] as const) expect(NON_MESSAGE_ACTIONS).toContain(a);
  });
});

describe('on-behalf labels (00 §3.3a, PQ-32)', () => {
  it('names the real sender and the holder', () => {
    expect(onBehalfLabel('truc_thay', 'Linh', 'Minh')).toBe('Gửi bởi Linh (trực thay Minh)');
    expect(onBehalfLabel('tra_loi_thay', 'Hương', 'Minh')).toBe('Gửi bởi Hương (trả lời thay Minh)');
  });
});
