import type { DriftReport, Stream } from '@vclinks/shared';

/** Per-stream outcome of one sync run. Only counts — never record contents. */
export interface StreamRunStats {
  state: 'pending' | 'running' | 'ok' | 'drift' | 'error';
  /** `store.count()` of the IndexedDB store, null when the store could not be read. */
  sourceCount: number | null;
  /** Raw records read from IndexedDB. */
  read: number;
  /** Items posted to the API. */
  sent: number;
  accepted: number;
  updated: number;
  unchanged: number;
  rejected: number;
  /** Records skipped because required fields were missing (below the drift threshold). */
  skipped: number;
  /** Records older than the checkpoint (not re-sent). */
  filtered: number;
  batches: number;
  /** Checkpoint read from the API at the start of the stream. */
  checkpoint: number | null;
  /**
   * Records that appeared behind the checkpoint since the previous run (Zalo
   * Web inserts older history late): the stream was then re-read in full.
   */
  backdated?: number;
  drift?: DriftReport['kind'];
  error?: string;
}

export interface AccountRunStatus {
  uid: string;
  state: 'running' | 'ok' | 'drift' | 'error';
  full: boolean;
  mappingVersion: number | null;
  startedAt: string;
  finishedAt: string | null;
  streams: Partial<Record<Stream, StreamRunStats>>;
  errors: string[];
}

export interface RunState {
  running: boolean;
  full: boolean;
  trigger: 'alarm' | 'manual' | null;
  startedAt: string | null;
  finishedAt: string | null;
  authError: boolean;
  lastError: string | null;
  mappingVersion: number | null;
  accountsFound: number | null;
}

export interface ExtensionConfig {
  apiBaseUrl: string;
  token: string;
  /** ISO time a paired device token was issued (set by pairing.ts); absent for tokens pasted by hand. */
  tokenIssuedAt?: string;
}

export const STORAGE_KEYS = {
  config: 'vclinksConfig',
  run: 'vclinksRun',
  accountPrefix: 'vclinksAccount:',
  /** Dev auto-reload: build id the running unpacked extension was loaded from. */
  devBuildId: 'vclinksDevBuildId',
} as const;

export const EMPTY_RUN_STATE: RunState = {
  running: false,
  full: false,
  trigger: null,
  startedAt: null,
  finishedAt: null,
  authError: false,
  lastError: null,
  mappingVersion: null,
  accountsFound: null,
};

export function emptyStreamStats(): StreamRunStats {
  return {
    state: 'pending',
    sourceCount: null,
    read: 0,
    sent: 0,
    accepted: 0,
    updated: 0,
    unchanged: 0,
    rejected: 0,
    skipped: 0,
    filtered: 0,
    batches: 0,
    checkpoint: null,
  };
}
