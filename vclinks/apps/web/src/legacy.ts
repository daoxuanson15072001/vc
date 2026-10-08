/**
 * The project was renamed VCZALO → VCconnect → VClinks (28/09/2026). Moves
 * localStorage keys `vczalo.*` / `vcconnect.*` to `vclinks.*` once, so the saved
 * token and preferences survive. Must run before anything reads the keys.
 */

/** Newest first: when both generations hold a key, the newer value wins. */
const LEGACY_PREFIXES = ['vcconnect.', 'vczalo.'];
const PREFIX = 'vclinks.';

export function migrateLegacyLocalStorage(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    if (!storage) return;
    for (const prefix of LEGACY_PREFIXES) {
      const legacy: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k?.startsWith(prefix)) legacy.push(k);
      }
      for (const k of legacy) {
        const next = PREFIX + k.slice(prefix.length);
        const v = storage.getItem(k);
        if (v !== null && storage.getItem(next) === null) storage.setItem(next, v);
        storage.removeItem(k);
      }
    }
  } catch {
    // Storage unavailable: nothing to migrate.
  }
}

migrateLegacyLocalStorage();
