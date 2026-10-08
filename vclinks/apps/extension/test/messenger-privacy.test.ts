// @vitest-environment happy-dom
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OWNER_ID, PARTNER_ID, inc, out, page, sep, sidebar } from './messenger-fixtures';

/**
 * Hard rule for the Messenger channel: the content script never reads
 * document.cookie, localStorage/sessionStorage, Facebook's IndexedDB or
 * tokens, and never calls Facebook endpoints (fetch/XHR). Checked twice:
 * at runtime (spies on every such API while the real content script runs a
 * full read + post cycle) and statically (source scan).
 */

const touched: string[] = [];

function trapGetter(obj: object, prop: string, label: string) {
  let proto: object | null = obj;
  while (proto && !Object.getOwnPropertyDescriptor(proto, prop)) proto = Object.getPrototypeOf(proto);
  Object.defineProperty(obj, prop, {
    configurable: true,
    get() {
      touched.push(label);
      throw new Error(`forbidden: ${label}`);
    },
    set() {
      touched.push(`${label} (write)`);
    },
  });
}

describe('Messenger content script privacy', () => {
  const sent: { type: string; op?: string; args?: unknown[] }[] = [];

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 15, 0, 0));
    (window as unknown as { happyDOM: { setURL(u: string): void } }).happyDOM.setURL(`https://www.messenger.com/t/${PARTNER_ID}/`);

    document.body.innerHTML = page({
      sidebar: sidebar([{ id: PARTNER_ID, name: 'Anh Tuấn Gara', unread: true }]),
      rows: sep('10:00') + inc('Anh Tuấn Gara', 'Báo giá lọc gió') + out('Dạ em gửi ạ'),
    });

    trapGetter(document, 'cookie', 'document.cookie');
    for (const p of ['localStorage', 'sessionStorage', 'indexedDB']) trapGetter(globalThis, p, p);
    for (const p of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) trapGetter(globalThis, p, p);
    // The traps really fire (so an empty `touched` below means something).
    expect(() => document.cookie).toThrow('forbidden');
    expect(() => globalThis.localStorage).toThrow('forbidden');
    expect(touched).toEqual(['document.cookie', 'localStorage']);
    touched.length = 0;

    const chromeStub = {
      runtime: {
        id: 'vclinks-test',
        sendMessage: vi.fn(async (msg: { type: string; op?: string; args?: unknown[] }) => {
          sent.push(msg);
          if (msg.type !== 'vclinks:fb-api') return undefined;
          switch (msg.op) {
            case 'getActiveMapping':
              return { ok: true, data: { version: 3, spec: {} } };
            case 'registerAccount':
              return { ok: true, data: { uid: `fb_${OWNER_ID}`, label: 'x', created: true } };
            case 'ingest':
              return { ok: true, data: { accepted: 1, updated: 0, unchanged: 0, rejected: [], checkpoint: null } };
            case 'ingestThreadNames':
              return { ok: true, data: { matched: 1, unmatched: [], rejected: [] } };
            default:
              return { ok: false, status: 400, message: 'unexpected' };
          }
        }),
      },
      storage: {
        local: {
          // The owner id typed in the popup (extension storage, not the page's).
          get: vi.fn(async () => ({ vclinksFbOwnerId: OWNER_ID })),
          set: vi.fn(async () => undefined),
        },
      },
    };
    (globalThis as unknown as { chrome: unknown }).chrome = chromeStub;

    await import('../src/messenger/content');
    // Watcher debounce (2 s), sender first tick (15 s), one more cycle (60 s).
    await vi.advanceTimersByTimeAsync(70_000);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('reads and posts the rendered conversation through the background', () => {
    const ops = sent.filter((m) => m.type === 'vclinks:fb-api').map((m) => m.op);
    expect(ops).toContain('registerAccount');
    expect(ops).toContain('ingest');
    const msgs = sent.find((m) => m.op === 'ingest' && m.args?.[0] === 'messages');
    expect(msgs?.args?.[1]).toBe(`fb_${OWNER_ID}`);
    expect((msgs?.args?.[2] as { text: string }[]).map((m) => m.text)).toEqual(['Báo giá lọc gió', 'Dạ em gửi ạ']);
    // Sending is off by default: no outbox call was made.
    expect(sent.some((m) => m.type === 'vclinks:fb-outbox')).toBe(false);
  });

  it('never touched cookies, web storage, IndexedDB or network APIs of the page', () => {
    expect(touched).toEqual([]);
  });

  it('source never references cookies, page storage, tokens or Facebook endpoints', () => {
    const dir = join(__dirname, '../src/messenger');
    const forbidden = [
      /document\.cookie/,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bindexedDB\b/,
      /\bfb_dtsg\b/,
      /access_?token/i,
      /\bfetch\s*\(/,
      /XMLHttpRequest/,
      /\/api\/graphql/,
      /graphql/i,
    ];
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      const code = readFileSync(join(dir, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      for (const re of forbidden) expect(`${f}: ${re.test(code) ? re : 'ok'}`).toBe(`${f}: ok`);
    }
  });
});
