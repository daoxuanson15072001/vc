/**
 * "Tạo nhắc việc từ tin này" (03 MH-SZ-04 #5). The reminder / task module of file 02 is not built yet, so a reminder
 * is kept in this browser only (not shared, not synced) and says so in the dialog. When the server module exists,
 * `listLocalReminders()` is what to migrate. Storage calls are wrapped (private windows, full storage).
 * Reminders are stored per signed-in user (`owner`), so two people sharing one browser never see each other's.
 */
export interface LocalReminder {
  id: string;
  conversationId: string;
  msgId: string;
  /** ISO time of the reminder. */
  at: string;
  note: string;
  createdAt: string;
}

const KEY = 'vclinks.reminders.';
const MAX_ITEMS = 200;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function store(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function listLocalReminders(owner: string, s: Store | null = store()): LocalReminder[] {
  try {
    if (!owner) return [];
    const v = JSON.parse(s?.getItem(KEY + owner) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as LocalReminder[]) : [];
  } catch {
    return [];
  }
}

/** Adds a reminder; returns false when it could not be stored. */
export function addLocalReminder(owner: string | null | undefined, r: Omit<LocalReminder, 'id' | 'createdAt'>, s: Store | null = store(), now = new Date()): boolean {
  try {
    if (!s || !owner) return false;
    const item: LocalReminder = { ...r, note: r.note.trim().slice(0, 500), id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: now.toISOString() };
    s.setItem(KEY + owner, JSON.stringify([item, ...listLocalReminders(owner, s)].slice(0, MAX_ITEMS)));
    return true;
  } catch {
    return false;
  }
}
