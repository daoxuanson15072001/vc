import type { Collection } from 'mongodb';

type StrDoc = { _id?: string; [k: string]: unknown };
import { tenantScoped } from './tenant-collection';

/** Records the arguments each method receives. */
function fakeCollection() {
  const calls: Record<string, unknown[]> = {};
  const rec = (name: string) => (...args: unknown[]) => {
    calls[name] = args;
    return name;
  };
  const col = {
    collectionName: 'messages',
    find: rec('find'),
    updateOne: rec('updateOne'),
    insertOne: rec('insertOne'),
    insertMany: rec('insertMany'),
    bulkWrite: rec('bulkWrite'),
    aggregate: rec('aggregate'),
    distinct: rec('distinct'),
    replaceOne: rec('replaceOne'),
    createIndexes: rec('createIndexes'),
    estimatedDocumentCount: rec('estimatedDocumentCount'),
  } as unknown as Collection<StrDoc>;
  return { col, calls };
}

describe('tenantScoped', () => {
  let tenant = 'a';
  const make = () => {
    const f = fakeCollection();
    return { ...f, scoped: tenantScoped(f.col, () => tenant) };
  };

  it('filters reads and updates, overriding a caller-supplied tenant_id', () => {
    const { scoped, calls } = make();
    void scoped.find({ uid: '1', tenant_id: 'b' });
    expect(calls.find[0]).toEqual({ uid: '1', tenant_id: 'a' });
    void scoped.find();
    expect(calls.find[0]).toEqual({ tenant_id: 'a' });
    void scoped.updateOne({ _id: 'x' }, { $set: { v: 1 } }, { upsert: true });
    expect(calls.updateOne).toEqual([{ _id: 'x', tenant_id: 'a' }, { $set: { v: 1 } }, { upsert: true }]);
    void scoped.distinct('threadId', { uid: '1' });
    expect(calls.distinct).toEqual(['threadId', { uid: '1', tenant_id: 'a' }]);
  });

  it('stamps inserts and replacements', () => {
    const { scoped, calls } = make();
    void scoped.insertOne({ _id: 'x' });
    expect(calls.insertOne[0]).toEqual({ _id: 'x', tenant_id: 'a' });
    void scoped.insertMany([{ n: 1 }, { n: 2 }]);
    expect(calls.insertMany[0]).toEqual([{ n: 1, tenant_id: 'a' }, { n: 2, tenant_id: 'a' }]);
    void scoped.replaceOne({ _id: 'x' }, { v: 1 });
    expect(calls.replaceOne.slice(0, 2)).toEqual([{ _id: 'x', tenant_id: 'a' }, { v: 1, tenant_id: 'a' }]);
  });

  it('scopes every bulk operation', () => {
    const { scoped, calls } = make();
    void scoped.bulkWrite([
      { insertOne: { document: { _id: '1' } } },
      { updateOne: { filter: { _id: '2' }, update: { $set: { v: 1 } }, upsert: true } },
      { deleteMany: { filter: { uid: '3' } } },
    ]);
    expect(calls.bulkWrite[0]).toEqual([
      { insertOne: { document: { _id: '1', tenant_id: 'a' } } },
      { updateOne: { filter: { _id: '2', tenant_id: 'a' }, update: { $set: { v: 1 } }, upsert: true } },
      { deleteMany: { filter: { uid: '3', tenant_id: 'a' } } },
    ]);
  });

  it('merges into a leading $match, or prepends one', () => {
    const { scoped, calls } = make();
    void scoped.aggregate([{ $match: { $text: { $search: 'x' } } }, { $limit: 1 }]);
    expect(calls.aggregate[0]).toEqual([{ $match: { $text: { $search: 'x' }, tenant_id: 'a' } }, { $limit: 1 }]);
    void scoped.aggregate([{ $sort: { a: 1 } }]);
    expect(calls.aggregate[0]).toEqual([{ $match: { tenant_id: 'a' } }, { $sort: { a: 1 } }]);
    void scoped.aggregate([{ $geoNear: {} }, { $limit: 1 }]);
    expect(calls.aggregate[0]).toEqual([{ $geoNear: {} }, { $match: { tenant_id: 'a' } }, { $limit: 1 }]);
  });

  it('reads the tenant at call time and refuses unscoped operations', () => {
    const { scoped, calls } = make();
    tenant = 'b';
    void scoped.find({});
    expect(calls.find[0]).toEqual({ tenant_id: 'b' });
    tenant = 'a';
    expect(() => scoped.estimatedDocumentCount()).toThrow(/not allowed/);
    void scoped.createIndexes([{ key: { uid: 1 } }]);
    expect(calls.createIndexes[0]).toEqual([{ key: { uid: 1 } }]);
  });
});
