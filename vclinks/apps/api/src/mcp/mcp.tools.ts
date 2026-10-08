import { ForbiddenException, Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  MAX_BATCH_SIZE,
  TOKEN_TEXT,
  channelSchema,
  fieldMappingSpecSchema,
  registerAccountSchema,
  streamSchema,
  maskContactsInText,
  maskPhone,
  uidSchema,
  type Stream,
} from '@vclinks/shared';
import { z } from 'zod';
import { AttachmentsService } from '../attachments/attachments.service';
import { AccountsService } from '../accounts/accounts.service';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { C, DbService } from '../db/db.service';
import { IngestService } from '../ingest/ingest.service';
import { MappingService } from '../mapping/mapping.service';
import { OutboxService } from '../outbox/outbox.service';

export type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

/** Tool results are compact JSON; never echo ingested data back. */
export async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const out = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(out) }] };
  } catch (e) {
    const err = e as { response?: { message?: unknown }; message?: string };
    const message = err.response?.message ?? err.message ?? 'error';
    return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
  }
}

const INGEST_TOOLS: { stream: Stream; name: string; what: string }[] = [
  { stream: 'contacts', name: 'ingest_contacts', what: 'danh bạ (contact items: userId, displayName, ...)' },
  { stream: 'groups', name: 'ingest_groups', what: 'nhóm (group items: groupId, name, memberIds, ...)' },
  { stream: 'conversations', name: 'ingest_conversations', what: 'hội thoại (conversation items: threadId, type, ...)' },
  { stream: 'messages', name: 'ingest_messages', what: 'tin nhắn (message items: msgId, threadId, fromUid, sentAt, text, ...)' },
];

/** Builds a per-request MCP server bound to the calling principal. */
@Injectable()
export class McpToolsFactory {
  constructor(
    private readonly accounts: AccountsService,
    private readonly ingest: IngestService,
    private readonly mapping: MappingService,
    private readonly outbox: OutboxService,
    private readonly db: DbService,
    private readonly attachments: AttachmentsService,
  ) {}

  /** Which tools a token kind sees (M1b-06, 01 §2.7). Tokens without a kind keep every sync tool. */
  private allowed(principal: Principal, name: string): boolean {
    const kind = principal.tokenKind;
    if (kind === 'mcp_user') return name === 'search_messages' || name === 'get_contact_profile';
    if (name === 'search_messages' || name === 'get_contact_profile') return false;
    if (kind === 'agent') return name === 'list_pending_suggestions' || name === 'mark_sent';
    if (kind === 'sync') return name !== 'list_pending_suggestions' && name !== 'mark_sent';
    return true;
  }

