import { evaluatePair, isNewSide, nameSimilarity, type MergeSide } from './merge-rules';

/*
 * Table tests of the merge rules (docs 02 §4.4, §4.5, DK-05…DK-08, D8-05, QĐ-57 A): every row is one
 * "tự gộp / không tự gộp" case. Phones are the fake 0900 000 xxx numbers of the test data.
 */
const NOW = new Date('2026-10-04T08:00:00Z');
const H = 3_600_000;
const DIV = 'TD-DV-VCP';

const old = (over: Partial<MergeSide> = {}): MergeSide => ({
  contactId: 'cc_old',
  accountId: 'ca_old',
  name: 'Ngô Minh Khoa',
  points: [{ kind: 'phone', value: '0900000301', level: 'V3', state: 'active' }],
  erpCodes: [{ erp: 'vcsales', customerId: 'KH-TEST-0301' }],
  owners: [{ division: DIV, userId: 'linh' }],
  responsibleIds: ['linh'],
  firstSeenAt: new Date(NOW.getTime() - 400 * 24 * H),
  messageCount: 120,
  ...over,
});
const fresh = (over: Partial<MergeSide> = {}): MergeSide => ({
  contactId: 'cc_new',
  accountId: 'ca_new',
  name: 'Khoa Ngô',
  points: [{ kind: 'phone', value: '0900000301', level: 'V2', state: 'active' }],
  erpCodes: [],
  owners: [],
  responsibleIds: ['linh'],
  firstSeenAt: new Date(NOW.getTime() - 2 * H),
  messageCount: 3,
  ...over,
});
const run = (a: MergeSide, b: MergeSide) => evaluatePair(a, b, { division: DIV, now: NOW });
const codes = (r: ReturnType<typeof run>) => r.signals.map((s) => s.code).sort();

describe('merge rules: automatic merge (D8-05)', () => {
  it('T1 verified phone + new identity + same person in charge → auto merge, new side absorbed', () => {
    const r = run(old(), fresh());
    expect(r.outcome).toBe('auto_merge');
    expect(r.newSide).toBe('b');
    expect(codes(r)).toEqual(expect.arrayContaining(['T1', 'T12']));
    expect(r.score).toBe(100);
  });

  it('new identity on the nick of another sale (kịch bản D): not the same person in charge → suggestion', () => {
    expect(run(old(), fresh({ responsibleIds: ['minh'] })).outcome).toBe('suggest_high');
  });

  it('new identity nobody is in charge of yet (OA lead) → auto merge', () => {
    expect(run(old(), fresh({ responsibleIds: [] })).outcome).toBe('auto_merge');
  });

  it('QĐ-57 A: T2 (V2 ↔ V1) + same person in charge = 90 → auto merge (kịch bản A)', () => {
    const lead = old({ name: 'Phạm Thị Mai', points: [{ kind: 'phone', value: '0900000201', level: 'V1', state: 'active' }], erpCodes: [], owners: [{ division: DIV, userId: 'linh' }] });
    const zalo = fresh({ points: [{ kind: 'phone', value: '0900000201', level: 'V2', state: 'active' }], name: 'Mai Phạm' });
    const r = run(lead, zalo);
    expect(codes(r)).toEqual(expect.arrayContaining(['T2', 'T12']));
    expect(r.score).toBeGreaterThanOrEqual(90);
    // Without the name bonus T2 + T12 is exactly the 90 threshold.
    expect(run(lead, { ...zalo, name: null }).score).toBe(90);
    expect(run(lead, { ...zalo, name: null }).outcome).toBe('auto_merge');
    expect(r.outcome).toBe('auto_merge');
  });

  it('T2 without the same person in charge → only a suggestion', () => {
    const lead = old({ points: [{ kind: 'phone', value: '0900000201', level: 'V1', state: 'active' }], erpCodes: [], responsibleIds: ['linh'] });
    const r = run(lead, fresh({ points: [{ kind: 'phone', value: '0900000201', level: 'V2', state: 'active' }], responsibleIds: ['hai'] }));
    expect(r.outcome).toBe('suggest');
  });

  it('T4 verified email + new identity → auto merge', () => {
    const r = run(
      old({ points: [{ kind: 'email', value: 'oanh.trinh@example.vn', level: 'V3', state: 'active' }] }),
      fresh({ points: [{ kind: 'email', value: 'oanh.trinh@example.vn', level: 'V2', state: 'active' }], responsibleIds: [] }),
    );
    expect(r.outcome).toBe('auto_merge');
  });

  it('T6 same ERP code on both sides → auto merge when one side is new', () => {
    const r = run(old({ points: [] }), fresh({ points: [], erpCodes: [] }));
    expect(r.outcome).toBe('none'); // nothing in common
    const linked = run(old(), old({ contactId: 'cc_b', accountId: 'ca_b', firstSeenAt: new Date(NOW.getTime() - H), messageCount: 1 }));
    // Both sides have the ERP code: neither is "new" (DK-06: chưa liên kết mã KH) → suggestion only.
    expect(codes(linked)).toContain('T6');
    expect(linked.outcome).toBe('suggest_high');
  });
});

