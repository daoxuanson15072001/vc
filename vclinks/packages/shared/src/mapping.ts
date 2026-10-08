import { z } from 'zod';
import {
  ENCRYPTED_CONTENT_FIELDS,
  isEncryptedRecord,
  stripEncryptedValues,
} from './encryption';
import { CORE_STREAMS, OPTIONAL_STREAMS, type Stream } from './schemas';
import { isSensitiveKey, isSensitiveStoreName, stripSensitive } from './sensitive';

/**
 * Declarative map from Zalo Web IndexedDB records to VClinks ingest items.
 *
 * This is pure data (no code) so Claude can propose a new version over MCP when
 * Zalo changes its storage layout, and a human approves it on the Dashboard.
 */
const fieldPath = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_$]+(\.[A-Za-z0-9_$]+)*$/, 'dotted path only')
  .refine((p) => !p.split('.').some(isSensitiveKey), 'sensitive field');

export const streamMappingSchema = z.object({
  /** DB name prefix; the account uid is appended, e.g. `zdb_` → `zdb_<uid>`. */
  dbPrefix: z.string().min(1).max(100).refine((n) => !isSensitiveStoreName(n), 'sensitive db'),
  store: z.string().min(1).max(100).refine((n) => !isSensitiveStoreName(n), 'sensitive store'),
  /** target field name → source path in the IndexedDB record */
  fields: z.record(z.string().min(1).max(100), fieldPath),
  /** Target fields that must be present, otherwise the record counts as drift. */
  required: z.array(z.string()).default([]),
});

/** A CSS selector list; bounded so a proposal cannot smuggle in a huge blob. */
const cssSelector = z.string().min(1).max(500);
/** Plain token interpolated into attribute selectors: no quotes or brackets. */
const cssToken = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/, 'letters, digits, _ and - only');

/**
 * Where the extension finds message content in the Zalo Web DOM (IndexedDB holds
 * only ciphertext). Declarative like the field mapping, so a Zalo UI change is
 * fixed by proposing new selectors — no extension rebuild.
 */
export const domSelectorsSchema = z.object({
  /** Chat bubble id prefix; the rest of the id is the cliMsgId. */
  bubbleIdPrefix: cssToken,
  /** Inside a bubble: the element holding the message text. */
  text: cssSelector,
  /** Inside a bubble: present only on outgoing (sent) messages. */
  sentMarker: cssSelector,
  /** Regex source; <img> URLs matching it are not message images (avatars, emoji…). */
  imageSkip: z
    .string()
    .max(300)
    .refine((r) => {
      try {
        new RegExp(r, 'i');
        return true;
      } catch {
        return false;
      }
    }, 'invalid regex'),
  /** Attribute on each sidebar item that carries the threadId. */
  threadIdAttr: cssToken,
  /** Inside a sidebar item: the element holding the conversation name. */
  threadTitle: cssSelector,
  /** threadIds starting with this prefix are groups. */
  groupIdPrefix: z.string().max(10),
  /**
   * Bubble structures surveyed on real Zalo Web: kind → anchor selector. A bubble
   * matching none of them (and not empty) is an unsurveyed structure: its content
   * is not stored and a `dom_selectors` drift is reported until it is locked here.
   * Absent means the built-in defaults.
   */
  knownBubbles: z
    .record(cssToken, cssSelector)
    .refine((r) => Object.keys(r).length <= 30, 'too many kinds')
    .optional(),
});

export const fieldMappingSpecSchema = z.object({
  streams: z.object({
    ...(Object.fromEntries(CORE_STREAMS.map((s) => [s, streamMappingSchema])) as Record<
      (typeof CORE_STREAMS)[number],
      typeof streamMappingSchema
    >),
    // Added after v1: a mapping without them is still valid (the stream is skipped).
    ...(Object.fromEntries(OPTIONAL_STREAMS.map((s) => [s, streamMappingSchema.optional()])) as Record<
      (typeof OPTIONAL_STREAMS)[number],
      z.ZodOptional<typeof streamMappingSchema>
    >),
  }),
  /** Optional: absent means "keep the active selectors" (or the defaults). */
  dom: domSelectorsSchema.optional(),
});

export type StreamMapping = z.infer<typeof streamMappingSchema>;
export type DomSelectors = z.infer<typeof domSelectorsSchema>;
export type FieldMappingSpec = z.infer<typeof fieldMappingSpecSchema>;

/**
 * Bubble structures locked from the real survey of 2026-09-28 (docs/04-ky-thuat/zalo-web/zalo-dom-selectors.md).
 * Voice, video, sticker, gif, location and business card are not surveyed yet.
 */
