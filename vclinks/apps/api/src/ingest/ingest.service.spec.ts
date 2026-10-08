import { IngestService, computeLagStats, percentile } from './ingest.service';

const NOW = Date.now();
const msg = (id: string, ageMs: number, extra: Record<string, unknown> = {}) => ({
  msgId: id,
  threadId: 't1',
  fromUid: 'u1',
  msgType: 'webchat',
  sentAt: NOW - ageMs,
  ...extra,
});

function setup(bulkWrite: jest.Mock) {
  const appendEvent = jest.fn().mockResolvedValue(undefined);
  const col = jest.fn().mockReturnValue({ bulkWrite, distinct: jest.fn().mockResolvedValue([]) });
  const db = { col, appendEvent } as never;
  const accounts = { assertExists: jest.fn().mockResolvedValue(undefined) } as never;
  const svc = new IngestService(db, accounts);
  const priv = svc as unknown as Record<string, jest.Mock>;
  priv.absorbDomMessages = jest.fn().mockResolvedValue(undefined);
  priv.refreshConversations = jest.fn().mockResolvedValue(undefined);
  priv.advanceCheckpoint = jest.fn().mockResolvedValue(123);
  return { svc, priv, appendEvent };
}

describe('percentile / computeLagStats', () => {
  it('returns null for no samples', () => {
    expect(computeLagStats([])).toBeNull();
  });
  it('computes nearest-rank p50, p95 and max', () => {
    const lags = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
    expect(computeLagStats(lags)).toEqual({ p50: 500, p95: 950, max: 1000 });
    expect(percentile([7], 95)).toBe(7);
  });
});

describe('IngestService.ingest partial bulkWrite failure', () => {
  it('reports failed records, keeps follow-up steps and checkpoint for the written part', async () => {
    const err = Object.assign(new Error('boom'), {
      name: 'MongoBulkWriteError',
      writeErrors: [{ index: 1, code: 11000 }],
      result: { upsertedCount: 1, modifiedCount: 0, matchedCount: 0, upsertedIds: { 0: 'x' } },
    });
    const { svc, priv, appendEvent } = setup(jest.fn().mockRejectedValue(err));
    const r = await svc.ingest('messages', 'u1', [msg('a', 1000), msg('b', 2000)]);
    expect(r.accepted).toBe(1);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].index).toBe(1);
    expect(r.rejected[0].reason).toContain('11000');
    expect(JSON.stringify(r.rejected)).not.toMatch(/text/);
    expect(priv.refreshConversations).toHaveBeenCalledTimes(1);
    expect(priv.advanceCheckpoint).toHaveBeenCalledTimes(1);
    const cpItems = priv.advanceCheckpoint.mock.calls[0][2] as { msgId: string }[];
    expect(cpItems.map((m) => m.msgId)).toEqual(['a']);
    const data = appendEvent.mock.calls[0][0].data;
    expect(data.rejected).toBe(1);
    expect(data.lagMaxMs).toBeGreaterThanOrEqual(1000);
  });

  it('rethrows non-bulk errors', async () => {
    const { svc } = setup(jest.fn().mockRejectedValue(new Error('network')));
    await expect(svc.ingest('messages', 'u1', [msg('a', 1000)])).rejects.toThrow('network');
  });

  it('a failing refreshConversations does not lose the checkpoint', async () => {
    const ok = { upsertedCount: 2, modifiedCount: 0, matchedCount: 0, upsertedIds: { 0: 'a', 1: 'b' } };
    const { svc, priv, appendEvent } = setup(jest.fn().mockResolvedValue(ok));
    priv.refreshConversations.mockRejectedValue(new Error('agg failed'));
    priv.absorbDomMessages.mockRejectedValue(new Error('dom failed'));
    const r = await svc.ingest('messages', 'u1', [msg('a', 1000), msg('b', 3000)]);
    expect(r.checkpoint).toBe(123);
    expect(priv.advanceCheckpoint).toHaveBeenCalledTimes(1);
    expect(r.accepted).toBe(2);
    const data = appendEvent.mock.calls[0][0].data;
    expect(data.lagP50Ms).toBeGreaterThanOrEqual(1000);
    expect(data.lagP95Ms).toBeGreaterThanOrEqual(3000);
  });

  it('skips approximate sentAt in lag', async () => {
    const ok = { upsertedCount: 1, modifiedCount: 0, matchedCount: 0, upsertedIds: { 0: 'a' } };
    const { svc, appendEvent } = setup(jest.fn().mockResolvedValue(ok));
    await svc.ingest('messages', 'u1', [msg('a', 5000, { sentAtApprox: true })]);
    expect(appendEvent.mock.calls[0][0].data.lagMaxMs).toBeUndefined();
  });
});
