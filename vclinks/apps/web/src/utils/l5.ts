/** Pure helpers for the L5 message kinds (M1c-08): location, call, reminder. No React, no storage. */
import type { CallMedia, LocationMedia } from '../types';
import { safeUrl } from './chat';
import { fmtDuration } from './time';

/** Map link of a location: its own https link, else an OpenStreetMap link from the coordinates; null if neither. */
export function mapUrl(loc: LocationMedia): string | null {
  const own = safeUrl(loc.url);
  if (own?.startsWith('https://')) return own;
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number' && Math.abs(loc.lat) <= 90 && Math.abs(loc.lng) <= 180) {
    return `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=17/${loc.lat}/${loc.lng}`;
  }
  return null;
}

/** "21.02850, 105.85420" or null when coordinates are missing. */
export function coordsText(loc: LocationMedia): string | null {
  return typeof loc.lat === 'number' && typeof loc.lng === 'number' ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : null;
}

/** One line for a call bubble, e.g. "Cuộc gọi video đã kết thúc · 2:15". */
export function callText(call: CallMedia): string {
  const kind = call.video ? 'Cuộc gọi video' : 'Cuộc gọi';
  switch (call.outcome) {
    case 'missed':
      return `${kind} nhỡ`;
    case 'declined':
      return `${kind} bị từ chối`;
    case 'ended': {
      const d = fmtDuration(call.durationSec);
      return `${kind} đã kết thúc${d ? ` · ${d}` : ''}`;
    }
    default:
      return kind;
  }
}
