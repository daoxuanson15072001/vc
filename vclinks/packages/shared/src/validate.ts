import {
  ITEM_ID_FIELD,
  itemSchemas,
  messageContentItemSchema,
  threadNameItemSchema,
  type ItemOf,
  type MessageContentItem,
  type RejectedItem,
  type Stream,
  type ThreadNameItem,
} from './schemas';
import { findSensitivePaths } from './sensitive';
import { isEncryptedRecord } from './encryption';

export type ValidatedItem<S extends Stream> = { index: number; item: ItemOf<S> };

/**
 * Validates every item of a batch independently. Items carrying a sensitive
 * key anywhere (including inside `raw`) are rejected outright — never stored.
 */
export function validateItems<S extends Stream>(
  stream: S,
  items: unknown[],
): { valid: ValidatedItem<S>[]; rejected: RejectedItem[] } {
  const schema = itemSchemas[stream];
  const idField = ITEM_ID_FIELD[stream];
  const valid: ValidatedItem<S>[] = [];
  const rejected: RejectedItem[] = [];

  items.forEach((raw, index) => {
    const id =
      raw && typeof raw === 'object' && (raw as Record<string, unknown>)[idField] != null
        ? String((raw as Record<string, unknown>)[idField])
        : undefined;

    const sensitive = findSensitivePaths(raw);
    if (sensitive.length) {
      rejected.push({ index, id, reason: `sensitive_field: ${sensitive.slice(0, 5).join(', ')}` });
      return;
    }
    // Ciphertext from Zalo Web's at-rest encryption: refuse rather than store junk.
    if (raw && typeof raw === 'object' && isEncryptedRecord((raw as Record<string, unknown>).raw)) {
      rejected.push({ index, id, reason: 'encrypted_record' });
      return;
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      rejected.push({ index, id, reason: `invalid: ${issues}` });
      return;
    }
    valid.push({ index, item: parsed.data as ItemOf<S> });
  });

  return { valid, rejected };
}

export interface ValidatedContent {
  index: number;
  item: MessageContentItem;
}

/**
 * Validates DOM-captured message content. Rejects any item carrying a sensitive
 * key (defence in depth: content should never contain ciphertext or secrets).
 */
export function validateContentItems(items: unknown[]): {
  valid: ValidatedContent[];
  rejected: RejectedItem[];
} {
  const valid: ValidatedContent[] = [];
  const rejected: RejectedItem[] = [];
  items.forEach((raw, index) => {
    const id =
      raw && typeof raw === 'object' && (raw as Record<string, unknown>).cliMsgId != null
        ? String((raw as Record<string, unknown>).cliMsgId)
        : undefined;
    const sensitive = findSensitivePaths(raw);
    if (sensitive.length) {
      rejected.push({ index, id, reason: `sensitive_field: ${sensitive.slice(0, 5).join(', ')}` });
      return;
    }
    const parsed = messageContentItemSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      rejected.push({ index, id, reason: `invalid: ${issues}` });
      return;
    }
    valid.push({ index, item: parsed.data });
  });
  return { valid, rejected };
}

export interface ValidatedThreadName {
  index: number;
  item: ThreadNameItem;
}

/** Validates DOM-read conversation names (defence in depth against secrets). */
export function validateThreadNames(items: unknown[]): {
  valid: ValidatedThreadName[];
  rejected: RejectedItem[];
} {
  const valid: ValidatedThreadName[] = [];
  const rejected: RejectedItem[] = [];
  items.forEach((raw, index) => {
    const id =
      raw && typeof raw === 'object' && (raw as Record<string, unknown>).threadId != null
        ? String((raw as Record<string, unknown>).threadId)
        : undefined;
    const sensitive = findSensitivePaths(raw);
    if (sensitive.length) {
      rejected.push({ index, id, reason: `sensitive_field: ${sensitive.slice(0, 5).join(', ')}` });
      return;
    }
    const parsed = threadNameItemSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      rejected.push({ index, id, reason: `invalid: ${issues}` });
      return;
    }
    valid.push({ index, item: parsed.data });
  });
  return { valid, rejected };
}
