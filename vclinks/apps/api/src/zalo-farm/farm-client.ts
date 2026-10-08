import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ZaloStickerView } from '@vclinks/shared';

/** What the agent (tools/chrome-driver/farm-agent.js) says about one slot. */
export interface FarmSlotState {
  /** down: Chrome not answering · login: Zalo QR page · chat: logged in · other · unknown (no such slot on the agent). */
  page: 'down' | 'login' | 'chat' | 'other' | 'unknown';
  /** On the login page: qr shown, expired (being refreshed), scanned (waiting for the phone). */
  view?: 'qr' | 'expired' | 'scanned' | 'unknown';
  /** PNG data URL of the QR block, only when asked for and on the login page. */
  qr?: string | null;
  /** Direct slot: the phone declined the last login (a new QR is already shown). */
  note?: 'declined';
  /** Direct slot that is down: why. */
  lost?: 'duplicate_web' | 'direct_down';
  /** Zalo uids of the profile (names of its zdb_<uid> databases). */
  uids: string[];
  /** Mode on the agent (it moves a nick to direct by itself when planned), planned move, Zalo Web kept to go back. */
  mode?: 'browser' | 'direct';
  handoverAt?: string | null;
  chromeKept?: boolean;
}

/**
 * HTTP client of the "máy Zalo" agent (ZALO_FARM_URL, shared key ZALO_FARM_KEY, both in the server's .env).
 * The agent listens on 127.0.0.1 only. Unset URL = this server has no máy Zalo.
 */
@Injectable()
export class FarmClient {
  private get base() {
    return (process.env.ZALO_FARM_URL ?? '').trim().replace(/\/+$/, '');
  }
  private get key() {
    return (process.env.ZALO_FARM_KEY ?? '').trim();
  }

  get configured(): boolean {
    return !!this.base && this.key.length >= 24;
  }

  private async call<T>(method: string, path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
    if (!this.configured) throw new ServiceUnavailableException('Máy chủ này chưa cài máy Zalo.');
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method,
        headers: { 'x-farm-key': this.key, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException('Không liên lạc được máy Zalo. Thử lại sau ít phút.');
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 409) throw new ConflictException(data.error ?? 'Máy Zalo đã đủ nick.');
    if (res.status === 404) throw new NotFoundException('Máy Zalo không có chỗ này.');
    if (!res.ok) throw new ServiceUnavailableException(data.error ?? `Máy Zalo báo lỗi (${res.status}).`);
    return data as T;
  }

  health() {
    return this.call<{ ok: boolean; slots: number; max: number }>('GET', '/health', undefined, 5_000);
  }
  /** Starting Chrome takes up to a minute and a half the first time. */
  /** Zalo Web → direct now (plan P4); the agent answers the new mode facts. */
  handover(id: string) {
    return this.call<{ ok: true; mode: 'direct'; chromeKept: boolean }>('POST', `/slots/${id}/handover`, undefined, 90_000);
  }
  /** Direct → Zalo Web again with the kept profile. */
  rollback(id: string) {
    return this.call<{ ok: true; mode: 'browser' }>('POST', `/slots/${id}/rollback`, undefined, 90_000);
  }
  start(id: string, mode?: 'browser' | 'direct', handoverAfterMin?: number) {
    const body = { ...(mode ? { mode } : {}), ...(handoverAfterMin ? { handoverAfterMin } : {}) };
    return this.call<{ port: number }>('POST', `/slots/${id}/start`, body, 120_000);
  }
  state(id: string, qr: boolean) {
    return this.call<FarmSlotState>('GET', `/slots/${id}${qr ? '?qr=1' : ''}`, undefined, 20_000);
  }
  meta(id: string, uid: string | null) {
    return this.call<{ ok: true }>('POST', `/slots/${id}/meta`, { uid });
  }
  reset(id: string) {
    return this.call<{ ok: true }>('POST', `/slots/${id}/reset`, undefined, 120_000);
  }
  options(id: string, o: { openUnread?: boolean }) {
    return this.call<{ ok: true }>('POST', `/slots/${id}/options`, o);
  }
  /** Direct slots: Zalo's sticker search (ids, category, type, image link). */
  stickers(id: string, q: string) {
    return this.call<{ items: ZaloStickerView[] }>('GET', `/slots/${id}/stickers?q=${encodeURIComponent(q)}`, undefined, 15_000);
  }
  syncHistory(id: string) {
    return this.call<{ requested: boolean }>('POST', `/slots/${id}/sync-history`, undefined, 30_000);
  }
  remove(id: string) {
    return this.call<{ ok: true }>('DELETE', `/slots/${id}`, undefined, 30_000);
  }
}
