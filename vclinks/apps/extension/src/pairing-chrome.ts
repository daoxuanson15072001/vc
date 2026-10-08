import { PAIRING_KEY, type PairingDeps, type PendingPairing } from './pairing';
import { STORAGE_KEYS, type ExtensionConfig } from './status';

/** Alarm that keeps polling for the Admin's approval after the popup is closed. */
export const PAIRING_ALARM = 'vclinks-pair';

/** Real fetch + chrome.storage for pairing.ts (popup and service worker). */
export function chromePairingDeps(): PairingDeps {
  return {
    fetchFn: (url, init) => fetch(url, init),
    async load() {
      const got = await chrome.storage.local.get([PAIRING_KEY, STORAGE_KEYS.config]);
      return {
        pairing: got[PAIRING_KEY] as PendingPairing | undefined,
        config: got[STORAGE_KEYS.config] as ExtensionConfig | undefined,
      };
    },
    saveConfig: (cfg) => chrome.storage.local.set({ [STORAGE_KEYS.config]: cfg }),
    async savePairing(p) {
      if (p) await chrome.storage.local.set({ [PAIRING_KEY]: p });
      else await chrome.storage.local.remove(PAIRING_KEY);
    },
    now: () => Date.now(),
  };
}