describe('merge rules: never automatic', () => {
  it.each<[string, Partial<MergeSide>, Partial<MergeSide>, string]>([
    ['both sides have history (L11)', {}, { firstSeenAt: new Date(NOW.getTime() - 30 * 24 * H), messageCount: 40 }, 'suggest_high'],
    ['new side has ≥ 20 messages', {}, { messageCount: 20 }, 'suggest_high'],
    ['new side older than 72 h', {}, { firstSeenAt: new Date(NOW.getTime() - 73 * H) }, 'suggest_high'],
    ['new side already linked to an ERP code', {}, { erpCodes: [{ erp: 'vcsales', customerId: 'KH-TEST-0302' }] }, 'suggest_high'],
    ['two owners in the division (DK-08 #3)', {}, { owners: [{ division: DIV, userId: 'hai' }], responsibleIds: ['hai'] }, 'suggest_high'],
    ['pair split before (DK-08 #4)', { mergeLocks: ['cc_new'] }, {}, 'suggest_high'],
    ['internal staff (DK-08 #5)', {}, { isInternal: true }, 'suggest_high'],
    ['web chat identity (DK-08 #6)', {}, { webChat: true }, 'suggest_high'],
    ['different gender A4 (DK-08 #7)', { gender: 'male' }, { gender: 'female' }, 'suggest_high'],
    ['shared phone in one account (DK-08 #1)', {}, { points: [{ kind: 'phone', value: '0900000301', level: 'V2', state: 'shared_account' }] }, 'none'],
    ['phone shared by many customers (DK-08 #8)', {}, { points: [{ kind: 'phone', value: '0900000301', level: 'V2', state: 'shared_many' }] }, 'none'],
  ])('%s', (_name, a, b, outcome) => {
    const r = run(old(a), fresh(b));
    expect(r.outcome).not.toBe('auto_merge');
    expect(r.outcome).toBe(outcome);
  });

  it('retired phone gives T7 (50) with a warning block, never automatic (DK-14)', () => {
    const r = run(old({ points: [{ kind: 'phone', value: '0900000501', level: 'V3', state: 'retired' }] }), fresh({ points: [{ kind: 'phone', value: '0900000501', level: 'V2', state: 'active' }] }));
    expect(codes(r)).toContain('T7');
    expect(r.blocks).toContain('shared_or_retired');
    expect(r.outcome).toBe('suggest');
  });

  it('dormant number > 12 months (A6) blocks', () => {
    const r = run(
      old({ points: [{ kind: 'phone', value: '0900000901', level: 'V3', state: 'active', lastActivityAt: new Date('2025-03-10') }] }),
      fresh({ points: [{ kind: 'phone', value: '0900000901', level: 'V2', state: 'active' }] }),
    );
    expect(r.blocks).toContain('dormant');
    expect(r.outcome).not.toBe('auto_merge');
  });

  it('two different ERP codes in one ERP block (DK-08 #2)', () => {
    const r = run(old(), old({ contactId: 'cc_b', accountId: 'ca_b', erpCodes: [{ erp: 'vcsales', customerId: 'KH-TEST-0302' }] }));
    expect(r.blocks).toContain('two_erp_codes');
    expect(r.outcome).not.toBe('auto_merge');
  });

  it('erased customer: no suggestion at all', () => {
    expect(run(old({ erased: true }), fresh()).outcome).toBe('none');
  });

  it('both V1 (T3 = 50) → suggestion; V0 never matches', () => {
    const v1 = (id: string, l: 'V1' | 'V0') => fresh({ contactId: id, points: [{ kind: 'phone', value: '0900000010', level: l, state: 'active' }], responsibleIds: [] });
    expect(run(v1('x', 'V1'), v1('y', 'V1')).outcome).toBe('suggest');
    expect(run(v1('x', 'V0'), v1('y', 'V1')).outcome).toBe('none');
  });

  it('email V1 on one side (T5 = 60) is not a verified match: high suggestion even at 90', () => {
    const r = run(
      old({ points: [{ kind: 'email', value: 'khoa.gara@example.vn', level: 'V3', state: 'active' }] }),
      fresh({ points: [{ kind: 'email', value: 'khoa.gara@example.vn', level: 'V1', state: 'active' }] }),
    );
    expect(codes(r)).toEqual(['T12', 'T14', 'T5']);
    expect(r.score).toBe(90);
    expect(r.outcome).toBe('suggest_high');
  });

  it('negative name signals lower the score (A1, A2)', () => {
    const r = run(
      old({ name: 'Trương Văn Khang', points: [{ kind: 'phone', value: '0900000900', level: 'V2', state: 'active' }, { kind: 'phone', value: '0900000821', level: 'V3', state: 'active' }] }),
      fresh({ name: 'Chị Hoa', points: [{ kind: 'phone', value: '0900000900', level: 'V2', state: 'active' }, { kind: 'phone', value: '0900000999', level: 'V2', state: 'active' }] }),
    );
    expect(codes(r)).toEqual(expect.arrayContaining(['A1', 'T1']));
    // Without a shared person in charge: 100 − 20 = 80 → suggestion only. (The chị Vân case itself is
    // stopped by the "Dùng chung nhiều khách" state of the number, DK-57.)
    const r2 = run(old({ name: 'Trương Văn Khang' }), fresh({ name: 'Chị Hoa', responsibleIds: ['hai'] }));
    expect(r2.score).toBe(80);
    expect(r2.outcome).toBe('suggest');
  });
});

describe('helpers', () => {
  it('nameSimilarity ignores accents, order and generic words', () => {
    expect(nameSimilarity('Gara Khoa Minh', 'Garage Minh Khoa')).toBe(1);
    expect(nameSimilarity('Chị Hoa', 'Trương Văn Khang')).toBe(0);
  });
  it('isNewSide needs every condition', () => {
    expect(isNewSide(fresh(), old(), DIV, NOW)).toBe(true);
    expect(isNewSide(fresh({ owners: [{ division: DIV, userId: 'hai' }] }), old(), DIV, NOW)).toBe(false);
    expect(isNewSide(fresh({ owners: [{ division: DIV, userId: 'linh' }] }), old(), DIV, NOW)).toBe(true);
  });
});
