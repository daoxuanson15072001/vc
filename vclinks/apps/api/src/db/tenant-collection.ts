import type { AnyBulkWriteOperation, Collection, Document, Filter } from 'mongodb';

/** Field present on every tenant-scoped record (BA §2.2 #10). */
export const TENANT_FIELD = 'tenant_id';

/** Methods taking a filter as their first argument. */
const FILTER_FIRST = new Set([
  'find',
  'findOne',
  'countDocuments',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
  'findOneAndUpdate',
  'updateOne',
  'updateMany',
]);

/** Methods that cannot be restricted to one tenant: refused rather than silently global. */
const REFUSED = new Set([
  'estimatedDocumentCount',
  'watch',
  'initializeOrderedBulkOp',
  'initializeUnorderedBulkOp',
  'drop',
  'rename',
]);

/** Aggregation stages that must stay first in a pipeline. */
const FIRST_STAGES = ['$geoNear', '$search', '$searchMeta', '$vectorSearch'];

/** Extra filter of the current call (data scope of the signed-in user, M1b-04), or undefined. */
export type ExtraFilter = () => Document | undefined;

export const scopeFilter = <T>(filter: T | undefined, tenantId: string, extra?: Document) => {
  const base = (filter as object) ?? {};
  if (!extra) return { ...base, [TENANT_FIELD]: tenantId } as T;
  // $and keeps both filters intact (either may hold its own $or).
  const parts = Object.keys(base).length ? [base, extra] : [extra];
  return { $and: parts, [TENANT_FIELD]: tenantId } as T;
};

const stamp = <T>(doc: T, tenantId: string) => ({ ...(doc as object), [TENANT_FIELD]: tenantId }) as T;

function scopePipeline(pipeline: Document[] = [], tenantId: string, extra?: Document): Document[] {
  const [first, ...rest] = pipeline;
  if (first?.$match) return [{ $match: scopeFilter(first.$match, tenantId, extra) }, ...rest];
  const match = { $match: scopeFilter({}, tenantId, extra) };
  if (first && FIRST_STAGES.some((s) => s in first)) return [first, match, ...rest];
  return [match, ...pipeline];
}

function scopeBulkOp(op: AnyBulkWriteOperation<Document>, tenantId: string, extra?: Document): AnyBulkWriteOperation<Document> {
  const o = op as unknown as Record<string, Record<string, unknown>>;
  if (o.insertOne) return { insertOne: { ...o.insertOne, document: stamp(o.insertOne.document, tenantId) } } as never;
  for (const k of ['updateOne', 'updateMany', 'deleteOne', 'deleteMany']) {
    if (o[k]) return { [k]: { ...o[k], filter: scopeFilter(o[k].filter, tenantId, extra) } } as never;
  }
  if (o.replaceOne) {
    return {
      replaceOne: {
        ...o.replaceOne,
        filter: scopeFilter(o.replaceOne.filter, tenantId, extra),
        replacement: stamp(o.replaceOne.replacement, tenantId),
      },
    } as never;
  }
  throw new Error('Unsupported bulk operation on a tenant-scoped collection');
}

/**
 * Wraps a collection so every read is filtered by `tenant_id` and every write
 * stamps or filters it. The tenant is read on each call (`tenant()`), so a
 * wrapper kept in a variable follows the caller's current scope.
 *
 * `$lookup` stages are not rewritten: lookups join on `_id = ${uid}:${id}` and
 * `_id` is unique per collection across tenants, so a joined row always
 * belongs to the tenant of the row it was joined from.
 */
export function tenantScoped<T extends Document>(col: Collection<T>, tenant: () => string, extraFilter?: ExtraFilter): Collection<T> {
  const ex = () => extraFilter?.();
  return new Proxy(col, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string' || typeof value !== 'function') return value;
      if (REFUSED.has(prop)) {
        return () => {
          throw new Error(`${prop} is not allowed on tenant-scoped collection "${target.collectionName}"`);
        };
      }
      const fn = value as (...a: unknown[]) => unknown;
      if (FILTER_FIRST.has(prop)) {
        return (filter: Filter<T> | undefined, ...rest: unknown[]) => fn.call(target, scopeFilter(filter, tenant(), ex()), ...rest);
      }
      switch (prop) {
        case 'replaceOne':
        case 'findOneAndReplace':
          return (filter: Filter<T>, doc: T, ...rest: unknown[]) =>
            fn.call(target, scopeFilter(filter, tenant(), ex()), stamp(doc, tenant()), ...rest);
        case 'distinct':
          return (key: string, filter?: Filter<T>, ...rest: unknown[]) =>
            fn.call(target, key, scopeFilter(filter, tenant(), ex()), ...rest);
        case 'insertOne':
          return (doc: T, ...rest: unknown[]) => fn.call(target, stamp(doc, tenant()), ...rest);
        case 'insertMany':
          return (docs: T[], ...rest: unknown[]) => fn.call(target, docs.map((d) => stamp(d, tenant())), ...rest);
        case 'bulkWrite':
          return (ops: AnyBulkWriteOperation<Document>[], ...rest: unknown[]) =>
            fn.call(target, ops.map((op) => scopeBulkOp(op, tenant(), ex())), ...rest);
        case 'aggregate':
          return (pipeline?: Document[], ...rest: unknown[]) => fn.call(target, scopePipeline(pipeline, tenant(), ex()), ...rest);
        default:
          // Index management, names, options: not data access.
          return fn.bind(target);
      }
    },
  });
}