  create(principal: Principal): McpServer {
    const server = new McpServer({ name: 'vclinks', version: '0.1.0' });
    const actor = `mcp:${principal.name}`;
    const bound = principal.uids?.length ? new Set(principal.uids) : null;
    /** A token bound to nicks never touches another nick. */
    const own = (uid: string | undefined) => {
      if (bound && uid && !bound.has(uid)) throw new ForbiddenException(TOKEN_TEXT.deviceNotAssigned);
    };
    const registerAll = server.registerTool.bind(server);
    // Tools the token kind may not use are removed right after registration.
    const reg = ((name: string, cfg: unknown, cb: unknown) => {
      const t = (registerAll as (...a: unknown[]) => { remove(): void })(name, cfg, cb);
      if (!this.allowed(principal, name)) t.remove();
      return t;
    }) as unknown as typeof server.registerTool;

    reg(
      'register_account',
      {
        description:
          'Khai báo (hoặc đổi nhãn) một tài khoản theo uid. uid có tiền tố theo kênh: không tiền tố = Zalo cá nhân, fb_ = Facebook cá nhân, zoa_ = Zalo OA, fbp_ = Fanpage.',
        inputSchema: {
          uid: uidSchema,
          label: z.string().min(1).max(200),
          ownerName: z.string().max(200).optional(),
          channel: channelSchema.optional(),
        },
      },
      (args) =>
        run(async () => {
          own(args.uid);
          return this.accounts.register(parseOr400(registerAccountSchema, args), actor, true);
        }),
    );

    reg(
      'get_checkpoint',
      {
        description:
          'Mốc đồng bộ đã lưu của một stream (epoch ms của sentAt / lastActionTime / lastMsgAt; null = chưa có hoặc stream không có cursor).',
        inputSchema: { uid: uidSchema, stream: streamSchema },
      },
      ({ uid, stream }) =>
        run(async () => {
          own(uid);
          return this.ingest.getCheckpoint(uid, stream);
        }),
    );

    reg(
      'get_sync_status',
      {
        description:
          'Trạng thái đồng bộ theo tài khoản: số bản ghi IndexedDB (extension báo) so với số bản ghi trong DB, checkpoint, số drift đang mở.',
        inputSchema: { uid: uidSchema.optional() },
      },
      ({ uid }) =>
        run(async () => {
          own(uid);
          return this.accounts.status(uid);
        }),
    );

    reg(
      'get_field_mapping',
      {
        description:
          'Bảng ánh xạ trường IndexedDB → VClinks đang áp dụng, kèm các drift (lệch cấu trúc) đang mở do extension báo. Dùng trước khi đề xuất bản mới.',
        inputSchema: {},
      },
      () =>
        run(async () => ({
          active: await this.mapping.active(),
          openDrifts: await this.mapping.listDrifts('open'),
        })),
    );

    reg(
      'propose_field_mapping',
      {
        description:
          'Đề xuất bảng ánh xạ trường mới sau khi khảo sát IndexedDB của Zalo Web, và/hoặc selector DOM mới (`spec.dom`) khi Zalo đổi giao diện (drift kind "dom_selectors"). Bỏ trống `dom` để giữ selector đang áp dụng. Bản đề xuất ở trạng thái "proposed" và chỉ có hiệu lực khi người dùng duyệt trên Dashboard; extension tự áp dụng, không cần build lại. Chỉ khai báo tên store/trường/selector, không bao giờ trỏ tới store e2ee_* hay trường token.',
        inputSchema: { spec: fieldMappingSpecSchema, note: z.string().max(2000).optional() },
      },
      ({ spec, note }) =>
        run(async () => {
          const r = await this.mapping.propose(spec, note, actor);
          return { id: r.id, version: r.version, status: r.status };
        }),
    );

    for (const t of INGEST_TOOLS) {
      reg(
        t.name,
        {
          description: `(Dự phòng — kênh chính là VClinks Extension) Upsert tối đa ${MAX_BATCH_SIZE} ${t.what}. Idempotent. Trả {accepted, updated, unchanged, rejected[], checkpoint}. Item chứa trường nhạy cảm (e2ee_*, token, cookie, password, otp) bị từ chối.`,
          inputSchema: {
            uid: uidSchema,
            items: z.array(z.record(z.unknown())).min(1).max(MAX_BATCH_SIZE),
          },
        },
        ({ uid, items }) =>
          run(async () => {
            own(uid);
            return this.ingest.ingest(t.stream, uid, items);
          }),
      );
    }

    reg(
      'list_pending_suggestions',
      {
        description:
          'Tin đã được người dùng duyệt trên Dashboard (có approvedBy + approvedAt), chờ gửi, cũ nhất trước. Mỗi item có {id, uid, threadId, text}. Nên gọi với claim=true: nhận nguyên tử đúng 1 tin (approved → sending) để extension không gửi trùng; chỉ gõ và gửi tin đã nhận, rồi gọi mark_sent. Không bao giờ gửi tin không có trong danh sách này. Khi bật "Cho phép gửi tin từ Dashboard" trên extension, extension tự gửi; không cần Claude gửi.',
        inputSchema: {
          uid: uidSchema.optional(),
          limit: z.number().int().min(1).max(20).default(5),
          claim: z.boolean().default(false),
        },
      },
      ({ uid, limit, claim }) =>
        run(async () => {
          own(uid);
          // A token bound to several nicks lists them one by one (pending takes one uid).
          const scopeOf = uid ? [uid] : bound ? [...bound] : [undefined];
          const gather = async (n: number) => (await Promise.all(scopeOf.map((u) => this.outbox.pending(u, n)))).flat().slice(0, n);
          if (!claim) return { items: await gather(limit) };
          // Try the oldest few in order; another sender may win a race.
          for (const it of await gather(5)) {
            try {
              return { items: [await this.outbox.claim(it.id, actor)] };
            } catch {
              /* claimed by someone else: try the next one */
            }
          }
          return { items: [] };
        }),
    );

    reg(
      'mark_sent',
      {
        description:
          'Ghi nhận đã gửi một tin đã duyệt (lấy từ list_pending_suggestions) vào audit log. Chỉ áp dụng cho tin ở trạng thái approved/sending và có approvedBy + approvedAt; tin khác bị từ chối (409).',
        inputSchema: {
          suggestionId: z.string().min(1).max(64),
          sentAt: z.string().datetime({ offset: true }).optional(),
          zaloMsgId: z.string().min(1).max(128).optional(),
        },
      },
      ({ suggestionId, sentAt, zaloMsgId }) =>
        run(async () => {
          if (bound) {
            const row = await this.db.col<{ _id: unknown; uid?: string }>(C.suggestions).findOne({ _id: suggestionId as never }, { projection: { uid: 1 } });
            if (row?.uid) own(row.uid);
          }
          const it = await this.outbox.markSent(suggestionId, sentAt, zaloMsgId, actor);
          return { id: it.id, status: it.status, sentAt: it.sentAt };
        }),
    );

    // Personal MCP token (01 §2.7): the owner's own view. The Dashboard data scope of the owner already
    // limits every query of this request (AuthzGuard); phones are masked unless the owner may see them.
    reg(
      'search_messages',
      {
        description: 'Tìm tin nhắn theo từ khóa trong các hội thoại bạn được xem (tối đa 20 kết quả, mới nhất trước). Không bao giờ vượt quá quyền của chủ token.',
        inputSchema: { query: z.string().trim().min(2).max(200), threadId: z.string().max(100).optional(), limit: z.number().int().min(1).max(20).default(10) },
      },
      ({ query, threadId, limit }) =>
        run(async () => {
          const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const rows = await this.db
            .col<{ uid: string; threadId: string; msgId: string; senderName?: string; text?: string; sentAt: Date }>(C.messages)
            .find({ text: rx, ...(threadId ? { threadId } : {}) }, { projection: { uid: 1, threadId: 1, msgId: 1, senderName: 1, text: 1, sentAt: 1 } })
            .sort({ sentAt: -1 })
            .limit(limit)
            .toArray();
          await this.db.audit(actor, 'mcp.call', 'search_messages', { onBehalfOf: principal.userId, userId: principal.userId, tokenId: principal.tokenId, returned: rows.length, targets: [...new Set(rows.map((r) => `${r.uid}:${r.threadId}`))] });
          return { items: rows.map((r) => ({ uid: r.uid, threadId: r.threadId, msgId: r.msgId, sender: r.senderName ?? '', text: maskContactsInText((r.text ?? '').slice(0, 300)).text, sentAt: r.sentAt })) };
        }),
    );

    reg(
      'get_contact_profile',
      {
        description: 'Hồ sơ một liên hệ trong phạm vi bạn được xem: tên, vai trò, division, email tổ chức, ghi chú. SĐT luôn bị che.',
        inputSchema: { uid: uidSchema, userId: z.string().min(1).max(100) },
      },
      ({ uid, userId }) =>
        run(async () => {
          const c = await this.db
            .col<{ _id: string; displayName?: string; phone?: string; role?: string; division?: string; orgEmail?: string; notes?: string }>(C.contacts)
            .findOne({ _id: `${uid}:${userId}` });
          await this.db.audit(actor, 'mcp.call', 'get_contact_profile', { onBehalfOf: principal.userId, userId: principal.userId, tokenId: principal.tokenId, found: !!c, targets: c ? [`${uid}:${userId}`] : [] });
          if (!c) return { error: 'Không tìm thấy liên hệ trong phạm vi của bạn' };
          // AI never sees a full phone number, whatever the owner's own right is.
          return { uid, userId, displayName: c.displayName, phone: maskPhone(c.phone), role: c.role, division: c.division, orgEmail: c.orgEmail, notes: c.notes };
        }),
    );

    reg(
      'create_upload_url',
      {
        description:
          'Xin URL tải tệp (ảnh, tệp, ghi âm, video) của một tin đã có trong DB lên kho công ty. Trả {uploadId, url, expiresAt}; URL hết hạn sau 15 phút. Sau đó PUT nhị phân thô (Content-Type bất kỳ không phải JSON, ví dụ application/octet-stream) vào url ngoài MCP, rồi gọi confirm_upload. File nhị phân không đi qua MCP.',
        inputSchema: {
          uid: uidSchema,
          messageId: z.string().min(1).max(300).describe('_id của tin nhắn: `${uid}:${msgId}`'),
          fileName: z.string().min(1).max(255),
          mime: z.string().min(3).max(120),
          size: z.number().int().positive(),
        },
      },
      (args) =>
        run(async () => {
          own(args.uid);
          return this.attachments.createUploadUrl(args);
        }),
    );

    reg(
      'confirm_upload',
      {
        description:
          'Xác nhận đã PUT xong tệp: so sha256 (hex) với tệp kho đã nhận. Khớp thì tệp thành "đã lưu"; nếu là ghi âm thì tự xếp hàng chuyển chữ. Trả {id, status, transcript?}.',
        inputSchema: { uploadId: z.string().min(8).max(200), checksum: z.string().regex(/^[a-f0-9]{64}$/) },
      },
      (args) => run(async () => this.attachments.confirmUpload(args, own)),
    );

    return server;
  }
}
