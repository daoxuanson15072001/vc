import { describe, expect, it } from 'vitest';
import { ROTATE_AFTER_MS, maybeRotateToken, pollPairing, startPairing, type PairingDeps, type PendingPairing } from '../src/pairing';
import type { ExtensionConfig } from '../src/status';

const T0 = Date.parse('2026-10-04T08:00:00Z');
const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fake(routes: Record<string, () => Response>, init: { pairing?: PendingPairing; config?: ExtensionConfig } = {}, now = T0) {
  const state = { ...init };
  const calls: string[] = [];
  const deps: PairingDeps = {
    fetchFn: async (url, opts) => {
      const key = `${opts?.method ?? 'GET'} ${url.replace(/\?.*$/, '')}`;
      calls.push(key);
      const r = routes[key];
      if (!r) throw new Error(`no route ${key}`);
      return r();
    },
    load: async () => ({ ...state }),
    saveConfig: async (c) => void (state.config = c),
    savePairing: async (p) => void (state.pairing = p ?? undefined),
    now: () => now,
  };
  return { deps, state, calls };
}

const pending: PendingPairing = { apiBaseUrl: 'http://api', id: 'p1', pollKey: 'k'.repeat(20), code: '123456', expiresAt: new Date(T0 + 60_000).toISOString() };

describe('pairing by 6-digit code', () => {
  it('shows the code, then stores the token once the Admin approved', async () => {
    const f = fake({
      'POST http://api/api/devices/pairings': () => res({ id: 'p1', code: '123456', pollKey: pending.pollKey, expiresAt: pending.expiresAt }, 201),
      'GET http://api/api/devices/pairings/p1': () => res({ status: 'approved', token: 'vcz_new' }),
    });
    expect(await startPairing('http://api', 'May', f.deps)).toMatchObject({ state: 'waiting', code: '123456' });
    expect(f.state.pairing?.id).toBe('p1');
    expect(await pollPairing(f.deps)).toEqual({ state: 'paired' });
    expect(f.state.config).toMatchObject({ apiBaseUrl: 'http://api', token: 'vcz_new', tokenIssuedAt: new Date(T0).toISOString() });
    expect(f.state.pairing).toBeUndefined();
  });
  it('keeps waiting while pending and drops an expired pairing', async () => {
    const waiting = fake({ 'GET http://api/api/devices/pairings/p1': () => res({ status: 'pending' }) }, { pairing: pending });
    expect(await pollPairing(waiting.deps)).toMatchObject({ state: 'waiting' });
    const expired = fake({}, { pairing: { ...pending, expiresAt: new Date(T0 - 1).toISOString() } });
    expect(await pollPairing(expired.deps)).toEqual({ state: 'expired' });
    expect(expired.state.pairing).toBeUndefined();
  });
  it('reports the API error sentence', async () => {
    const f = fake({ 'POST http://api/api/devices/pairings': () => res({ message: 'Đang có quá nhiều yêu cầu ghép máy' }, 400) });
    expect(await startPairing('http://api', 'May', f.deps)).toEqual({ state: 'error', message: 'Đang có quá nhiều yêu cầu ghép máy' });
  });
});

describe('token rotation', () => {
  const routes = {
    'POST http://api/api/devices/token/rotate': () => res({ token: 'vcz_2' }),
    'POST http://api/api/devices/token/commit': () => res({ revoked: 1 }),
  };
  it('rotates a paired token older than the limit, committing with the new one', async () => {
    const old = new Date(T0 - ROTATE_AFTER_MS - 1000).toISOString();
    const f = fake(routes, { config: { apiBaseUrl: 'http://api', token: 'vcz_1', tokenIssuedAt: old } });
    expect(await maybeRotateToken(f.deps)).toBe(true);
    expect(f.state.config?.token).toBe('vcz_2');
    expect(f.calls).toEqual(['POST http://api/api/devices/token/rotate', 'POST http://api/api/devices/token/commit']);
  });
  it('leaves young paired tokens and hand-pasted tokens alone', async () => {
    const young = fake(routes, { config: { apiBaseUrl: 'http://api', token: 'vcz_1', tokenIssuedAt: new Date(T0).toISOString() } });
    expect(await maybeRotateToken(young.deps)).toBe(false);
    const manual = fake(routes, { config: { apiBaseUrl: 'http://api', token: 'vcz_1' } });
    expect(await maybeRotateToken(manual.deps)).toBe(false);
    expect(manual.calls).toEqual([]);
  });
});