export const DEFAULT_KNOWN_BUBBLES: Readonly<Record<string, string>> = {
  text: '[data-id$="Msg_Text"]',
  photo: '[data-id$="Msg_Photo"]',
  groupPhoto: '[data-id$="Msg_GrpPhoto"]',
  file: '.file-message__container',
  link: '[data-id$="Msg_Link"]',
};

/** Zalo Web DOM as surveyed on 2026-09-28 (docs/04-ky-thuat/zalo-web/zalo-web-extraction.md). */
export const DEFAULT_DOM_SELECTORS: DomSelectors = {
  bubbleIdPrefix: 'bb_msg_id_',
  text: '[data-id$="Msg_Text"], [data-id$="Msg_Link"]',
  // The newest bubble of a run uses `div_LastSentMsg_*` instead of `div_SentMsg_*`.
  // File bubbles have no `div_*SentMsg_*` part, only the reaction button `btn_(Last)SentMsg_React`.
  sentMarker: '[data-id^="div_SentMsg"], [data-id^="div_LastSentMsg"], [data-id^="btn_SentMsg"], [data-id^="btn_LastSentMsg"]',
  imageSkip: 'avatar|emoji|sticker|reaction',
  threadIdAttr: 'anim-data-id',
  threadTitle: '[data-id*="Title" i], [data-id*="Name" i]',
  groupIdPrefix: 'g',
  knownBubbles: DEFAULT_KNOWN_BUBBLES,
};

export interface ActiveFieldMapping {
  version: number;
  spec: FieldMappingSpec;
}

/**
 * Version 1, based on the Zalo Web survey of 2026-09-28 (CLAUDE.md §3).
 * `groups` / `conversations` field names corrected from the first real drift
 * reports (2026-09-28): both stores key on `userId`; groups use `displayName`.
 */
export const DEFAULT_FIELD_MAPPING: FieldMappingSpec = {
  streams: {
    contacts: {
      dbPrefix: 'zdb_',
      store: 'friend',
      fields: {
        userId: 'userId',
        displayName: 'displayName',
        zaloName: 'zaloName',
        username: 'username',
        phone: 'phoneNumber',
        avatar: 'avatar',
        gender: 'gender',
        isFriend: 'isFr',
        bizInfo: 'bizInfo',
        oaInfo: 'oaInfo',
        lastActionTime: 'lastActionTime',
      },
      required: ['userId'],
    },
    groups: {
      dbPrefix: 'zdb_',
      store: 'group',
      fields: {
        groupId: 'userId',
        name: 'displayName',
        avatar: 'avatar',
        memberIds: 'memberIds',
        creatorId: 'creatorId',
      },
      required: ['groupId'],
    },
    conversations: {
      dbPrefix: 'zdb_',
      store: 'conversation',
      fields: {
        threadId: 'userId',
        isGroup: 'isGroup',
        pinned: 'pinned',
        labelId: 'label',
      },
      required: ['threadId'],
    },
    messages: {
      dbPrefix: 'zdb_',
      store: 'message',
      fields: {
        msgId: 'msgId',
        cliMsgId: 'cliMsgId',
        fromUid: 'fromUid',
        toUid: 'toUid',
        senderName: 'dName',
        msgType: 'msgType',
        originMsgType: 'originMsgType',
        body: 'message',
        sentAt: 'sendDttm',
        serverTime: 'serverTime',
        quote: 'quote',
        mentions: 'mentions',
        e2eeStatus: 'e2eeStatus',
        syncFromMobile: 'syncFromMobile',
        status: 'status',
        ttl: 'ttl',
        reference: 'reference',
        act: 'act',
        eventInfo: 'eventInfo',
        updateMemberIds: 'updateMemberIds',
      },
      required: ['msgId', 'fromUid', 'sentAt'],
    },
    // Surveyed 28/09/2026 (docs/04-ky-thuat/zalo-web/zalo-web-feature-map.md §8): reactions, labels and read state.
    reactions: {
      dbPrefix: 'r_db_',
      store: 'reaction',
      fields: {
        msgId: 'rMsgId',
        cliMsgId: 'rClientMsgId',
        threadId: 'idTo',
        reactions: 'reactions',
        currentIcon: 'currentIcon',
        lastSender: 'lastSender',
        lastUpdate: 'lastUpdate',
      },
      required: ['msgId', 'threadId'],
    },
    labels: {
      dbPrefix: 'zdb_',
      store: 'label',
      fields: {
        labelId: 'id',
        name: 'text',
        color: 'color',
        emoji: 'emoji',
        conversationIds: 'conversations',
        createdAt: 'createTime',
      },
      required: ['labelId'],
    },
    read_state: {
      dbPrefix: 'msginfo_',
      store: 'unreadInfo',
      fields: {
        threadId: 'userId',
        lastReadMsgId: 'mId',
        at: 'timestamp',
      },
      required: ['threadId'],
    },
  },
  dom: DEFAULT_DOM_SELECTORS,
};

