import { describe, expect, it } from 'vitest';
import { migrateLegacyStorage, type KvArea } from '../src/legacy';

function memArea(init: Record<string, unknown>): KvArea & { data: Record<string, unknown> } {
  const data = { ...init };
  return {
    data,
    get: async () => ({ ...data }),
    set: async (items) => void Object.assign(data, items),
    remove: async (keys) => keys.forEach((k) => delete data[k]),
  };
}

describe('migrateLegacyStorage', () => {
  it('moves vczalo* keys to vclinks* and removes the old ones', async () => {
    const area = memArea({
      vczaloConfig: { apiBaseUrl: 'https://x', token: 't' },
      'vczaloAccount:123': { uid: '123' },
      'vczalo:backfill': { state: 'done' },
      other: 1,
    });
    expect(await migrateLegacyStorage(area)).toBe(3);
    expect(area.data).toEqual({
      vclinksConfig: { apiBaseUrl: 'https://x', token: 't' },
      'vclinksAccount:123': { uid: '123' },
      'vclinks:backfill': { state: 'done' },
      other: 1,
    });
  });

  it('prefers vcconnect* over vczalo* when both exist', async () => {
    const area = memArea({ vczaloConfig: { token: 'oldest' }, vcconnectConfig: { token: 'newer' }, vcconnectRun: 1 });
    expect(await migrateLegacyStorage(area)).toBe(2);
    expect(area.data).toEqual({ vclinksConfig: { token: 'newer' }, vclinksRun: 1 });
  });

  it('never overwrites a key already set under the new name', async () => {
    const area = memArea({ vczaloConfig: { token: 'old' }, vclinksConfig: { token: 'new' } });
    expect(await migrateLegacyStorage(area)).toBe(0);
    expect(area.data).toEqual({ vclinksConfig: { token: 'new' } });
  });

  it('is a no-op without legacy keys', async () => {
    const area = memArea({ vclinksConfig: {} });
    expect(await migrateLegacyStorage(area)).toBe(0);
    expect(area.data).toEqual({ vclinksConfig: {} });
  });
});
