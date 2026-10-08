import type { ExtensionConfig } from './status';

/**
 * Device pairing by a 6-digit code and token rotation (01 PQ-52).
 * The extension asks the API for a code, an Admin types it on the Dashboard,
 * and the extension picks up its device token once. Pure logic with injected
 * fetch and storage, so it is unit-tested; background.ts wires the real ones.
 */

export const PAIRING_KEY = 'vclinksPairing';
/** Tokens obtained by pairing are replaced after this age (PQ-52 rotates at 180 days). */
export const ROTATE_AFTER_MS = 150 * 24 * 3600_000;

export interface PendingPairing {
  apiBaseUrl: string;
  id: string;
  pollKey: string;
  code: string;
  expiresAt: string;
}

export type PairingView =
  | { state: 'none' }
  | { state: 'waiting'; code: string; expiresAt: string }
  | { state: 'expired' }
  | { state: 'paired' }
  | { state: 'error'; message: string };

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface PairingDeps {
  fetchFn: FetchFn;
  load(): Promise<{ pairing?: PendingPairing; config?: ExtensionConfig }>;
  saveConfig(cfg: ExtensionConfig): Promise<void>;
  savePairing(p: PendingPairing | null): Promise<void>;
  now(): number;
}

const json = { 'Content-Type': 'application/json' };

async function failure(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    return [body.message].flat().join('; ') || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** Asks the API for a code to show. */
export async function startPairing(apiBaseUrl: string, deviceName: string, deps: PairingDeps): Promise<PairingView> {
  try {
    const res = await deps.fetchFn(`${apiBaseUrl}/api/devices/pairings`, { method: 'POST', headers: json, body: JSON.stringify({ deviceName }) });
    if (!res.ok) return { state: 'error', message: await failure(res) };
    const b = (await res.json()) as { id: string; code: string; pollKey: string; expiresAt: string };
    await deps.savePairing({ apiBaseUrl, ...b });
    return { state: 'waiting', code: b.code, expiresAt: b.expiresAt };
  } catch (e) {
    return { state: 'error', message: String((e as Error)?.message ?? e) };
  }
}

/** One poll: stores the token when the Admin has approved. */
export async function pollPairing(deps: PairingDeps): Promise<PairingView> {
  const { pairing } = await deps.load();
  if (!pairing) return { state: 'none' };
  if (Date.parse(pairing.expiresAt) < deps.now()) {
    await deps.savePairing(null);
    return { state: 'expired' };
  }
  try {
    const res = await deps.fetchFn(`${pairing.apiBaseUrl}/api/devices/pairings/${encodeURIComponent(pairing.id)}?pollKey=${encodeURIComponent(pairing.pollKey)}`);
    if (!res.ok) return { state: 'error', message: await failure(res) };
    const b = (await res.json()) as { status: 'pending' | 'approved' | 'used' | 'expired'; token?: string };
    if (b.status === 'approved' && b.token) {
      await deps.saveConfig({ apiBaseUrl: pairing.apiBaseUrl, token: b.token, tokenIssuedAt: new Date(deps.now()).toISOString() });
      await deps.savePairing(null);
      return { state: 'paired' };
    }
    if (b.status === 'expired' || b.status === 'used') {
      await deps.savePairing(null);
      return { state: 'expired' };
    }
    return { state: 'waiting', code: pairing.code, expiresAt: pairing.expiresAt };
  } catch (e) {
    return { state: 'error', message: String((e as Error)?.message ?? e) };
  }
}

/**
 * Replaces an old paired token: ask for a new one, store it, then confirm with
 * the new token so the API revokes the old. Returns true when rotated.
 * Tokens pasted by hand (no `tokenIssuedAt`) are never rotated: they may be shared.
 */
export async function maybeRotateToken(deps: PairingDeps): Promise<boolean> {
  const { config } = await deps.load();
  if (!config?.tokenIssuedAt) return false;
  if (deps.now() - Date.parse(config.tokenIssuedAt) < ROTATE_AFTER_MS) return false;
  try {
    const res = await deps.fetchFn(`${config.apiBaseUrl}/api/devices/token/rotate`, { method: 'POST', headers: { ...json, Authorization: `Bearer ${config.token}` }, body: '{}' });
    if (!res.ok) return false;
    const { token } = (await res.json()) as { token: string };
    await deps.saveConfig({ ...config, token, tokenIssuedAt: new Date(deps.now()).toISOString() });
    await deps.fetchFn(`${config.apiBaseUrl}/api/devices/token/commit`, { method: 'POST', headers: { ...json, Authorization: `Bearer ${token}` }, body: JSON.stringify({ token }) });
    return true;
  } catch {
    return false;
  }
}
