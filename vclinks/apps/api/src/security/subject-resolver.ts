/*
 * Link between encryption subjects and customers (M1b-14 ↔ M1b-12).
 *
 * Keys are per channel identity (`identity_links._id` = `contacts._id` = `${uid}:${userId}`), which never
 * changes on merge / split, so merging customers never re-encrypts anything. Erasing a customer erases
 * every identity linked to it. M1b-12 provides the real resolver (CustomersService.identityIdsOfAccount /
 * accountOfIdentity) by binding SUBJECT_RESOLVER; until then an identity is its own subject.
 */
export const SUBJECT_RESOLVER = Symbol('SUBJECT_RESOLVER');

export interface SubjectResolver {
  /** Identity ids linked to customer account `accountId`. */
  identityIdsOfAccount(accountId: string): Promise<string[]>;
  /** Customer account of an identity, if linked. */
  accountOfIdentity(identityId: string): Promise<string | null>;
}

export const DEFAULT_SUBJECT_RESOLVER: SubjectResolver = {
  identityIdsOfAccount: async () => [],
  accountOfIdentity: async () => null,
};
