/**
 * One-time migration of chrome.storage keys across project renames:
 * VCZALO (`vczalo*`) → VCconnect (`vcconnect*`) → VClinks (`vclinks*`), all on
 * 28/09/2026. The extension id does not change (same unpacked folder), so old
 * keys are still there after the update; move them so the API URL/token,
 * account status and sender settings survive the rename.
 */

/** Newest first: when two generations hold the same key, the newer value wins. */
const LEGACY_PREFIXES = ['vcconnect', 'vczalo'];
const PREFIX = 'vclinks';

export const LEGACY_ALARMS = LEGACY_PREFIXES.flatMap((p) => [`${p}-sync`, `${p}-dev-reload`]);

export interface KvArea {
  get(keys: null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

/** Returns the number of keys moved. A key already present under the new name is kept as is. */
export async function migrateLegacyStorage(area: KvArea): Promise<number> {
  const all = await area.get(null);
  const legacy: string[] = [];
  const moved: Record<string, unknown> = {};
  for (const prefix of LEGACY_PREFIXES) {
    for (const k of Object.keys(all)) {
      if (!k.startsWith(prefix)) continue;
      legacy.push(k);
      const next = PREFIX + k.slice(prefix.length);
      if (!(next in all) && !(next in moved)) moved[next] = all[k];
    }
  }
  if (!legacy.length) return 0;
  if (Object.keys(moved).length) await area.set(moved);
  await area.remove(legacy);
  return Object.keys(moved).length;
}
