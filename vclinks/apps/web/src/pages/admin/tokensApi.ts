import type { ChannelAccessInput, ChannelAssignRow, CreateOwnToken, CreateSystemToken, PendingNickRow, RevokeReason, TokenImpact, TokenRow, TokenSettings } from '@vclinks/shared';
import { api } from '../../api';

const enc = encodeURIComponent;

/** Created token: `secret` is shown once and never returned again (docs 01 MH-PQ-08 #10). */
export interface CreatedToken {
  id: string;
  name: string;
  secret: string;
}

export const tokensApi = {
  channels: (q: { division?: string; channel?: string; search?: string }) =>
    api<{ items: ChannelAssignRow[]; pendingCount: number }>('/admin/channel-access', { query: q }),
  pending: () => api<PendingNickRow[]>('/admin/channel-access/pending'),
  addAccess: (uid: string, b: ChannelAccessInput, replace = false) =>
    api<{ id: string; message: string }>(`/admin/channel-access/${enc(uid)}`, { method: 'POST', body: b, query: replace ? { replace: '1' } : undefined }),
  patchAccess: (uid: string, id: string, b: { to?: string | null; note?: string }) =>
    api<{ ok: true }>(`/admin/channel-access/${enc(uid)}/${enc(id)}`, { method: 'PATCH', body: b }),
  removeAccess: (uid: string, id: string) => api<{ ok: true }>(`/admin/channel-access/${enc(uid)}/${enc(id)}`, { method: 'DELETE' }),
  confirmNick: (uid: string, b: { divisionId: string; holderUserId?: string }) =>
    api<{ message: string }>(`/admin/channel-access/${enc(uid)}/confirm`, { method: 'POST', body: b }),
  rejectNick: (uid: string, reason: string) => api<{ message: string }>(`/admin/channel-access/${enc(uid)}/reject`, { method: 'POST', body: { reason } }),

  tokens: (q: { kind?: string; status?: string; search?: string }) => api<TokenRow[]>('/admin/tokens', { query: q }),
  createSystem: (b: CreateSystemToken) => api<CreatedToken>('/admin/tokens', { method: 'POST', body: b }),
  revoke: (id: string, reason: RevokeReason) => api<{ revoked: boolean }>(`/admin/tokens/${enc(id)}/revoke`, { method: 'POST', body: { reason } }),
  impact: (id: string) => api<TokenImpact>(`/admin/tokens/${enc(id)}/impact`),
  settings: () => api<TokenSettings>('/admin/token-settings'),
  saveSettings: (b: TokenSettings['allowSelfMcpToken']) => api<TokenSettings>('/admin/token-settings', { method: 'PUT', body: b }),
  approvePairing: (b: { code: string; deviceName?: string; uids: string[]; holderUserId?: string; shared?: boolean; replaceTokenId?: string }) =>
    api<{ deviceName: string; uids: string[] }>('/devices/pairings/approve', { method: 'POST', body: b }),

  own: () => api<{ items: TokenRow[]; canCreate: boolean; reason: string | null; canPropose: boolean; proposeReason?: string }>('/settings/tokens'),
  createOwn: (b: CreateOwnToken) => api<CreatedToken>('/settings/tokens', { method: 'POST', body: b }),
  revokeOwn: (id: string, reason: RevokeReason) => api<{ revoked: boolean }>(`/settings/tokens/${enc(id)}/revoke`, { method: 'POST', body: { reason } }),
};
