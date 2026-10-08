import { describe, expect, it, vi } from 'vitest';
import { HttpVcsaleClient, MOCK_VCSALE_CUSTOMERS, MockVcsaleClient, VcsaleExportError, VcsaleUnavailableError, createVcsaleClient } from '../src';

describe('MockVcsaleClient', () => {
  it('pages the whole catalogue without duplicates', async () => {
    const m = new MockVcsaleClient();
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await m.listCustomers({ cursor, limit: 7 });
      seen.push(...page.items.map((x) => x.code));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(MOCK_VCSALE_CUSTOMERS.length);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('searches by code, phone tail, tax code and accent-free name', async () => {
    const m = new MockVcsaleClient();
    expect((await m.searchCustomers('KH-TEST-0301')).map((x) => x.code)).toEqual(['KH-TEST-0301']);
    expect((await m.searchCustomers('000 388')).map((x) => x.code)).toEqual(['KH-TEST-0388']);
    expect((await m.searchCustomers('9900000301')).map((x) => x.code)).toContain('KH-TEST-0301');
    expect((await m.searchCustomers('khoa minh')).map((x) => x.code)).toEqual(['KH-TEST-0388']);
    expect(await m.searchCustomers('ab')).toEqual([]);
  });

  it('returns copies (callers cannot edit the catalogue) and simulates an outage', async () => {
    const m = new MockVcsaleClient();
    const x = (await m.getCustomer('KH-TEST-0101'))!;
    x.phones.push('0911111111');
    expect((await m.getCustomer('KH-TEST-0101'))!.phones).toHaveLength(1);
    m.down = true;
    await expect(m.listCustomers()).rejects.toBeInstanceOf(VcsaleUnavailableError);
  });

  it('createVcsaleClient defaults to the mock; http mode needs URL and key, an unreachable VCsales is "unavailable"', async () => {
    expect(createVcsaleClient({}).mode).toBe('mock');
    expect(() => createVcsaleClient({ VCSALE_MODE: 'http' })).toThrow();
    const h = createVcsaleClient({ VCSALE_MODE: 'http', VCSALE_URL: 'https://vcsales.invalid', VCSALE_TOKEN: 't' });
    expect(h).toBeInstanceOf(HttpVcsaleClient);
    await expect(h.listCustomers()).rejects.toBeInstanceOf(VcsaleUnavailableError);
  });
});

describe('debt batches and staff of the mock', () => {
  it('flags overdue debt by Vietnamese calendar day and reports unknown codes', async () => {
    const m = new MockVcsaleClient();
    const rows = await m.getDebtSummaries(['KH-TEST-0030', 'KH-TEST-0901', 'KH-NOPE']);
    expect(rows[0]).toMatchObject({ code: 'KH-TEST-0030', total: 180_000_000, overdue: 180_000_000 });
    expect(rows[1]).toMatchObject({ code: 'KH-TEST-0901', overdue: 1_800_000 });
    expect(rows[2]).toMatchObject({ code: 'KH-NOPE', notFound: true });
  });

  it('lists the sales staff with emails', async () => {
    const staff = await new MockVcsaleClient().listSalesStaff();
    expect(staff.length).toBeGreaterThan(0);
    expect(staff.every((x) => x.email?.endsWith('@vcprosperous.com'))).toBe(true);
  });
});

describe('HttpVcsaleClient against vclinks-bridge', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('sends the key, maps pages, gives null on 404 and stops at once on a refused key', async () => {
    const calls: string[] = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      calls.push(String(url));
      expect((init?.headers as Record<string, string>)['x-api-key']).toBe('k');
      const u = String(url);
      if (u.includes('/v1/customers?')) return json({ items: [{ code: 'C1' }], nextCursor: 'n' });
      if (u.endsWith('/v1/customers/NOPE')) return json({ code: 'NOT_FOUND' }, 404);
      if (u.endsWith('/v1/staff')) return json({ code: 'INVALID_KEY' }, 401);
      return json({});
    });
    try {
      const h = new HttpVcsaleClient('http://bridge:4050/', 'k');
      expect(await h.listCustomers({ updatedSince: '2026-10-01T00:00:00Z' })).toEqual({ items: [{ code: 'C1' }], nextCursor: 'n' });
      expect(calls[0]).toBe('http://bridge:4050/v1/customers?limit=200&updatedSince=2026-10-01T00%3A00%3A00Z');
      expect(await h.getCustomer('NOPE')).toBeNull();
      await expect(h.listSalesStaff()).rejects.toThrow(/từ chối kết nối/);
      expect(calls.filter((c) => c.endsWith('/v1/staff'))).toHaveLength(1);
      expect(await h.searchCustomers('ab')).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('getHealth: one call to /v1/ping behind the key; a database down or a refused key is "not ok" with the reason, never an error', async () => {
    const answers = [json({ ok: true, version: '0.1.0' }), json({ ok: false, version: '0.1.0' }), json({ code: 'INVALID_KEY' }, 401)];
    const urls: string[] = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      urls.push(String(url));
      return answers.shift()!;
    });
    try {
      const h = new HttpVcsaleClient('http://bridge:4050', 'k');
      expect(await h.getHealth()).toEqual({ ok: true, version: '0.1.0', error: null });
      expect(await h.getHealth()).toMatchObject({ ok: false, error: expect.stringMatching(/cơ sở dữ liệu/) });
      expect(await h.getHealth()).toMatchObject({ ok: false, error: expect.stringMatching(/từ chối kết nối/) });
      expect(urls.every((u) => u === 'http://bridge:4050/v1/ping')).toBe(true);
    } finally {
      spy.mockRestore();
    }
    const m = new MockVcsaleClient();
    expect((await m.getHealth()).ok).toBe(true);
    m.down = true;
    expect(await m.getHealth()).toMatchObject({ ok: false, version: null });
  });

  it('does not retry a time-out (it already waited)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    try {
      await expect(new HttpVcsaleClient('http://bridge:4050', 'k').getCustomer('C1')).rejects.toBeInstanceOf(VcsaleUnavailableError);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('retries once on a server error, then says VCsales is unavailable', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ code: 'UPSTREAM_UNAVAILABLE' }, 503));
    try {
      await expect(new HttpVcsaleClient('http://bridge:4050', 'k').getCommerce('C1')).rejects.toBeInstanceOf(VcsaleUnavailableError);
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('reads debts 100 codes a call', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const codes = new URL(String(url)).searchParams.get('codes')!.split(',');
      return json({ items: codes.map((code) => ({ code, total: 1, overdue: 0, dueAt: null, nearestDueAt: null, oldestOverdueAt: null, source: { total: 'invoices', due: 'invoices' } })) });
    });
    try {
      const codes = Array.from({ length: 250 }, (_, i) => `C${i}`);
      const rows = await new HttpVcsaleClient('http://bridge:4050', 'k').getDebtSummaries([...codes, 'C1']);
      expect(rows).toHaveLength(250);
      expect(spy).toHaveBeenCalledTimes(3);
    } finally {
      spy.mockRestore();
    }
  });

  it('exports the quote as PDF only, named by VCsales', async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="bao-gia-G1.pdf"' } }));
    try {
      const h = new HttpVcsaleClient('http://bridge:4050', 'k');
      await expect(h.getQuoteFiles('G1', 'image')).rejects.toBeInstanceOf(VcsaleExportError);
      const [file] = await h.getQuoteFiles('G1', 'pdf');
      expect(file).toMatchObject({ name: 'bao-gia-G1.pdf', mime: 'application/pdf' });
      expect(new TextDecoder().decode(file!.bytes)).toBe('%PDF-');
      expect(h.getQuoteCreateUrl('C1')).toBe('http://bridge:4050/sales/quotation/create');
      expect(new HttpVcsaleClient('http://bridge:4050', 'k', { webUrl: 'https://vcsales.vn/' }).getQuoteCreateUrl('C1')).toBe('https://vcsales.vn/sales/quotation/create');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('tra hàng (M1c-01)', () => {
  it('"má phanh Vios 2019" returns the Vios brake pads fast, priced by the customer tier (KH-TEST-0101 = hạng B, -10%)', async () => {
    const m = new MockVcsaleClient();
    const t0 = Date.now();
    const rows = await m.searchProducts('má phanh Vios 2019', { customerCode: 'KH-TEST-0101' });
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(rows.map((r) => r.sku)).toEqual(['VC-MP-VIOS-F', 'VC-MP-VIOS-R']);
    expect(rows[0]).toMatchObject({ listPrice: 850_000, customerPrice: 765_000, stock: 24, policy: 'Chính sách hạng B (-10%)' });
    expect(rows[1]!.stock).toBe(0);
    // another tier (C = -5%) and no customer
    expect((await m.searchProducts('má phanh vios', { customerCode: 'KH-TEST-0301' }))[0]!.customerPrice).toBe(807_500);
    expect((await m.searchProducts('má phanh vios'))[0]).toMatchObject({ customerPrice: null, policy: null });
  });

  it('finds by OE code (with or without dashes) and by vehicle line', async () => {
    const m = new MockVcsaleClient();
    expect((await m.searchProducts('04465-0D110'))[0]!.sku).toBe('VC-MP-VIOS-F');
    expect((await m.searchProducts('044650d110'))[0]!.sku).toBe('VC-MP-VIOS-F');
    expect((await m.searchProducts('civic')).map((x) => x.sku)).toEqual(['VC-LG-CIVIC']);
    expect(await m.searchProducts('x')).toEqual([]);
  });
});

describe('VCsales is read only (BR12, §7)', () => {
  const READ = /^(list|get|search)[A-Z]/;
  const methods = (o: object) => Object.getOwnPropertyNames(Object.getPrototypeOf(o)).filter((n) => n !== 'constructor' && typeof (o as never)[n] === 'function');

  it('the client interface exposes no write method: only list*/get*/search* (public, non-helper)', () => {
    const http = new HttpVcsaleClient('https://vcsales.invalid', 't');
    const names = methods(http).filter((n) => n !== 'unavailable');
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).toMatch(READ);
    // the mock may add test helpers (upsert / check); every other method is a read
    for (const n of methods(new MockVcsaleClient()).filter((n) => !['upsert', 'check', 'editQuote'].includes(n))) expect(n).toMatch(READ);
  });

  it('no outgoing HTTP call with a method other than GET (every read call, mock and http)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    try {
      const m = new MockVcsaleClient();
      await m.searchProducts('má phanh vios', { customerCode: 'KH-TEST-0101' });
      await m.getCommerce('KH-TEST-0101');
      await m.listCustomers();
      await m.listQuotes('KH-TEST-0101');
      await m.getQuote('BG-2026-0915');
      await m.getQuoteFiles('BG-2026-0915', 'pdf');
      const h = new HttpVcsaleClient('https://vcsales.invalid', 't');
      await h.searchProducts().catch(() => undefined);
      await h.listQuotes().catch(() => undefined);
      await h.getQuoteFiles().catch(() => undefined);
      for (const [, init] of spy.mock.calls) expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
    } finally {
      spy.mockRestore();
    }
  });
});


