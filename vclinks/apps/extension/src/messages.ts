import type { FetchResult } from '@vclinks/shared';
import type { ApiOp } from './api';
import type { PollPresence } from './fetcher';
import type { AccountRunStatus } from './status';
import type { FbAccountStatus } from './messenger/status';

/** Messages exchanged between popup, background service worker and content script. */

// background → content
export interface SyncRequest {
  type: 'vclinks:sync';
  full: boolean;
  extensionVersion: string;
}
export type SyncRequestResponse = { accepted: true } | { accepted: false; reason: 'busy' };

/** background → content: capture the currently open conversation's rendered messages. */
export interface CaptureRequest {
  type: 'vclinks:capture';
}
/** background → content: read all conversation names from the sidebar list. */
export interface CaptureNamesRequest {
  type: 'vclinks:capture-names';
}
export type CaptureResponse =
  | { ok: true; captured: number; matched: number; unmatched: number }
  | { ok: false; reason: 'busy' | 'none' | 'error'; message?: string };

// content → background
/** Fetch-request REST calls (Dashboard asked to load a conversation from Zalo Web). */
export type FetchCall =
  | { type: 'vclinks:fetch'; op: 'pending'; uid: string; presence: PollPresence; waitSec?: number }
  | { type: 'vclinks:fetch'; op: 'claim'; id: string }
  | { type: 'vclinks:fetch'; op: 'result'; id: string; result: FetchResult };

export interface ApiCallMessage {
  type: 'vclinks:api';
  op: ApiOp;
  args: unknown[];
}
export type ApiCallResponse = { ok: true; data: unknown } | { ok: false; status: number; message: string };

/** Messenger tab → background: restricted API call (fb_ uids and Facebook streams only). */
export interface FbApiCallMessage {
  type: 'vclinks:fb-api';
  op: ApiOp;
  args: unknown[];
}

/** Messenger tab → background: account/capture status for the popup. */
export interface FbStatusMessage {
  type: 'vclinks:fb-status';
  status: FbAccountStatus;
}

export interface StatusMessage {
  type: 'vclinks:status';
  account: AccountRunStatus;
}

export interface RunFinishedMessage {
  type: 'vclinks:run-finished';
  ok: boolean;
  authError: boolean;
  error: string | null;
  mappingVersion: number | null;
  accountsFound: number | null;
}

// popup → background
export interface StartSyncMessage {
  type: 'vclinks:start-sync';
  full: boolean;
}
export type StartSyncResponse =
  | { ok: true }
  | { ok: false; reason: 'no_config' | 'no_tab' | 'no_content' | 'busy' };

export interface TestConnectionMessage {
  type: 'vclinks:test-connection';
}
export type TestConnectionResponse =
  | { ok: true; name: string; scopes: string[] }
  | { ok: false; status: number; message: string };

export interface StartCaptureMessage {
  type: 'vclinks:start-capture';
}
export interface StartCaptureNamesMessage {
  type: 'vclinks:start-capture-names';
}
export type StartCaptureResponse = CaptureResponse | { ok: false; reason: 'no_config' | 'no_tab' };

export type BackgroundMessage =
  | ApiCallMessage
  | FbApiCallMessage
  | FbStatusMessage
  | StatusMessage
  | RunFinishedMessage
  | StartSyncMessage
  | TestConnectionMessage
  | StartCaptureMessage
  | StartCaptureNamesMessage;