/**
 * Adds to `spec` whatever `defaults` has and it lacks: whole streams, and
 * missing `fields` keys of existing streams. Never overrides a source path,
 * store or DOM selector the user approved. Returns what was added.
 */
export function mergeDefaultMapping(spec: FieldMappingSpec, defaults: FieldMappingSpec = DEFAULT_FIELD_MAPPING): { spec: FieldMappingSpec; added: string[] } {
  const added: string[] = [];
  const streams: Record<string, StreamMapping> = { ...(spec.streams as Record<string, StreamMapping>) };
  for (const [name, def] of Object.entries(defaults.streams) as [string, StreamMapping | undefined][]) {
    if (!def) continue;
    const cur = streams[name];
    if (!cur) {
      streams[name] = def;
      added.push(name);
      continue;
    }
    const fields = { ...cur.fields };
    for (const [k, v] of Object.entries(def.fields)) {
      if (!(k in fields)) {
        fields[k] = v;
        added.push(`${name}.${k}`);
      }
    }
    if (Object.keys(fields).length !== Object.keys(cur.fields).length) streams[name] = { ...cur, fields };
  }
  return { spec: { ...spec, streams: streams as FieldMappingSpec['streams'] }, added };
}

export interface MappingContext {
  /** Zalo uid of the account being synced. */
  uid: string;
  /** Known group ids of this account, used to tell group threads from 1-1 threads. */
  groupIds: ReadonlySet<string>;
}

export type MapResult =
  | { ok: true; item: Record<string, unknown> }
  | { ok: false; missing: string[] };

function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

const isBlank = (v: unknown) => v === undefined || v === null || v === '';

/** Uids Zalo Web uses for "me" in `fromUid` on outgoing messages. */
const SELF_UIDS = new Set(['0', '-1']);
/**
 * Zalo group ids are `g<digits>`; user ids are digits only. Recognising the
 * shape matters because `ctx.groupIds` only holds the groups read in the
 * current run: an incremental sync reads no group records, and group messages
 * were then filed under their sender (68% of messages, found 28/09/2026).
 */
const GROUP_ID = /^g\d+$/;

/**
 * Zalo msgType of a recalled message (chat.undo). The record keeps its msgId and
 * turns into this type, so the API keeps content captured before the recall and
 * flags the message `recalled` (owner decision 2026-09-28).
 */
export const RECALL_MSG_TYPE = '20';
export const RECALL_PLACEHOLDER_TEXT = '[Đã thu hồi]';

/** Zalo msgType → stored text for messages whose bubble has no capturable content. */
export const PLACEHOLDER_TEXT_BY_MSG_TYPE: Readonly<Record<string, string>> = {
  [RECALL_MSG_TYPE]: RECALL_PLACEHOLDER_TEXT,
  '4': '[Sticker]',
  '7': '[GIF]',
};

/**
 * Maps one raw IndexedDB record to an ingest item for `stream`.
 * The result still has to pass the zod item schema; this only renames fields,
 * derives a few values and attaches a secret-free copy of the record as `raw`.
 */
