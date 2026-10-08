import { computeHealth, type HealthInput } from './health';

const now = new Date('2026-10-04T08:00:00Z');
const base: HealthInput = { extensionChannel: true, unsafe: false, session: null, presence: null, openDrifts: 0, now };
const seen = (ms: number, extra: Partial<NonNullable<HealthInput['presence']>> = {}) => ({
  lastSeenAt: new Date(now.getTime() - ms),
  loggedIn: true,
  waiting: null,
  ...extra,
});

describe('computeHealth', () => {
  it('is green when the extension reports recently, logged in, no drift', () => {
    expect(computeHealth({ ...base, presence: seen(10_000) }).level).toBe('green');
  });
  it('is red when the extension is silent for more than 2 minutes', () => {
    const r = computeHealth({ ...base, presence: seen(121_000) });
    expect(r.level).toBe('red');
    expect(r.technical).toBe('extension.offline');
  });
  it('is red when Zalo Web is logged in to another account', () => {
    expect(computeHealth({ ...base, presence: seen(5_000, { loggedIn: false }) }).level).toBe('red');
  });
  it('is red when the watchdog reports a lost session, with the QR sentence', () => {
    const r = computeHealth({ ...base, presence: seen(5_000), session: { state: 'lost', reason: 'qr', since: now } });
    expect(r.level).toBe('red');
    expect(r.reason).toMatch(/quét mã QR/);
  });
  it('is yellow when Zalo Web is busy or hidden, and when never seen', () => {
    expect(computeHealth({ ...base, presence: seen(5_000, { waiting: 'tab_hidden' }) }).level).toBe('yellow');
    expect(computeHealth(base).level).toBe('yellow');
  });
  it('is yellow with an open drift', () => {
    expect(computeHealth({ ...base, presence: seen(5_000), openDrifts: 1 }).level).toBe('yellow');
  });
  it('"Chưa an toàn" wins over a green dot', () => {
    expect(computeHealth({ ...base, presence: seen(5_000), unsafe: true }).level).toBe('unsafe');
  });
  it('API channels have no extension to watch: always green', () => {
    expect(computeHealth({ ...base, extensionChannel: false }).level).toBe('green');
  });
});
