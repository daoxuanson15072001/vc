/** Facebook personal (Messenger) status and settings in chrome.storage.local (popup, background, content). */

export const FB_STORAGE_KEYS = {
  /** Last status reported by the Messenger tab (FbAccountStatus). */
  status: 'vclinksFbStatus',
  /** Owner's numeric Facebook id typed in the popup when the DOM does not expose it. */
  ownerOverride: 'vclinksFbOwnerId',
} as const;

export interface FbAccountStatus {
  /** `fb_<id>` once the owner is known. */
  uid: string | null;
  ownerSource: 'dom' | 'manual' | null;
  /** Registered with POST /api/accounts during this page's life. */
  registered: boolean;
  host: string;
  updatedAt: string;
  /** Messages posted since the tab was loaded. */
  postedMessages: number;
  /** Sidebar conversations posted since the tab was loaded. */
  postedThreads: number;
  /** Rows of the open thread not ingested for lack of a time separator above them. */
  unanchored: number;
  /** Open E2EE chat waiting for the PIN. */
  locked: boolean;
  /** Selector keys the last health check found broken. */
  broken: string[];
  lastCaptureAt: string | null;
  lastError: string | null;
}

/** Hosts/paths the Messenger content script runs on. */
export const FB_TAB_URLS = ['https://www.messenger.com/*', 'https://www.facebook.com/messages/*'];

export function isFbTabUrl(url: string | undefined): boolean {
  return !!url && (url.startsWith('https://www.messenger.com/') || url.startsWith('https://www.facebook.com/messages'));
}

/** `fb_<digits>`: the only account uids a Messenger tab may write to. */
export function isFbUid(uid: unknown): uid is string {
  return typeof uid === 'string' && /^fb_\d{1,25}$/.test(uid);
}
