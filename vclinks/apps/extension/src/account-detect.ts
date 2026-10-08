/**
 * Which Zalo account is logged in on this tab. Every account seen in this
 * browser keeps its `zdb_<uid>` database, so the database list alone cannot
 * tell. The sidebar can: its conversation ids belong to the logged-in account,
 * so the account whose `conversation` store knows most of them is the one.
 */

export interface AccountPresence {
  uid: string;
  /** null = could not tell. */
  loggedIn: boolean | null;
}

/**
 * Picks the logged-in uid from per-account hit counts over `sample` sidebar ids.
 * Requires a clear winner (most hits, at least 60% of the sample and 3 ids), so
 * a contact shared by both accounts never flips the answer. Null = unknown.
 */
export function pickLoggedIn(hits: ReadonlyMap<string, number | null>, sample: number): string | null {
  if (sample < 3) return null;
  const ranked = [...hits].filter((e): e is [string, number] => e[1] != null).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (!best || best[1] < Math.max(3, Math.ceil(sample * 0.6))) return null;
  if (second && second[1] >= best[1]) return null;
  return best[0];
}

export function toPresence(uids: readonly string[], loggedIn: string | null): AccountPresence[] {
  return uids.map((uid) => ({ uid, loggedIn: loggedIn == null ? null : uid === loggedIn }));
}