export function mapRecord(
  stream: Stream,
  mapping: StreamMapping,
  record: unknown,
  ctx: MappingContext,
): MapResult {
  const item: Record<string, unknown> = {};
  for (const [target, source] of Object.entries(mapping.fields)) {
    const v = getPath(record, source);
    if (v !== undefined) item[target] = v;
  }

  switch (stream) {
    case 'contacts': {
      if (item.isFriend !== undefined) item.isFriend = Boolean(Number(item.isFriend));
      if ('oaInfo' in item) {
        item.isOA = !isBlank(item.oaInfo);
        delete item.oaInfo;
      }
      break;
    }
    case 'groups':
      break;
    case 'conversations': {
      // Zalo marks group threads with `isGroup` (0/1 or boolean).
      if ('isGroup' in item) {
        if (isBlank(item.type) && !isBlank(item.isGroup)) item.type = Number(item.isGroup) ? 'group' : 'user';
        delete item.isGroup;
      }
      if (isBlank(item.type) && !isBlank(item.threadId)) {
        item.type = ctx.groupIds.has(String(item.threadId)) ? 'group' : 'user';
      }
      // Zalo stores the pin as a flag or a pin timestamp; 0 / empty = not pinned.
      if ('pinned' in item) item.pinned = !isBlank(item.pinned) && item.pinned !== false && Number(item.pinned) !== 0;
      break;
    }
    case 'messages': {
      const body = item.body;
      delete item.body;
      if (typeof body === 'string') item.text = body;
      else if (body !== undefined && body !== null) item.content = stripSensitive(body);
      if (isBlank(item.threadId)) {
        const from = isBlank(item.fromUid) ? '' : String(item.fromUid);
        const to = isBlank(item.toUid) ? '' : String(item.toUid);
        // Group messages are addressed to the group; 1-1 messages to the peer or to me.
        if (to && (ctx.groupIds.has(to) || GROUP_ID.test(to))) item.threadId = to;
        else if (SELF_UIDS.has(from) || from === ctx.uid) item.threadId = to || undefined;
        else item.threadId = from || undefined;
      }
      if (item.msgType !== undefined && item.msgType !== null) item.msgType = String(item.msgType);
      if (item.originMsgType !== undefined && item.originMsgType !== null) {
        item.originMsgType = String(item.originMsgType);
      }
      if (item.quote !== undefined) item.quote = stripSensitive(item.quote);
      if (item.status !== undefined && item.status !== null) item.status = Number(item.status);
      if (item.ttl !== undefined && item.ttl !== null) item.ttl = Number(item.ttl);
      // Forwarded messages carry `reference.data.fwLvl` (forward level); the raw reference stays in `raw`.
      const ref = item.reference as { data?: { fwLvl?: unknown } } | undefined;
      delete item.reference;
      if (ref && typeof ref === 'object' && Number(ref.data?.fwLvl) > 0) item.forwarded = true;
      // Group system events (member added/left, rename…): `act` names the event.
      const act = item.act;
      const eventInfo = item.eventInfo as { source?: { id?: unknown } } | undefined;
      const memberIds = item.updateMemberIds;
      delete item.act;
      delete item.eventInfo;
      delete item.updateMemberIds;
      if (typeof act === 'string' && act) {
        const ev: Record<string, unknown> = { act: act.slice(0, 100) };
        const actor = eventInfo?.source?.id;
        if (actor !== undefined && actor !== null && actor !== '') ev.actorId = String(actor);
        if (Array.isArray(memberIds)) ev.memberIds = memberIds.filter((m) => m !== null && m !== undefined).map(String).slice(0, 500);
        item.systemEvent = ev;
      }
      break;
    }
    case 'reactions': {
      // `reactions` is { [reactorUid]: { [iconId]: count } }; keep it as is, but only numeric counts.
      const r = item.reactions;
      if (r && typeof r === 'object' && !Array.isArray(r)) {
        const clean: Record<string, Record<string, number>> = {};
        for (const [who, icons] of Object.entries(r as Record<string, unknown>)) {
          if (!icons || typeof icons !== 'object') continue;
          const inner: Record<string, number> = {};
          for (const [icon, n] of Object.entries(icons as Record<string, unknown>)) {
            if (Number.isFinite(Number(n))) inner[String(icon)] = Number(n);
          }
          clean[String(who)] = inner;
        }
        item.reactions = clean;
      } else delete item.reactions;
      if (item.cliMsgId !== undefined && item.cliMsgId !== null) item.cliMsgId = String(item.cliMsgId);
      break;
    }
    case 'labels': {
      if (item.labelId !== undefined && item.labelId !== null) item.labelId = String(item.labelId);
      if (Array.isArray(item.conversationIds)) {
        item.conversationIds = item.conversationIds.filter((c) => c !== null && c !== undefined).map(String);
      } else delete item.conversationIds;
      break;
    }
    case 'read_state':
      if (item.lastReadMsgId !== undefined && item.lastReadMsgId !== null) item.lastReadMsgId = String(item.lastReadMsgId);
      break;
  }

  // Encrypted records are ingested as metadata only: drop every ciphertext
  // field and mark the item so the API stores no ciphertext. Content (message
  // text, contact names) is filled later from the DOM. We never decrypt.
  const encrypted = isEncryptedRecord(record);
  if (encrypted) {
    for (const f of ENCRYPTED_CONTENT_FIELDS[stream]) delete item[f];
    item.encrypted = true;
    if (stream === 'messages') item.contentStatus = 'pending';
  } else if (stream === 'messages') {
    item.contentStatus = 'complete';
  }
  // These types render an empty bubble (nothing for the DOM reader to capture),
  // so a fixed placeholder completes them instead of leaving them pending.
  if (stream === 'messages' && typeof item.msgType === 'string' && item.msgType in PLACEHOLDER_TEXT_BY_MSG_TYPE) {
    item.text = PLACEHOLDER_TEXT_BY_MSG_TYPE[item.msgType];
    item.contentStatus = 'complete';
  }

  const missing = mapping.required.filter((f) => isBlank(item[f]));
  if (stream === 'messages' && isBlank(item.threadId)) missing.push('threadId');
  if (missing.length) return { ok: false, missing };

  // Drop nulls so the upsert never overwrites known values with nothing.
  for (const k of Object.keys(item)) if (item[k] === undefined) delete item[k];
  const safe = stripSensitive(record as Record<string, unknown>);
  item.raw = encrypted ? stripEncryptedValues(safe) : safe;
  return { ok: true, item };
}
