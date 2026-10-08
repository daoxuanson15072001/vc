import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CHANNEL_INFO,
  NO_ACCESS_TEXT,
  QUOTE_MESSAGE_MAX,
  RESULTS_BY_KIND,
  RETURN_REASON_LABELS,
  SALES_QUOTE_STATUS_LABELS,
  WORKITEM_DEFAULTS,
  WORKITEM_KIND_LABELS,
  WORKITEM_OPEN_STATUSES,
  WORKITEM_QUEUES,
  channelOfUid,
  maskContactsInText,
  queueOfKind,
  workingMinutesBetween,
  workitemCode,
  workitemTransition,
  type AfterSendState,
  type AftersalesType,
  type OutboxItem,
  type OutboxSendSource,
  type PermissionKey,
  type ReturnReason,
  type SalesQuoteStatus,
  type WorkitemCounts,
  type WorkitemCreateInput,
  type WorkitemDetail,
  type WorkitemDraftInput,
  type WorkitemEvent,
  type WorkitemHistoryEntry,
  type WorkitemKind,
  type WorkitemMessageView,
  type WorkitemQueue,
  type WorkitemQueueConfig,
  type WorkitemQuoteView,
  type WorkitemResult,
  type WorkitemStatus,
  type WorkitemSummary,
} from '@vclinks/shared';
import { ObjectId, type Filter } from 'mongodb';
import { AttachmentsService } from '../attachments/attachments.service';
import { AuthzService } from '../authz/authz.service';
import { decide, type Subject, type Target } from '../authz/engine';
import { divisionOfAccount, slaConfigFor } from '../conversations/inbox-state';
import { C, DbService } from '../db/db.service';
import { runsBackgroundJobs } from '../db/role';
import { runAsTenant, runUnscoped } from '../db/tenant-context';
import { NotificationsService } from '../notifications/notifications.service';
import { OutboxDispatcher } from '../outbox/outbox.dispatcher';
import { OutboxService, type Approver } from '../outbox/outbox.service';
import { QuotesService } from '../quotes/quotes.service';
import { MessageVault } from '../security/message-vault';

/** Collections of this module (tenant-scoped). */
export const WI_C = { items: 'work_items', queues: 'workitem_queues', counters: 'workitem_counters' } as const;

export interface WorkitemDoc {
  _id: string;
  code: string;
  kind: WorkitemKind;
  queue: WorkitemQueue;
  status: WorkitemStatus;
  uid: string;
  threadId: string;
  divisionId: string | null;
  messageIds: string[];
  note: string;
  aftersalesType: AftersalesType | null;
  dueAt: Date | null;
  aiExtract: boolean;
  createdById: string;
  createdByName: string | null;
  assigneeId: string | null;
  /** Draft prepared by CSKH (the words that go to the customer). */
  message: string;
  quoteNo: string | null;
  quoteCustomerCode: string | null;
  quoteTotal: number | null;
  afterSend: AfterSendState | null;
  vendorDueAt: Date | null;
  returnCount: number;
  returnReasons: ReturnReason[];
  submittedAt: Date | null;
  submittedById: string | null;
  remindedAt: Date | null;
  escalatedAt: Date | null;
  returnAlertAt: Date | null;
  outboxId: string | null;
  sendFailedAt: Date | null;
  approvedById: string | null;
  approvedAt: Date | null;
  result: WorkitemResult | null;
  closedAt: Date | null;
  history: (Omit<WorkitemHistoryEntry, 'at'> & { at: Date })[];
  createdAt: Date;
  updatedAt: Date;
}

interface QueueDoc {
  _id: string;
  divisionId: string;
  queue: WorkitemQueue;
  members: string[];
  cursor: number;
  updatedBy?: string;
  updatedAt?: Date;
}

/** Thresholds still waiting for the owner (E7): environment, defaults from the spec (T-36 = 2, 10′, 20′). */
export function workitemConfig() {
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  return {
    maxReturns: n(process.env.WORKITEM_MAX_RETURNS, WORKITEM_DEFAULTS.maxReturns),
    remindMinutes: n(process.env.WORKITEM_REMIND_MIN, WORKITEM_DEFAULTS.remindMinutes),
    escalateMinutes: n(process.env.WORKITEM_ESCALATE_MIN, WORKITEM_DEFAULTS.escalateMinutes),
    /** "AI trích nhu cầu" (M1c-06) stays off until the owner turns it on (needs E8). */
    aiExtract: process.env.WORKITEM_AI_EXTRACT === '1',
  };
}

