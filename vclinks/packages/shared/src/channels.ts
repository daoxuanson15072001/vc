import { z } from 'zod';

/**
 * Messaging channels VClinks connects to. Each connected account (a Zalo
 * login, a Zalo OA, a Facebook Page, a Facebook profile) is one `accounts` doc.
 *
 * Account uids carry a channel prefix so the `_id = ${uid}:${source id}` scheme
 * stays unique across channels. Personal Zalo keeps the bare Zalo uid (no
 * prefix) because it predates multi-channel and its data is already keyed so.
 */
export const CHANNELS = ['zalo', 'zalo_oa', 'fb_page', 'fb_personal'] as const;
export type Channel = (typeof CHANNELS)[number];
export const channelSchema = z.enum(CHANNELS);

/**
 * `extension`: read and sent by the VClinks Extension in the user's browser
 * (no official API). `api`: official platform API — webhooks in, server-side send.
 */
export type ChannelSendMode = 'extension' | 'api';

export interface ChannelInfo {
  /** Vietnamese label for the UI. */
  label: string;
  shortLabel: string;
  uidPrefix: string;
  sendMode: ChannelSendMode;
}

export const CHANNEL_INFO: Record<Channel, ChannelInfo> = {
  zalo: { label: 'Zalo cá nhân', shortLabel: 'Zalo', uidPrefix: '', sendMode: 'extension' },
  zalo_oa: { label: 'Zalo OA', shortLabel: 'OA', uidPrefix: 'zoa_', sendMode: 'api' },
  fb_page: { label: 'Fanpage Facebook', shortLabel: 'Fanpage', uidPrefix: 'fbp_', sendMode: 'api' },
  fb_personal: { label: 'Facebook cá nhân', shortLabel: 'FB', uidPrefix: 'fb_', sendMode: 'extension' },
};

/** Prefixed channels, longest prefix first so `fbp_` is never read as `fb_`. */
const PREFIXED = (CHANNELS.filter((c) => CHANNEL_INFO[c].uidPrefix) as Channel[]).sort(
  (a, b) => CHANNEL_INFO[b].uidPrefix.length - CHANNEL_INFO[a].uidPrefix.length,
);

/** Account uid for a platform account id, e.g. ('fb_page', '1234') → 'fbp_1234'. */
export function channelAccountUid(channel: Channel, sourceId: string): string {
  return CHANNEL_INFO[channel].uidPrefix + sourceId;
}

/** Channel of an account uid, from its prefix. Unprefixed uids are personal Zalo. */
export function channelOfUid(uid: string): Channel {
  return PREFIXED.find((c) => uid.startsWith(CHANNEL_INFO[c].uidPrefix)) ?? 'zalo';
}

/** Platform account id of an account uid (prefix removed). */
export function sourceIdOfUid(uid: string): string {
  return uid.slice(CHANNEL_INFO[channelOfUid(uid)].uidPrefix.length);
}

/** Mongo filter on an account uid field matching one channel (prefix-based). */
export function uidChannelFilter(channel: Channel): Record<string, unknown> {
  const prefix = CHANNEL_INFO[channel].uidPrefix;
  if (prefix) return { $regex: `^${prefix}` };
  return { $not: new RegExp(`^(${PREFIXED.map((c) => CHANNEL_INFO[c].uidPrefix).join('|')})`) };
}
