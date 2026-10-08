/**
 * Per-conversation draft of the compose box (03 D15), kept in this browser only. Every storage call is wrapped:
 * private windows or blocked storage must never break typing. A draft is removed when it becomes empty (after a send).
 * Keys carry the signed-in user (`draftKeyFor`), and every draft is wiped on login / logout (`clearAllDrafts`), so two
 * people sharing one browser never see each other's drafts.
 */
const PREFIX = 'vclinks.draft.';
/** Longer text is not kept (the API limit is 2,000 characters). */
const MAX_DRAFT = 4000;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Storage key part for one user's draft of one conversation; undefined until the user is known (no draft kept). */
export function draftKeyFor(userKey: string | null | undefined, conversationId: string): string | undefined {
  return userKey ? `${userKey}|${conversationId}` : undefined;
}

function store(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadDraft(conversationId: string, s: Store | null = store()): string {
  try {
    return s?.getItem(PREFIX + conversationId) ?? '';
  } catch {
    return '';
  }
}

export function saveDraft(conversationId: string, text: string, s: Store | null = store()): void {
  try {
    if (!s) return;
    if (!text.trim()) s.removeItem(PREFIX + conversationId);
    else s.setItem(PREFIX + conversationId, text.slice(0, MAX_DRAFT));
  } catch {
    // Storage full or blocked: the draft is simply not kept.
  }
}

/** Removes every draft of every user from this browser (login, logout, expired session). */
export function clearAllDrafts(s: Pick<Storage, 'key' | 'length' | 'removeItem'> | null = store() as Storage | null): void {
  try {
    if (!s) return;
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
  } catch {
    // Storage blocked: nothing was kept either.
  }
}
