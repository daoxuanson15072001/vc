import { describe, expect, it } from 'vitest';
import {
  WORKITEM_EVENTS,
  WORKITEM_STATUSES,
  workitemApproveSchema,
  workitemCreateSchema,
  workitemReturnSchema,
  workitemTransition,
  type WorkitemEvent,
  type WorkitemStatus,
} from '../src/workitem';

const EVENTS = Object.keys(WORKITEM_EVENTS) as WorkitemEvent[];

/** Every allowed edge of D9-02, written out by hand (the table in the source must match it exactly). */
const EXPECTED: [WorkitemStatus, WorkitemEvent, WorkitemStatus][] = [
  ['moi', 'start', 'cskh_xu_ly'],
  ['tra_lai', 'start', 'cskh_xu_ly'],
  ['cskh_xu_ly', 'submit', 'cho_nvkd_duyet'],
  ['tra_lai', 'submit', 'cho_nvkd_duyet'],
  ['cho_nvkd_duyet', 'return', 'tra_lai'],
  ['cho_nvkd_duyet', 'approve', 'da_gui_khach'],
  ['da_gui_khach', 'send_failed', 'cho_nvkd_duyet'],
  ['da_gui_khach', 'sent', 'cho_khach'],
  ['da_gui_khach', 'sent', 'cho_hang'],
  ['da_gui_khach', 'sent', 'cskh_xu_ly'],
  ['da_gui_khach', 'sent', 'xong'],
  ['moi', 'self_reply', 'xong'],
  ['cskh_xu_ly', 'self_reply', 'xong'],
  ['tra_lai', 'self_reply', 'xong'],
  ['cho_nvkd_duyet', 'self_reply', 'xong'],
  ['cskh_xu_ly', 'wait_vendor', 'cho_hang'],
  ['cho_hang', 'vendor_back', 'cskh_xu_ly'],
  ['cskh_xu_ly', 'close', 'xong'],
  ['cho_khach', 'close', 'xong'],
  ['cho_hang', 'close', 'xong'],
];

describe('workitem state machine (D9-02)', () => {
  it('allows exactly the listed edges', () => {
    for (const [from, ev, to] of EXPECTED) expect(workitemTransition(from, ev, to)).toBe(to);
  });

  it('refuses every other (state, event, target) triple', () => {
    const ok = new Set(EXPECTED.map((e) => e.join('|')));
    let refused = 0;
    for (const from of WORKITEM_STATUSES)
      for (const ev of EVENTS)
        for (const to of WORKITEM_STATUSES) {
          if (ok.has([from, ev, to].join('|'))) continue;
          const r = workitemTransition(from, ev, to);
          // Single-target events ignore `to`: the result must then differ from `to` or the edge must not exist.
          if (r !== null) expect(r === to).toBe(false);
          refused++;
        }
    expect(refused).toBeGreaterThan(600);
  });

  it('only `approve` leaves a state for "sent to the customer"; no CS event reaches da_gui_khach', () => {
    for (const ev of EVENTS) {
      const e = WORKITEM_EVENTS[ev];
      const tos: string[] = typeof e.to === 'string' ? [e.to] : [...e.to];
      if (tos.includes('da_gui_khach')) expect(ev).toBe('approve');
      if (e.who === 'cs') expect(tos).not.toContain('da_gui_khach');
    }
    expect(WORKITEM_EVENTS.approve.who).toBe('approver');
  });

  it('xong is final, sent needs an explicit target', () => {
    for (const ev of EVENTS) for (const to of WORKITEM_STATUSES) expect(workitemTransition('xong', ev, to)).toBeNull();
    expect(workitemTransition('da_gui_khach', 'sent')).toBeNull();
    expect(workitemTransition('da_gui_khach', 'sent', 'tra_lai')).toBeNull();
  });
});

describe('workitem schemas', () => {
  it('return needs a reason', () => {
    expect(workitemReturnSchema.safeParse({}).success).toBe(false);
    expect(workitemReturnSchema.safeParse({ reason: 'sai_so_luong' }).success).toBe(true);
  });
  it('create: ≤ 10 messages, after-sales needs type and ≥ 10 characters', () => {
    const base = { uid: 'u', threadId: 't', kind: 'bao_gia', messageIds: ['a'] };
    expect(workitemCreateSchema.safeParse(base).success).toBe(true);
    expect(workitemCreateSchema.safeParse({ ...base, messageIds: Array.from({ length: 11 }, (_, i) => `m${i}`) }).success).toBe(false);
    expect(workitemCreateSchema.safeParse({ ...base, messageIds: ['a', 'a'] }).success).toBe(false);
    expect(workitemCreateSchema.safeParse({ ...base, kind: 'hau_mai', note: 'ngắn' }).success).toBe(false);
    expect(workitemCreateSchema.safeParse({ ...base, kind: 'hau_mai', aftersalesType: 'bao_hanh', note: 'UAT 81 bơm nước kêu' }).success).toBe(true);
  });
  it('approve needs non-empty words', () => {
    expect(workitemApproveSchema.safeParse({ message: '  ' }).success).toBe(false);
  });
});