describe('quotes of the mock (M1c-02)', () => {
  it('lists the quotes of one customer only, newest first, live (reads are counted)', async () => {
    const m = new MockVcsaleClient();
    const rows = await m.listQuotes('KH-TEST-0101');
    expect(rows.map((q) => q.no)).toEqual(expect.arrayContaining(['BG-2026-0915', 'BG-2026-0932', 'BG-2026-0902']));
    expect(rows.every((q) => q.customerCode === 'KH-TEST-0101')).toBe(true);
    expect(await m.getQuote('NOPE')).toBeNull();
    expect(m.quoteReads).toBe(2);
  });

  it('editing a quote on VCsales changes its version', async () => {
    const m = new MockVcsaleClient();
    const before = (await m.getQuote('BG-2026-0915'))!;
    m.editQuote('BG-2026-0915', { total: 9_000_000 });
    const after = (await m.getQuote('BG-2026-0915'))!;
    expect(after.total).toBe(9_000_000);
    expect(after.version).not.toBe(before.version);
  });

  it('exports a real PDF and a PNG; an export outage raises VcsaleExportError', async () => {
    const m = new MockVcsaleClient();
    const [pdf] = await m.getQuoteFiles('BG-2026-0915', 'pdf');
    expect(pdf!.mime).toBe('application/pdf');
    expect(new TextDecoder().decode(pdf!.bytes.slice(0, 5))).toBe('%PDF-');
    const [img] = await m.getQuoteFiles('BG-2026-0915', 'image');
    expect(Array.from(img!.bytes.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]);
    m.exportDown = true;
    await expect(m.getQuoteFiles('BG-2026-0915', 'pdf')).rejects.toThrow(/không xuất được/);
  });

  it('the create link only carries the customer code (a link, never a write)', () => {
    expect(new MockVcsaleClient().getQuoteCreateUrl('KH-TEST-0101')).toContain('customer=KH-TEST-0101');
  });
});