const SWEEP_MS = () => Number(process.env.WORKITEM_SWEEP_MS ?? 60_000);
const ERR_NOT_FOUND = 'Không tìm thấy phiếu hoặc bạn không có quyền xem.';
const ERR_STATE = (s: WorkitemStatus) => `Phiếu đang ở trạng thái "${s}", không làm được thao tác này.`;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const newId = () => `wi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * Phiếu báo giá / hậu mãi, CSKH soạn ⇄ NVKD duyệt (M1c-03; BA D9-01…D9-05, F9.15, BR20, BR21; 03 QT-SZ-13…15).
 *
 * §12 rules held here:
 * - The only path that sends is `approve`: the presser must have `workitem.approve` on the nick (holder or active
 *   "Trực nick") and pass `canSend`; the command is created by QuotesService.send (quote) or OutboxService.create
 *   (words only) with approvedBy / approvedAt of the presser. CSKH has no route, outbox call, MCP tool or extension
 *   path here.
 * - CSKH reads only the messages chosen into the item (CS `orders_only` stays closed), masked by the shared
 *   `maskContactsInText` unless the reader may see the customer's phone in full on that nick.
 * - Logs and audit hold ids, codes and reason codes; never message text, the draft or free notes.
 */
@Injectable()
export class WorkitemsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WorkitemsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private indexed = false;

  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    private readonly outbox: OutboxService,
    private readonly dispatcher: OutboxDispatcher,
    private readonly notifications: NotificationsService,
    private readonly quotes: QuotesService,
    @Optional() private readonly vault?: MessageVault,
    @Optional() private readonly attachments?: AttachmentsService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.WORKITEM_JOBS === 'off' || !runsBackgroundJobs()) return;
    this.timer = setInterval(() => void this.sweep(), SWEEP_MS());
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private get items() {
    return this.db.col<WorkitemDoc>(WI_C.items);
  }
  private get queues() {
    return this.db.col<QueueDoc>(WI_C.queues);
  }

  private async ensureIndexes() {
    if (this.indexed) return;
    await this.items.createIndexes([{ key: { status: 1, uid: 1 } }, { key: { uid: 1, threadId: 1, status: 1 } }, { key: { assigneeId: 1, status: 1 } }]);
    this.indexed = true;
  }

  // ---------------------------------------------------------------- permission helpers

  /** Engine target of an item: its conversation, plus TK (assignee) and SELF (creator). */
  private async targetOf(d: Pick<WorkitemDoc, 'uid' | 'threadId' | 'assigneeId' | 'createdById'>): Promise<Target> {
    const t = await this.authz.conversationTarget(d.uid, d.threadId);
    const csUnits = d.assigneeId ? await this.authz.unitsOf(d.assigneeId) : [];
    return {
      ...t,
      unitIds: [...new Set([...(t.unitIds ?? []), ...csUnits])],
      ticketAssigneeIds: d.assigneeId ? [d.assigneeId] : [],
      selfIds: [d.createdById],
    };
  }

  private allowed(u: Subject, key: PermissionKey, t: Target): boolean {
    return decide(u, key, t).allowed;
  }

  /** CSKH manager of the division (ticket.assign on a group he manages): sees and assigns unassigned items too. */
  private managesQueueOf(u: Subject, divisionId: string | null): boolean {
    if (!divisionId) return false;
    return u.roles.some((r) => r.isManager && r.divisionId === divisionId && (decide({ ...u, roles: [r] }, 'ticket.assign', { unitIds: [r.unitId], divisionId }).allowed));
  }

  private async canView(u: Subject, d: WorkitemDoc, t?: Target): Promise<boolean> {
    if (d.createdById === u.userId || d.assigneeId === u.userId) return true;
    const target = t ?? (await this.targetOf(d));
    for (const k of ['ticket.view', 'ticket.assign', 'workitem.approve', 'workitem.return'] as const) if (this.allowed(u, k, target)) return true;
    if (!d.assigneeId && this.managesQueueOf(u, d.divisionId)) return true;
    // A sales supervisor of the nick holder sees the item once it is escalated (MH-SZ-15 "khay của tổ").
    if (d.escalatedAt && (await this.authz.managersOver(d.uid)).includes(u.userId)) return true;
    return false;
  }

  private async load(id: string, u: Subject): Promise<{ d: WorkitemDoc; t: Target }> {
    const d = await this.items.findOne({ _id: id });
    if (!d) throw new NotFoundException(ERR_NOT_FOUND);
    const t = await this.targetOf(d);
    if (!(await this.canView(u, d, t))) throw new NotFoundException(ERR_NOT_FOUND);
    return { d, t };
  }

  /** Who approves now (PQ-119): the active "Trực nick" of the nick if any, else the nick holder. */
  async currentApprover(uid: string, now = new Date()): Promise<string | null> {
    const cover = await runUnscoped(() =>
      this.db
        .col<{ userId: string }>('access_grants')
        .find({ type: 'truc_thay', status: 'hieu_luc', targetType: 'channel', targetId: uid, from: { $lte: now }, to: { $gt: now } } as never)
        .sort({ from: -1 })
        .limit(1)
        .next(),
    );
    return cover?.userId ?? (await this.authz.holderOf(uid));
  }

  // ---------------------------------------------------------------- create

  /** "Chuyển CSKH soạn báo giá" / "Chuyển hậu mãi cho CSKH" (QT-SZ-13, QT-SZ-14). Nothing is sent to Zalo. */
  async create(input: WorkitemCreateInput, u: Subject | undefined, actor: Approver): Promise<WorkitemDetail> {
    await this.ensureIndexes();
    if (CHANNEL_INFO[channelOfUid(input.uid)].sendMode === 'api') {
      throw new BadRequestException('Phiếu CSKH soạn – NVKD duyệt chỉ dùng cho nick cá nhân. Trên kênh chính thức CSKH trả lời thẳng.');
    }
    if (u) {
      const t = await this.authz.conversationTarget(input.uid, input.threadId);
      if (!this.allowed(u, 'ticket.create', t)) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('ticket.create'));
    }
    // The chosen messages must all belong to this conversation (read in the caller's own data scope).
    const found = await this.db
      .col<{ _id: string }>(C.messages)
      .find({ _id: { $in: input.messageIds as never[] }, uid: input.uid, threadId: input.threadId } as never, { projection: { _id: 1 } })
      .toArray();
    if (found.length !== input.messageIds.length) throw new BadRequestException('Có tin đã chọn không thuộc hội thoại này.');
    const divisionId = await divisionOfAccount(this.db, input.uid);
    const queue = queueOfKind(input.kind);
    const assigneeId = await this.nextAssignee(divisionId, queue);
    const seq = await this.db
      .col<{ _id: string; n: number }>(WI_C.counters)
      .findOneAndUpdate({ _id: 'workitem' }, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' });
    const now = new Date();
    const doc: WorkitemDoc = {
      _id: newId(),
      code: workitemCode(seq?.n ?? 1),
      kind: input.kind,
      queue,
      status: 'moi',
      uid: input.uid,
      threadId: input.threadId,
      divisionId,
      messageIds: input.messageIds,
      note: input.note,
      aftersalesType: input.kind === 'hau_mai' ? (input.aftersalesType ?? 'khac') : null,
      dueAt: input.dueAt ?? (input.kind === 'bao_gia' ? new Date(now.getTime() + 90 * 60_000) : null),
      aiExtract: input.aiExtract,
      createdById: actor.id,
      createdByName: actor.name,
      assigneeId,
      message: '',
      quoteNo: null,
      quoteCustomerCode: null,
      quoteTotal: null,
      afterSend: null,
      vendorDueAt: null,
      returnCount: 0,
      returnReasons: [],
      submittedAt: null,
      submittedById: null,
      remindedAt: null,
      escalatedAt: null,
      returnAlertAt: null,
      outboxId: null,
      sendFailedAt: null,
      approvedById: null,
      approvedAt: null,
      result: null,
      closedAt: null,
      history: [{ at: now, byId: actor.id, byName: actor.name, event: 'create', from: null, to: 'moi' }],
      createdAt: now,
      updatedAt: now,
    };
    await this.items.insertOne(doc);
    await this.db.audit(actor.id, 'workitem.create', doc._id, { code: doc.code, kind: doc.kind, uid: doc.uid, threadId: doc.threadId, messages: doc.messageIds.length, assigneeId });
    const kind = WORKITEM_KIND_LABELS[doc.kind].toLowerCase();
    if (assigneeId) await this.notifications.notify([assigneeId], 'workitem', `Cần làm ngay: phiếu ${kind} ${doc.code} vừa vào hàng việc của bạn.`, this.link(doc));
    else await this.notifyQueueManagers(doc, `Phiếu ${kind} ${doc.code} chưa có người nhận (hàng việc chưa cấu hình). Hãy giao người xử lý.`);
    return this.detail(doc, u);
  }

  /** Round robin among the members of the division's queue (BR22). Null when nobody is configured. */
  private async nextAssignee(divisionId: string | null, queue: WorkitemQueue): Promise<string | null> {
    if (!divisionId) return null;
    const q = await this.queues.findOneAndUpdate({ _id: `${divisionId}:${queue}` }, { $inc: { cursor: 1 } }, { returnDocument: 'after' });
    if (!q?.members.length) return null;
    const active = new Set(
      (await this.db.col<{ _id: string; status?: string }>(C.users).find({ _id: { $in: q.members as never[] }, status: 'hoat_dong' } as never, { projection: { _id: 1 } }).toArray()).map((x) => x._id),
    );
    const members = q.members.filter((m) => active.has(m));
    if (!members.length) return null;
    return members[(q.cursor - 1) % members.length] ?? null;
  }

  private link(d: Pick<WorkitemDoc, '_id' | 'uid' | 'threadId'>): string {
    return `/workitems?id=${encodeURIComponent(d._id)}`;
  }

  private async notifyQueueManagers(d: WorkitemDoc, title: string) {
    const rows = await this.db
      .col<{ userId: string; orgUnitId: string; roleKey: string }>('role_assignments')
      .find({ roleKey: 'cskh' } as never)
      .toArray();
    const managers: string[] = [];
    for (const r of rows) {
      const unit = await this.db.col<{ _id: string; managerUserId?: string | null; divisionId?: string | null }>('org_units').findOne({ _id: r.orgUnitId } as never);
      if (unit?.managerUserId === r.userId && unit.divisionId === d.divisionId) managers.push(r.userId);
    }
    await this.notifications.notify(managers, 'workitem', title, this.link(d));
  }

  // ---------------------------------------------------------------- transitions

  private async move(
    d: WorkitemDoc,
    event: WorkitemEvent,
    by: { id: string | null; name: string | null },
    set: Partial<WorkitemDoc> = {},
    extra: Partial<WorkitemHistoryEntry> = {},
    to?: WorkitemStatus,
  ): Promise<WorkitemDoc> {
    const next = workitemTransition(d.status, event, to);
    if (!next) throw new ConflictException(ERR_STATE(d.status));
    const now = new Date();
    const entry = { at: now, byId: by.id, byName: by.name, event, from: d.status, to: next, ...extra };
    const res = await this.items.findOneAndUpdate(
      { _id: d._id, status: d.status },
      { $set: { ...set, status: next, updatedAt: now }, $push: { history: entry } } as never,
      { returnDocument: 'after' },
    );
    if (!res) throw new ConflictException('Phiếu vừa được người khác cập nhật. Tải lại rồi thử lại.');
    await this.db.audit(by.id ?? 'he-thong', `workitem.${event}`, d._id, { code: d.code, from: d.status, to: next, ...(extra.reason ? { reason: extra.reason } : {}), ...(extra.result ? { result: extra.result } : {}) });
    return res;
  }

  private assertCs(u: Subject | undefined, key: PermissionKey, t: Target) {
    if (u && !this.allowed(u, key, t)) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission(key));
  }

  /** CSKH "Nhận / Bắt đầu xử lý". */
  async start(id: string, u: Subject, by: Approver) {
    const { d, t } = await this.load(id, u);
    this.assertCs(u, 'ticket.resolve', t);
    return this.detail(await this.move(d, 'start', by), u);
  }

  /** CSKH edits the draft: words, attached approved quote (BR16, BR21), the state after sending, vendor date. */
  async editDraft(id: string, input: WorkitemDraftInput, u: Subject, by: Approver) {
    const { d, t } = await this.load(id, u);
    this.assertCs(u, 'ticket.resolve', t);
    if (!['moi', 'cskh_xu_ly', 'tra_lai'].includes(d.status)) throw new ConflictException(ERR_STATE(d.status));
    const set: Partial<WorkitemDoc> = {};
    if (input.message !== undefined) set.message = input.message;
    if (input.afterSend !== undefined) {
      if (d.kind !== 'hau_mai') throw new BadRequestException('Chỉ phiếu hậu mãi chọn bước sau khi gửi.');
      set.afterSend = input.afterSend;
    }
    if (input.vendorDueAt !== undefined) set.vendorDueAt = input.vendorDueAt;
    if (input.quoteNo !== undefined) {
      if (input.quoteNo === null) Object.assign(set, { quoteNo: null, quoteCustomerCode: null, quoteTotal: null });
      else {
        this.assertCs(u, 'quote.view', t);
        // Only an approved, still valid quote of this customer can be attached (04 MH-OA-20 #6, BR16, BR17).
        const list = await runUnscoped(() => this.quotes.list(d.uid, d.threadId, undefined));
        const q = list.items.find((x) => x.no === input.quoteNo);
        if (!list.customerCode) throw new UnprocessableEntityException('Khách chưa có mã KH VCsales. Đã báo Sale admin.');
        if (!q || q.block) throw new UnprocessableEntityException(q?.block?.message ?? `Không tìm thấy báo giá ${input.quoteNo} đã duyệt, còn hiệu lực của khách này.`);
        Object.assign(set, { quoteNo: q.no, quoteCustomerCode: list.customerCode, quoteTotal: q.total });
      }
    }
    const now = new Date();
    const res = await this.items.findOneAndUpdate(
      { _id: d._id, status: d.status },
      { $set: { ...set, updatedAt: now }, $push: { history: { at: now, byId: by.id, byName: by.name, event: 'draft', from: d.status, to: d.status } } } as never,
      { returnDocument: 'after' },
    );
    if (!res) throw new ConflictException('Phiếu vừa được người khác cập nhật. Tải lại rồi thử lại.');
    await this.db.audit(by.id, 'workitem.draft', d._id, { code: d.code, fields: Object.keys(set) });
    return this.detail(res, u);
  }

  /** "Chuyển NVKD duyệt" (CSKH, workitem.submit TK). Nothing is sent: the approver is told. */
  async submit(id: string, u: Subject, by: Approver) {
    const { d, t } = await this.load(id, u);
    this.assertCs(u, 'workitem.submit', t);
    if (!d.message.trim()) throw new UnprocessableEntityException('Chưa có lời nhắn gửi khách.');
    if (d.kind === 'bao_gia') {
      if (!d.quoteNo) throw new UnprocessableEntityException('Chưa gắn báo giá đã duyệt.');
      if (d.message.length > QUOTE_MESSAGE_MAX) throw new UnprocessableEntityException(`Lời nhắn báo giá tối đa ${QUOTE_MESSAGE_MAX} ký tự.`);
    }
    if (d.afterSend === 'cho_hang' && !d.vendorDueAt) throw new UnprocessableEntityException('Nhập hạn hẹn.');
    const approverId = await this.currentApprover(d.uid);
    const res = await this.move(d, 'submit', by, { submittedAt: new Date(), submittedById: by.id, remindedAt: null, escalatedAt: null, sendFailedAt: null });
    const what = d.kind === 'bao_gia' ? `báo giá ${d.quoteNo}` : 'câu trả lời hậu mãi';
    await this.notifications.notify([approverId], 'workitem', `Cần làm ngay: CSKH ${by.name ?? ''} đã chuẩn bị ${what} (phiếu ${d.code}). Xem và gửi.`, this.link(d));
    return this.detail(res, u);
  }

  /** "Trả lại" (workitem.return): a reason is mandatory; past T-36 the supervisors are told (PQ-120). */
  async return(id: string, reason: ReturnReason, note: string, u: Subject, by: Approver) {
    const { d, t } = await this.load(id, u);
    this.assertCs(u, 'workitem.return', t);
    const count = d.returnCount + 1;
    const cfg = workitemConfig();
    const res = await this.move(d, 'return', by, { returnCount: count, returnReasons: [...d.returnReasons, reason] }, { reason, ...(note ? { note } : {}) });
    await this.notifications.notify([d.assigneeId], 'workitem', `Cần làm ngay: phiếu ${d.code} bị trả lại: ${RETURN_REASON_LABELS[reason]}.`, this.link(d));
    if (count > cfg.maxReturns) {
      const salesSup = await this.authz.supervisorOf(by.id);
      const csSup = d.assigneeId ? await this.authz.supervisorOf(d.assigneeId) : null;
      await this.notifications.notify(
        [salesSup, csSup].filter((x) => x !== by.id),
        'workitem_alert',
        `Phiếu ${d.code} đã bị trả lại ${count} lần (quá ${cfg.maxReturns}). Lý do: ${res.returnReasons.map((r) => RETURN_REASON_LABELS[r]).join(', ')}.`,
        this.link(d),
      );
      await this.items.updateOne({ _id: d._id }, { $set: { returnAlertAt: new Date(), escalatedAt: d.escalatedAt ?? new Date() } });
    }
    // PQ-120: the approver is not the owner of the customer (wrong nick) → the owner gets a "Để biết".
    const owners = (t.responsibleIds ?? []).filter((o) => o !== by.id);
    if (owners.length) await this.notifications.notify(owners, 'workitem', `Để biết: phiếu ${d.code} của khách bạn phụ trách vừa bị trả lại CSKH.`, this.link(d));
    return this.detail((await this.items.findOne({ _id: d._id })) ?? res, u);
  }

  /** "Tôi tự trả lời" (QT-SZ-15 3c): closes the item, result "NVKD tự xử lý", CSKH is told. */
  async selfReply(id: string, note: string, u: Subject, by: Approver) {
    const { d, t } = await this.load(id, u);
    this.assertCs(u, 'workitem.return', t);
    const res = await this.move(d, 'self_reply', by, { result: 'nvkd_tu_xu_ly', closedAt: new Date() }, { result: 'nvkd_tu_xu_ly', ...(note ? { note } : {}) });
    await this.notifications.notify([d.assigneeId], 'workitem', `Để biết: phiếu ${d.code} đã đóng, NVKD tự trả lời khách.`, this.link(d));
    return this.detail(res, u);
  }

  /**
   * "Duyệt & gửi" (BR20, PQ-119): the press IS the approval of the send. Only the nick holder / "Trực nick"
   * (workitem.approve NICK) who may send on the nick right now (canSend: nick safe). A quote goes through
   * QuotesService.send (BR16 re-read, send_quote command, QuoteGate again at claim); words alone through
   * OutboxService.create. approvedBy / approvedAt = the presser.
   */
  async approve(id: string, message: string, quoteVersion: string | undefined, u: Subject | undefined, by: Approver) {
    if (!u) throw new ForbiddenException('Duyệt & gửi cần người đăng nhập.');
    const { d, t } = await this.load(id, u);
    if (!this.allowed(u, 'workitem.approve', t)) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('workitem.approve'));
    const send = await this.authz.canSend(u, d.uid, d.threadId);
    if (!send.allowed) throw new ForbiddenException(send.via === 'nick_chua_an_toan' ? 'Nick đang "Chưa an toàn", chưa gửi được.' : NO_ACCESS_TEXT.api);
    if (!workitemTransition(d.status, 'approve')) throw new ConflictException(ERR_STATE(d.status));
    const mode = await this.authz.sendModeOf(u, d.uid);
    let onBehalf: { source: OutboxSendSource; holderId: string | null; holderName: string | null } | undefined;
    if (mode.source) {
      const names = await this.authz.userNames([mode.holderId]);
      onBehalf = { source: mode.source, holderId: mode.holderId, holderName: mode.holderId ? (names.get(mode.holderId) ?? null) : null };
    }
    // Claim the item first so two presses never queue two commands.
    const claimed = await this.items.findOneAndUpdate(
      { _id: d._id, status: 'cho_nvkd_duyet', outboxId: null },
      { $set: { outboxId: 'pending', updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!claimed) throw new ConflictException('Phiếu vừa được người khác cập nhật. Tải lại rồi thử lại.');
    let item: OutboxItem;
    try {
      if (d.quoteNo) {
        if (message.length > QUOTE_MESSAGE_MAX) throw new UnprocessableEntityException(`Lời nhắn báo giá tối đa ${QUOTE_MESSAGE_MAX} ký tự.`);
        const version = quoteVersion ?? (await this.quoteView(d))?.version ?? undefined;
        if (!version) throw new UnprocessableEntityException(`Không đọc được báo giá ${d.quoteNo} trên VCsales. Thử lại sau.`);
        ({ item } = await this.quotes.send({ uid: d.uid, threadId: d.threadId, no: d.quoteNo, form: 'pdf', message, version }, by, u, onBehalf));
      } else {
        item = await this.outbox.create({ uid: d.uid, threadId: d.threadId, text: message }, by, onBehalf);
      }
    } catch (e) {
      await this.items.updateOne({ _id: d._id, outboxId: 'pending' }, { $set: { outboxId: null } });
      throw e;
    }
    this.dispatcher.kick(item);
    const edited = message !== d.message;
    const res = await this.move({ ...d, outboxId: 'pending' }, 'approve', by, { outboxId: item.id, message, approvedById: by.id, approvedAt: new Date() }, edited ? { note: 'Đã sửa lời nhắn' } : {});
    await this.notifications.notify([d.assigneeId], 'workitem', `Để biết: phiếu ${d.code} đã được ${by.name ?? 'NVKD'} duyệt và gửi khách.`, this.link(d));
    return this.detail(res, u);
  }

  /** "Chờ hãng" with the appointment date (04 UAT-OA-169), after-sales only. */
  async waitVendor(id: string, vendorDueAt: Date, u: Subject, by: Approver) {
    const { d, t } = await this.load(id, u);
    this.assertCs(u, 'ticket.resolve', t);
    if (d.kind !== 'hau_mai') throw new BadRequestException('Chỉ phiếu hậu mãi có trạng thái Chờ hãng.');
    return this.detail(await this.move(d, 'wait_vendor', by, { vendorDueAt }), u);
  }

  async vendorBack(id: string, u: Subject, by: Approver) {
    const { d, t } = await this.load(id, u);
    this.assertCs(u, 'ticket.resolve', t);
    return this.detail(await this.move(d, 'vendor_back', by), u);
  }

  /** "Xong" with a mandatory result (D9-02). */
  async close(id: string, result: WorkitemResult, note: string, u: Subject, by: Approver) {
    const { d, t } = await this.load(id, u);
    this.assertCs(u, 'ticket.resolve', t);
    if (!RESULTS_BY_KIND[d.kind].includes(result)) throw new BadRequestException('Chọn kết quả.');
    const res = await this.move(d, 'close', by, { result, closedAt: new Date() }, { result, ...(note ? { note } : {}) });
    await this.notifications.notify([d.createdById], 'workitem', `Để biết: phiếu ${d.code} đã xong.`, this.link(d));
    return this.detail(res, u);
  }

  /** Giám sát CSKH chia lại phiếu (ticket.assign, PQ-121). */
  async assign(id: string, assigneeId: string, u: Subject, by: Approver) {
    const { d, t } = await this.load(id, u);
    if (!(this.allowed(u, 'ticket.assign', t) || this.managesQueueOf(u, d.divisionId))) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('ticket.assign'));
    if (d.status === 'xong') throw new ConflictException(ERR_STATE(d.status));
    const roles = await this.db.col<{ roleKey: string }>('role_assignments').countDocuments({ userId: assigneeId, roleKey: 'cskh' } as never, { limit: 1 });
    if (!roles) throw new BadRequestException('Người nhận phải là nhân viên CSKH.');
    const now = new Date();
    await this.items.updateOne(
      { _id: d._id },
      { $set: { assigneeId, updatedAt: now }, $push: { history: { at: now, byId: by.id, byName: by.name, event: 'assign', from: d.status, to: d.status } } } as never,
    );
    await this.db.audit(by.id, 'workitem.assign', d._id, { code: d.code, assigneeId });
    await this.notifications.notify([assigneeId], 'workitem', `Cần làm ngay: phiếu ${d.code} được giao cho bạn.`, this.link(d));
    return this.detail((await this.items.findOne({ _id: d._id }))!, u);
  }

  /**
   * Approved, still valid quotes of the item's customer, for "Gắn báo giá đã duyệt" (04 MH-OA-20 #6). CSKH may not
   * open the chat (orders_only closed), so this read goes through the item: quote.view on the item (TK), VCsales read live.
   */
  async quoteOptions(id: string, u: Subject): Promise<{ customerCode: string | null; createUrl: string | null; items: { no: string; total: number; validUntil: string | null; version: string }[]; error: string | null }> {
    const { d, t } = await this.load(id, u);
    this.assertCs(u, 'quote.view', t);
    const list = await runUnscoped(() => this.quotes.list(d.uid, d.threadId, undefined));
    return {
      customerCode: list.customerCode,
      createUrl: this.allowed(u, 'quote.open_erp', t) ? list.createUrl : null,
      items: list.items.filter((q) => !q.block).map((q) => ({ no: q.no, total: q.total, validUntil: q.validUntil, version: q.version })),
      error: list.error ?? (list.customerCode ? null : 'Khách chưa có mã KH VCsales. Đã báo Sale admin.'),
    };
  }

  // ---------------------------------------------------------------- queues (workitem.queue_config)

  async queueConfig(u: Subject): Promise<WorkitemQueueConfig[]> {
    const divisions = [...new Set(u.roles.map((r) => r.divisionId).filter((x): x is string => !!x))].filter((dv) => this.allowed(u, 'workitem.queue_config', { divisionId: dv }) || decide(u, 'workitem.queue_config', { divisionId: dv }, { need: 'view' }).allowed);
    const out: WorkitemQueueConfig[] = [];
    for (const dv of divisions)
      for (const q of WORKITEM_QUEUES) {
        const doc = await this.queues.findOne({ _id: `${dv}:${q}` });
        const names = await this.authz.userNames(doc?.members ?? []);
        out.push({ divisionId: dv, queue: q, members: (doc?.members ?? []).map((m) => ({ userId: m, name: names.get(m) ?? null })) });
      }
    return out;
  }

  /** GĐ sets who is in which queue (workitem.queue_config DV); members must be CSKH of that division. */
  async setQueue(divisionId: string, queue: WorkitemQueue, members: string[], u: Subject, by: Approver): Promise<WorkitemQueueConfig> {
    if (!this.allowed(u, 'workitem.queue_config', { divisionId })) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('workitem.queue_config'));
    const uniq = [...new Set(members)];
    for (const m of uniq) {
      const ras = await this.db.col<{ orgUnitId: string }>('role_assignments').find({ userId: m, roleKey: 'cskh' } as never).toArray();
      const divs = await Promise.all(ras.map(async (r) => (await this.authz.unitFacts(r.orgUnitId))?.divisionId ?? null));
      if (!divs.includes(divisionId)) throw new BadRequestException('Chỉ thêm được nhân viên CSKH của division này.');
    }
    const now = new Date();
    await this.queues.updateOne({ _id: `${divisionId}:${queue}` }, { $set: { divisionId, queue, members: uniq, updatedBy: by.id, updatedAt: now }, $setOnInsert: { cursor: 0 } }, { upsert: true });
    await this.db.audit(by.id, 'workitem.queue_config', `${divisionId}:${queue}`, { members: uniq.length });
    const names = await this.authz.userNames(uniq);
    return { divisionId, queue, members: uniq.map((m) => ({ userId: m, name: names.get(m) ?? null })) };
  }

  // ---------------------------------------------------------------- reads

  async list(q: { view: 'approvals' | 'queue' | 'conversation' | 'mine'; queue?: WorkitemQueue; uid?: string; threadId?: string; open: '0' | '1' }, u: Subject): Promise<WorkitemSummary[]> {
    await this.ensureIndexes();
    const filter: Filter<WorkitemDoc> = {};
    if (q.open === '1') filter.status = { $in: [...WORKITEM_OPEN_STATUSES] };
    if (q.view === 'approvals') filter.status = 'cho_nvkd_duyet';
    if (q.view === 'conversation') {
      if (!q.uid || !q.threadId) throw new BadRequestException('Thiếu hội thoại.');
      Object.assign(filter, { uid: q.uid, threadId: q.threadId });
    }
    if (q.view === 'mine') Object.assign(filter, { $or: [{ assigneeId: u.userId }, { createdById: u.userId }] });
    if (q.queue) filter.queue = q.queue;
    const docs = await this.items.find(filter).sort({ updatedAt: -1 }).limit(500).toArray();
    await this.syncSent(docs);
    const out: WorkitemDoc[] = [];
    for (const d of docs) {
      if (q.view === 'approvals') {
        const mine = (await this.currentApprover(d.uid)) === u.userId;
        const supervising = !!d.escalatedAt && (await this.authz.managersOver(d.uid)).includes(u.userId);
        if (!mine && !supervising) continue;
      }
      if (!(await this.canView(u, d))) continue;
      out.push(d);
    }
    return Promise.all(out.map((d) => this.summary(d)));
  }

  async counts(u: Subject): Promise<WorkitemCounts> {
    const cfg = workitemConfig();
    const approvals = await this.list({ view: 'approvals', open: '1' }, u);
    const mineApprovals = [];
    for (const a of approvals) if ((await this.currentApprover(a.uid)) === u.userId) mineApprovals.push(a);
    const queue: Record<WorkitemQueue, number> = { ban_hang: 0, hau_mai: 0 };
    const assigned = await this.items.find({ assigneeId: u.userId, status: { $in: ['moi', 'cskh_xu_ly', 'tra_lai', 'cho_hang'] } }).project<{ queue: WorkitemQueue }>({ queue: 1 }).toArray();
    for (const a of assigned) queue[a.queue]++;
    return {
      approvals: mineApprovals.length,
      approvalsOverdue: mineApprovals.filter((a) => (a.waitingMinutes ?? 0) >= cfg.remindMinutes).length,
      queue,
    };
  }

  async get(id: string, u: Subject): Promise<WorkitemDetail> {
    const { d } = await this.load(id, u);
    await this.syncSent([d]);
    const fresh = (await this.items.findOne({ _id: d._id })) ?? d;
    await this.db.audit(u.userId, 'workitem.view', d._id, { code: d.code });
    return this.detail(fresh, u);
  }

  private async waitingMinutes(d: WorkitemDoc, now = new Date()): Promise<number | null> {
    if (d.status !== 'cho_nvkd_duyet' || !d.submittedAt) return null;
    const cfg = await slaConfigFor(this.db, d.divisionId);
    return workingMinutesBetween(d.submittedAt.getTime(), now.getTime(), cfg.calendar);
  }

  private async summary(d: WorkitemDoc): Promise<WorkitemSummary> {
    const approverId = d.status === 'cho_nvkd_duyet' || d.status === 'tra_lai' || d.status === 'moi' || d.status === 'cskh_xu_ly' ? await this.currentApprover(d.uid) : d.approvedById;
    const names = await this.authz.userNames([d.assigneeId, approverId]);
    const conv = await runUnscoped(() => this.db.col<{ _id: string; name?: string | null }>(C.conversations).findOne({ _id: `${d.uid}:${d.threadId}` } as never, { projection: { name: 1 } }));
    return {
      id: d._id,
      code: d.code,
      kind: d.kind,
      queue: d.queue,
      status: d.status,
      uid: d.uid,
      threadId: d.threadId,
      conversationName: conv?.name ?? null,
      aftersalesType: d.aftersalesType,
      createdById: d.createdById,
      createdByName: d.createdByName,
      assigneeId: d.assigneeId,
      assigneeName: d.assigneeId ? (names.get(d.assigneeId) ?? null) : null,
      approverId: approverId ?? null,
      approverName: approverId ? (names.get(approverId) ?? null) : null,
      quoteNo: d.quoteNo,
      quoteTotal: d.quoteTotal,
      returnCount: d.returnCount,
      maxReturns: workitemConfig().maxReturns,
      vendorDueAt: iso(d.vendorDueAt),
      dueAt: iso(d.dueAt),
      submittedAt: iso(d.submittedAt),
      waitingMinutes: await this.waitingMinutes(d),
      escalated: !!d.escalatedAt,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  /** The quote read live from VCsales now (BR16); the block text of UAT-SZ-96 when it may no longer be sent. */
  private async quoteView(d: WorkitemDoc): Promise<WorkitemQuoteView | null> {
    if (!d.quoteNo) return null;
    try {
      const list = await runUnscoped(() => this.quotes.list(d.uid, d.threadId, undefined));
      const q = list.items.find((x) => x.no === d.quoteNo);
      if (list.error) return { no: d.quoteNo, total: d.quoteTotal, validUntil: null, status: null, version: null, block: list.error };
      if (!q) return { no: d.quoteNo, total: d.quoteTotal, validUntil: null, status: null, version: null, block: `Không tìm thấy báo giá ${d.quoteNo} trên VCsales. Trả lại để CSKH làm lại.` };
      const label = SALES_QUOTE_STATUS_LABELS[q.status as SalesQuoteStatus] ?? q.status;
      const stateWord = q.block?.code === 'expired' ? 'Hết hạn' : label;
      return {
        no: q.no,
        total: q.total,
        validUntil: q.validUntil,
        status: q.status,
        version: q.version,
        block: q.block ? `Báo giá ${q.no} đang "${stateWord}" trên VCsales. Trả lại để CSKH làm lại.` : null,
      };
    } catch {
      return { no: d.quoteNo, total: d.quoteTotal, validUntil: null, status: null, version: null, block: 'Không kết nối được VCsales. Thử lại sau ít phút.' };
    }
  }

  /**
   * Only the chosen messages, read without the caller's channel scope (CSKH does not see the conversation, CS
   * `orders_only` stays closed) and masked with `maskContactsInText` unless the reader sees the phone in full.
   */
  private async messagesOf(d: WorkitemDoc, u: Subject | undefined): Promise<WorkitemMessageView[]> {
    const docs = await runUnscoped(() =>
      this.db
        .col<Record<string, unknown>>(C.messages)
        .find({ _id: { $in: d.messageIds as never[] }, uid: d.uid, threadId: d.threadId } as never, { projection: { raw: 0 } })
        .sort({ sentAt: 1 })
        .toArray(),
    );
    await this.vault?.open(docs as never[]);
    const vis = u ? await this.authz.phoneOn(u, d.uid) : 'full';
    const files = (await this.attachments?.viewsFor(docs.map((x) => String(x._id)))) ?? new Map();
    return docs.map((m) => {
      let text = m.encrypted ? null : ((m.text as string | undefined) ?? null);
      let masked = 0;
      if (text && vis !== 'full') {
        const r = maskContactsInText(text);
        text = r.text;
        masked = r.count;
      }
      return {
        id: String(m._id),
        msgId: String(m.msgId),
        uid: d.uid,
        threadId: d.threadId,
        fromUid: String(m.fromUid ?? ''),
        senderName: m.encrypted ? null : ((m.senderName as string | undefined) ?? null),
        text,
        sentAt: (m.sentAt as Date).toISOString(),
        ...(masked ? { textMasked: masked } : {}),
        ...(files.has(String(m._id)) ? { attachments: (files.get(String(m._id)) ?? []).map((a: { id: string; kind: string; fileName?: string; mime?: string }) => ({ id: a.id, kind: a.kind, fileName: a.fileName ?? null, mime: a.mime ?? null })) } : {}),
      };
    });
  }

  private async detail(d: WorkitemDoc, u: Subject | undefined): Promise<WorkitemDetail> {
    const t = await this.targetOf(d);
    const may = (k: PermissionKey) => !u || this.allowed(u, k, t);
    const isCs = may('ticket.resolve');
    const quote = await this.quoteView(d);
    let approveBlock: string | null = null;
    let canApprove = false;
    if (u && d.status === 'cho_nvkd_duyet') {
      if (!may('workitem.approve')) approveBlock = 'Chỉ người giữ nick (hoặc người trực nick) mới duyệt và gửi được.';
      else {
        const s = await this.authz.canSend(u, d.uid, d.threadId);
        if (!s.allowed) approveBlock = s.via === 'nick_chua_an_toan' ? 'Nick đang "Chưa an toàn", chưa gửi được.' : 'Bạn chưa gửi được qua nick này.';
        else if (quote?.block) approveBlock = quote.block;
        else canApprove = true;
      }
    }
    const s = d.status;
    return {
      ...(await this.summary(d)),
      note: d.note,
      message: d.message,
      afterSend: d.afterSend,
      result: d.result,
      messages: await this.messagesOf(d, u),
      history: d.history.map((h) => ({ ...h, at: h.at.toISOString() })),
      quote,
      can: {
        start: isCs && !!workitemTransition(s, 'start'),
        edit: isCs && ['moi', 'cskh_xu_ly', 'tra_lai'].includes(s),
        submit: may('workitem.submit') && !!workitemTransition(s, 'submit'),
        approve: canApprove,
        approveBlock,
        return: may('workitem.return') && s === 'cho_nvkd_duyet',
        selfReply: may('workitem.return') && !!workitemTransition(s, 'self_reply'),
        waitVendor: isCs && d.kind === 'hau_mai' && !!workitemTransition(s, 'wait_vendor'),
        vendorBack: isCs && !!workitemTransition(s, 'vendor_back'),
        close: isCs && !!workitemTransition(s, 'close'),
        assign: !!u && s !== 'xong' && (this.allowed(u, 'ticket.assign', t) || this.managesQueueOf(u, d.divisionId)),
        aiExtract: workitemConfig().aiExtract && isCs,
      },
    };
  }

  // ---------------------------------------------------------------- outbox follow-up and timers

  /**
   * `Đã gửi khách` follows the outbox command: sent → `Chờ khách` (quote) or the after-sales step CSKH chose;
   * cancelled ("Bỏ lệnh") → back to `Chờ NVKD duyệt` so it can be approved again. A failed / expired command
   * stays here (handled in "Lệnh gửi": Thử lại or Bỏ lệnh), so the same answer is never queued twice.
   */
  async syncSent(docs: WorkitemDoc[]): Promise<void> {
    const waiting = docs.filter((d) => d.status === 'da_gui_khach' && d.outboxId && d.outboxId !== 'pending');
    if (!waiting.length) return;
    const rows = await runUnscoped(() =>
      this.db
        .col<{ _id: unknown; status: string }>(C.suggestions)
        .find({ _id: { $in: waiting.map((d) => this.oid(d.outboxId!)).filter(Boolean) as never[] } } as never, { projection: { status: 1 } })
        .toArray(),
    );
    const st = new Map(rows.map((r) => [String(r._id), r.status]));
    for (const d of waiting) {
      const s = st.get(d.outboxId!);
      try {
        if (s === 'sent') {
          const to: WorkitemStatus = d.kind === 'bao_gia' ? 'cho_khach' : (d.afterSend ?? 'cskh_xu_ly');
          const res = await this.move(d, 'sent', { id: null, name: 'Hệ thống' }, to === 'xong' ? { result: 'khac', closedAt: new Date() } : {}, {}, to);
          Object.assign(d, res);
        } else if (s === 'cancelled') {
          const res = await this.move(d, 'send_failed', { id: null, name: 'Hệ thống' }, { outboxId: null, sendFailedAt: new Date(), submittedAt: new Date(), remindedAt: null, escalatedAt: null });
          Object.assign(d, res);
          await this.notifications.notify([await this.currentApprover(d.uid)], 'workitem', `Lệnh gửi của phiếu ${d.code} đã bị bỏ. Phiếu quay lại Chờ bạn duyệt.`, this.link(d));
        }
      } catch {
        // Somebody moved it meanwhile: the next read sees the new state.
      }
    }
  }

  private oid(id: string): ObjectId | null {
    return ObjectId.isValid(id) ? new ObjectId(id) : null;
  }

  /** One pass over every tenant: outbox follow-up, reminder at 10′, supervisor at 20′ (working minutes). */
  async sweep(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      let n = 0;
      for (const t of await this.db.tenants()) n += await runAsTenant(t, () => this.sweepTenant(now));
      return n;
    } catch (err) {
      this.logger.warn(`Quét phiếu CSKH lỗi: ${(err as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async sweepTenant(now: Date): Promise<number> {
    await this.syncSent(await this.items.find({ status: 'da_gui_khach' }).limit(500).toArray());
    const cfg = workitemConfig();
    let sent = 0;
    for (const d of await this.items.find({ status: 'cho_nvkd_duyet' }).limit(500).toArray()) {
      const wait = (await this.waitingMinutes(d, now)) ?? 0;
      if (!d.remindedAt && wait >= cfg.remindMinutes) {
        await this.notifications.notify([await this.currentApprover(d.uid)], 'workitem', `Nhắc: phiếu ${d.code} chờ bạn duyệt ${wait} phút.`, this.link(d));
        await this.items.updateOne({ _id: d._id }, { $set: { remindedAt: now }, $push: { history: { at: now, byId: null, byName: 'Hệ thống', event: 'remind', from: d.status, to: d.status } } } as never);
        sent++;
      }
      if (!d.escalatedAt && wait >= cfg.escalateMinutes) {
        const sups = await this.authz.managersOver(d.uid);
        const csSup = d.assigneeId ? await this.authz.supervisorOf(d.assigneeId) : null;
        await this.notifications.notify([...sups.slice(0, 1), csSup], 'workitem_alert', `Phiếu ${d.code} chờ NVKD duyệt quá ${cfg.escalateMinutes} phút.`, this.link(d));
        await this.items.updateOne({ _id: d._id }, { $set: { escalatedAt: now }, $push: { history: { at: now, byId: null, byName: 'Hệ thống', event: 'escalate', from: d.status, to: d.status } } } as never);
        sent++;
      }
    }
    return sent;
  }
}
