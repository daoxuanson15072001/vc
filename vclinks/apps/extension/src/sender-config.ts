import type { OutboxResult } from '@vclinks/shared';

/** Sender settings and status in chrome.storage.local (shared by popup, content, background). */

export interface SenderConfig {
  /** Off by default: the extension never sends unless the user turns this on. */
  enabled: boolean;
  /** Zalo account logged in on this browser's chat.zalo.me; only its outbox is sent. */
  uid: string | null;
  /**
   * Optional allowlist of thread ids (e.g. a test group): items for any other
   * conversation are left untouched (not claimed), so a test browser can never
   * send into a real chat even when other approved items are queued.
   */
  onlyThreadIds?: string[];
  /**
   * Allowlist of people friend commands may touch (Zalo user ids or phone
   * numbers; `*` = all). Missing or empty = every friend command fails without
   * touching Zalo. Independent of the API's own list.
   */
  onlyFriendTargets?: string[];
}

export const DEFAULT_SENDER_CONFIG: SenderConfig = { enabled: false, uid: null };

export const SENDER_KEYS = {
  config: 'vclinksSender',
  status: 'vclinksSenderStatus',
} as const;

/** Facebook personal (Messenger) sender: separate switch, also off by default. */
export const FB_SENDER_KEYS = {
  config: 'vclinksSenderFb',
  status: 'vclinksSenderFbStatus',
} as const;

export type SenderKeys = typeof SENDER_KEYS | typeof FB_SENDER_KEYS;

/** content → background: outbox REST calls (the background holds the token). */
export type OutboxCall =
  | { type: 'vclinks:outbox'; op: 'pending'; uid: string; waitSec?: number }
  | { type: 'vclinks:outbox'; op: 'claim'; id: string }
  | { type: 'vclinks:outbox'; op: 'result'; id: string; result: OutboxResult }
  /** Bytes of an outbox attachment (photo / file of a command), as base64. */
  | { type: 'vclinks:outbox'; op: 'media'; id: string }
  /** Re-injects the MAIN-world file hook into the calling Zalo tab (see file-hook.ts). */
  | { type: 'vclinks:outbox'; op: 'inject-file-hook' };

/** Messenger tab → background: same outbox calls, checked against the Facebook sender config. */
export type FbOutboxCall =
  | { type: 'vclinks:fb-outbox'; op: 'pending'; uid: string; waitSec?: number }
  | { type: 'vclinks:fb-outbox'; op: 'claim'; id: string }
  | { type: 'vclinks:fb-outbox'; op: 'result'; id: string; result: OutboxResult };

export async function readSenderConfig(keys: SenderKeys = SENDER_KEYS): Promise<SenderConfig> {
  const got = await chrome.storage.local.get(keys.config);
  return { ...DEFAULT_SENDER_CONFIG, ...(got[keys.config] as Partial<SenderConfig> | undefined) };
}
