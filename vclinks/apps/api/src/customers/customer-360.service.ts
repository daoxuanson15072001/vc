import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  ACTIVE_DOT_MINUTES,
  ACTIVITY_DAYS,
  channelOfUid,
  CLUSTER_MINUTES,
  CROSS_NICK_HOURS,
  maskContactsInText,
  maskEmail,
  maskPhone,
  NO_ACCESS_TEXT,
  verifyRank,
  type CommerceBlock,
  type Customer360,
  type CustomerActivityRow,
  type CustomerDetail,
  type CustomerRevealInput,
  type CustomerRevealResult,
  type TimelineEvent,
  type TimelineQuery,
  type TimelineResponse,
  quoteSentText,
} from '@vclinks/shared';
import { VcsaleUnavailableError, type VcsaleClient, type VcsaleCommerce } from '@vclinks/vcsale-client';
import type { Document, Filter } from 'mongodb';
import { AlertsService } from '../audit/alerts.service';
import { AuthzService } from '../authz/authz.service';
import { decide, type Subject } from '../authz/engine';
import { ownSenders } from '../conversations/inbox-state';
import { C, DbService } from '../db/db.service';
import { runUnscoped } from '../db/tenant-context';
import { MessageVault } from '../security/message-vault';
import type { UserDoc } from '../users/users.service';
import { CustomerPrivacyService } from './customer-privacy';
import { CustomersService, VCSALE_CLIENT } from './customers.service';
import { VcsalesStatusService } from '../vcsales/vcsales-status.service';
import { CUST_C, type ContactPointDoc, type ErpCustomerDoc, type ErpTaskDoc, type MergeOperationDoc } from './customers.types';

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const commerceTtl = () => Number(process.env.COMMERCE_TTL_MS ?? 5 * MIN);
/** Cache of VCsales commercial blocks (`_id` = `vcsales:${code}`): the last good answer, shown when VCsales is down. */
const COMMERCE_C = 'erp_commerce';
export const ERR_ERP_TEXT = 'Không lấy được dữ liệu VCsales. Đang hiện bản chụp gần nhất.';
/** The linked code is gone from VCsales (deleted there, or a test code): nothing old is shown as current. */
export const ERR_ERP_CODE_GONE_TEXT = (code: string) => `Mã KH ${code} không còn trên VCsales. Kiểm tra lại liên kết mã KH.`;

interface Identity {
  identityId: string;
  uid: string;
  userId: string;
  contactId: string;
  contactName: string | null;
  state: CustomerDetail['contacts'][number]['identities'][number]['state'];
}

interface NickInfo {
  label: string | null;
  ownerName: string | null;
  holder: string | null;
}

/**
 * Customer 360 read side (M1b-13): the page (MH-DK-01), the chat side panel (MH-DK-02 / MH-UI-09) and the
 * merged timeline (MH-DK-03). Every read starts from `CustomersService.detail`, which refuses an account
 * outside the viewer's scope (404 "Không tìm thấy hoặc bạn không có quyền xem") and masks phones and
 * emails (DK-44). Message content is shown only for conversations the viewer may open (DK-40); the rest
 * become "n tin · bạn không có quyền xem nội dung" rows. VCsales is read only (BR12) and mocked until E5.
 */
@Injectable()
export class Customer360Service {
  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    private readonly customers: CustomersService,
    private readonly privacy: CustomerPrivacyService,
    private readonly alerts: AlertsService,
    @Inject(VCSALE_CLIENT) private readonly vcsale: VcsaleClient,
    @Optional() private readonly vault?: MessageVault,
    @Optional() private readonly vcsaleStatus?: VcsalesStatusService,
  ) {}

  // ---------------------------------------------------------------------------------------------- helpers

  private identitiesOf(d: CustomerDetail): Identity[] {
    return d.contacts.flatMap((c) =>
      c.identities.map((i) => ({ identityId: i.identityId, uid: i.uid, userId: i.userId, contactId: c.id, contactName: c.name, state: i.state })),
    );
  }

  private async nicks(uids: string[]): Promise<Map<string, NickInfo>> {
    const [accs, own] = await Promise.all([
      runUnscoped(() => this.db.col<{ _id: string; label?: string; ownerName?: string }>(C.accounts).find({ _id: { $in: uids } as never }, { projection: { label: 1, ownerName: 1 } }).toArray()),
      this.authz.ownership(),
    ]);
    const holders = uids.map((u) => own.holders.get(u)).filter((h): h is string => !!h);
    const names = await this.userNames(holders);
    return new Map(
      uids.map((uid) => {
        const a = accs.find((x) => String(x._id) === uid);
        const holder = own.holders.get(uid) ?? null;
        return [uid, { label: a?.label ?? null, ownerName: a?.ownerName ?? null, holder: holder ? (names.get(holder) ?? null) : null }];
      }),
    );
  }

  private async userNames(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const rows = await runUnscoped(() => this.db.col<UserDoc>(C.users).find({ _id: { $in: ids } }, { projection: { fullName: 1 } }).toArray());
    return new Map(rows.map((r) => [r._id, r.fullName]));
  }

  /** Conversations (identity ids) the viewer may open: the engine on the conversation target (DK-40). */
  private async readable(u: Subject | undefined, ids: Identity[]): Promise<Set<string>> {
    if (!u) return new Set(ids.map((i) => i.identityId));
    const ok = await Promise.all(
      ids.map(async (i) => (decide(u, 'conv.view', await this.authz.conversationTarget(i.uid, i.userId)).allowed ? i.identityId : null)),
    );
    return new Set(ok.filter((x): x is string => !!x));
  }

  // ---------------------------------------------------------------------------------------------- 360 / panel

  async byAccount(accountId: string, u: Subject | undefined, opts: { refresh?: boolean } = {}): Promise<Customer360> {
    return this.build(await this.customers.detail(accountId, u), u, null, opts);
  }

  /** Panel of the chat: the customer of one channel identity, with that identity highlighted (DK-15 uses its state). */
  async byIdentity(uid: string, userId: string, u: Subject | undefined, opts: { refresh?: boolean } = {}): Promise<Customer360> {
    const detail = await this.customers.byIdentity(uid, userId, u);
    return this.build(detail, u, `${uid}:${userId}`, opts);
  }

  private async build(detail: CustomerDetail, u: Subject | undefined, identityId: string | null, opts: { refresh?: boolean }): Promise<Customer360> {
    const ids = this.identitiesOf(detail);
    const mine = identityId ? ids.find((i) => i.identityId === identityId) : undefined;
    const unconfirmed = mine ? mine.state === 'unconfirmed' : false;
    const [vis, level, canTimeline, readable, nicks] = await Promise.all([
      this.privacy.phoneVisibility(u, detail),
      this.privacy.commerceLevel(u, detail),
      this.privacy.allowed(u, 'cust.timeline', detail),
      this.readable(u, ids),
      this.nicks([...new Set(ids.map((i) => i.uid))]),
    ]);
    const activity = await this.activity(ids, readable, nicks);
    const recommended = activity.filter((a) => !a.locked && a.unanswered > 0).sort((a, b) => (b.lastInboundAt ?? '').localeCompare(a.lastInboundAt ?? ''))[0] ?? null;
    const now = Date.now();
    const crossNick = activity
      .filter((a) => a.conversationId !== identityId && a.unanswered > 0 && a.unansweredSince && now - Date.parse(a.unansweredSince) <= CROSS_NICK_HOURS * HOUR)
      .map((a) => ({ conversationId: a.conversationId, nickLabel: a.nickLabel, nickOwnerName: a.nickOwnerName, unanswered: a.unanswered, locked: a.locked }));
    const { block, hidden } = await this.commerce(detail, level, unconfirmed, !!opts.refresh);
    const recent = canTimeline ? (await this.timeline(detail, { limit: 5 }, u, { ids, readable, nicks })).events : [];
    const erp = await this.erpExtras(detail);
    return {
      customer: detail,
      viewer: { phone: vis, commerce: level, timeline: canTimeline, isOwner: this.privacy.isOwner(u, detail), canConfirmErp: this.customers.canConfirmErp(u) },
      identity: mine ? { identityId: mine.identityId, uid: mine.uid, userId: mine.userId, state: mine.state, contactId: mine.contactId, contactName: mine.contactName } : null,
      unconfirmed,
      channels: [...nicks].map(([uid, n]) => ({ uid, channel: channelOfUid(uid), nickLabel: n.label, nickOwnerName: n.ownerName })),
      activity,
      recommendedConversationId: recommended?.conversationId ?? null,
      crossNick,
      commerce: block,
      commerceHidden: hidden,
      recent,
      ...erp,
      loadedAt: new Date().toISOString(),
    };
  }

  /** Waiting Việc VCsales of the customer, and verified phones / e-mails its VCsales code lacks (MH-DK-10 #5). */
  private async erpExtras(d: CustomerDetail): Promise<Pick<Customer360, 'erpTasks' | 'erpDiff'>> {
    const tasks = await this.db
      .col<ErpTaskDoc>(CUST_C.erpTasks)
      .find({ accountId: d.id, status: { $in: ['open', 'waiting_sale'] } } as never, { projection: { kind: 1, status: 1, pointId: 1 } })
      .toArray();
    const erpTasks = tasks.map((t) => ({ id: t._id, kind: t.kind, status: t.status }));
    const code = d.erpLinks.find((l) => l.erp === 'vcsales' && l.status === 'confirmed')?.customerId;
    if (!code) return { erpTasks, erpDiff: [] };
    const snap = await this.db.col<ErpCustomerDoc>(CUST_C.erpCustomers).findOne({ _id: `vcsales:${code}` }, { projection: { phones: 1, emails: 1, status: 1 } });
    if (!snap || snap.status === 'deleted') return { erpTasks, erpDiff: [] };
    const points = await this.db.col<ContactPointDoc>(CUST_C.points).find({ accountId: d.id, state: 'active' }).toArray();
    const queued = new Set(tasks.map((t) => t.pointId).filter(Boolean));
    const erpDiff = points
      .filter((p) => verifyRank(p.level) >= 2 && !p.source.erp && !(p.kind === 'phone' ? snap.phones : snap.emails).includes(p.value))
      .map((p) => ({ pointId: p._id, kind: p.kind === 'email' ? ('email' as const) : ('phone' as const), masked: p.kind === 'email' ? maskEmail(p.value) : maskPhone(p.value), queued: queued.has(p._id) }));
    return { erpTasks, erpDiff };
  }

  /** "Khách đang hoạt động" (DK-43): conversations of the customer with an inbound message in the last 7 days. */
  private async activity(ids: Identity[], readable: Set<string>, nicks: Map<string, NickInfo>): Promise<CustomerActivityRow[]> {
    const since = new Date(Date.now() - ACTIVITY_DAYS * DAY);
    const rows = await Promise.all(
      ids.map(async (i): Promise<CustomerActivityRow | null> => {
        const own = ownSenders(i.uid);
        const [conv, lastIn] = await runUnscoped(() =>
          Promise.all([
            this.db.col<Document>(C.conversations).findOne({ _id: i.identityId as never }, { projection: { lastMsgAt: 1, unansweredSince: 1 } }),
            this.db.col<Document>(C.messages).findOne({ uid: i.uid, threadId: i.userId, fromUid: { $nin: own }, sentAt: { $gte: since } }, { sort: { sentAt: -1 }, projection: { sentAt: 1 } }),
          ]),
        );
        if (!lastIn) return null;
        const unansweredSince = conv?.unansweredSince instanceof Date ? conv.unansweredSince : null;
        const unanswered = unansweredSince
          ? await runUnscoped(() => this.db.col(C.messages).countDocuments({ uid: i.uid, threadId: i.userId, fromUid: { $nin: own }, sentAt: { $gte: unansweredSince } }, { limit: 200 }))
          : 0;
        const nick = nicks.get(i.uid);
        const lastInboundAt = (lastIn.sentAt as Date).toISOString();
        return {
          conversationId: i.identityId,
          uid: i.uid,
          channel: channelOfUid(i.uid),
          nickLabel: nick?.label ?? null,
          nickOwnerName: nick?.ownerName ?? null,
          contactId: i.contactId,
          contactName: i.contactName,
          lastMsgAt: conv?.lastMsgAt instanceof Date ? conv.lastMsgAt.toISOString() : lastInboundAt,
          lastInboundAt,
          unanswered,
          unansweredSince: unansweredSince?.toISOString() ?? null,
          handlerName: nick?.holder ?? null,
          locked: !readable.has(i.identityId),
          active: Date.now() - Date.parse(lastInboundAt) <= ACTIVE_DOT_MINUTES * MIN,
        };
      }),
    );
    return rows.filter((r): r is CustomerActivityRow => !!r).sort((a, b) => (b.lastInboundAt ?? '').localeCompare(a.lastInboundAt ?? ''));
  }

  // ---------------------------------------------------------------------------------------------- commerce

  /**
   * Commercial block (MH-DK-01 #12). Hidden without the right, for an unconfirmed identity (DK-15) and when
   * no VCsales code is linked. A VCsales outage keeps the last snapshot, marked stale (UAT-UI-67).
   */
  private async commerce(d: CustomerDetail, level: Customer360['viewer']['commerce'], unconfirmed: boolean, refresh: boolean): Promise<{ block: CommerceBlock | null; hidden: Customer360['commerceHidden'] }> {
    if (level === 'none') return { block: null, hidden: 'no_right' };
    if (unconfirmed) return { block: null, hidden: 'unconfirmed' };
    const link = d.erpLinks.find((l) => l.erp === 'vcsales' && l.status === 'confirmed');
    if (!link) return { block: null, hidden: 'no_link' };
    const cache = this.db.col<{ _id: string; data: VcsaleCommerce; fetchedAt: Date }>(COMMERCE_C);
    const key = `vcsales:${link.customerId}`;
    let doc = await cache.findOne({ _id: key });
    let stale = false;
    let error: string | null = null;
    // VCsales known down (last connection check, plan C6): the snapshot at once, no wait for a time-out; ↻ still tries.
    if (!refresh && doc && this.vcsaleStatus?.down()) {
      stale = true;
      error = ERR_ERP_TEXT;
    } else if (!doc || refresh || Date.now() - doc.fetchedAt.getTime() > commerceTtl()) {
      try {
        const fresh = await this.vcsale.getCommerce(link.customerId);
        if (fresh) {
          doc = { _id: key, data: fresh, fetchedAt: new Date() };
          await cache.updateOne({ _id: key }, { $set: { data: fresh, fetchedAt: doc.fetchedAt } }, { upsert: true });
        } else {
          await cache.deleteOne({ _id: key });
          doc = null;
          error = ERR_ERP_CODE_GONE_TEXT(link.customerId);
        }
      } catch (e) {
        if (!(e instanceof VcsaleUnavailableError)) throw e;
        stale = true;
        error = ERR_ERP_TEXT;
      }
    }
    const data = doc?.data;
    const now = Date.now();
    const overdue = !!data?.debt && !!data.debt.dueAt && Date.parse(data.debt.dueAt) < now;
    const full = level === 'full';
    return {
      hidden: null,
      block: {
        erp: 'vcsales',
        code: link.customerId,
        fetchedAt: (doc?.fetchedAt ?? new Date()).toISOString(),
        stale: stale || !data,
        error: error ?? (data ? null : ERR_ERP_TEXT),
        tier: full ? (data?.tier ?? null) : null,
        revenue12m: full ? (data?.revenue12m ?? null) : null,
        debt: full && data?.debt ? { amount: data.debt.amount, dueAt: data.debt.dueAt, overdue } : null,
        openQuotes: full ? (data?.openQuotes ?? []) : null,
        hasOverdueDebt: overdue,
        lastOrder: data?.lastOrder ?? null,
      },
    };
  }

  // ---------------------------------------------------------------------------------------------- timeline

  async timelineOf(accountId: string, q: TimelineQuery, u: Subject | undefined): Promise<TimelineResponse> {
    const detail = await this.customers.detail(accountId, u);
    if (!(await this.privacy.allowed(u, 'cust.timeline', detail))) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    return this.timeline(detail, q, u);
  }

  /**
   * Merged timeline (MH-DK-03): messages of every identity of the account plus profile operations, newest
   * first, in original time (`sentAt`). Content of a conversation the viewer may not open is not read: its
   * messages come back as `hidden` rows with a count only (DK-40, UAT-DK-18). Clusters, channel switches
   * and the multi-channel band are drawn by the Dashboard from these events (DK-37…DK-39).
   */
  private async timeline(
    d: CustomerDetail,
    q: Partial<TimelineQuery> & { limit: number },
    u: Subject | undefined,
    pre?: { ids: Identity[]; readable: Set<string>; nicks: Map<string, NickInfo> },
  ): Promise<TimelineResponse> {
    const all = pre?.ids ?? this.identitiesOf(d);
    const readable = pre?.readable ?? (await this.readable(u, all));
    const nicks = pre?.nicks ?? (await this.nicks([...new Set(all.map((i) => i.uid))]));
    const scope = all.filter((i) => (!q.contact || i.contactId === q.contact) && (!q.uid || i.uid === q.uid));
    const range: Document = {};
    if (q.from) range.$gte = new Date(q.from);
    const upper = [q.to ? Date.parse(q.to) : Infinity, q.before ? Date.parse(q.before) - 1 : Infinity].reduce((a, b) => Math.min(a, b));
    if (Number.isFinite(upper)) range.$lte = new Date(upper);
    const sentAt = Object.keys(range).length ? { sentAt: range } : {};
    const limit = q.limit;
    const per = (set: Identity[]): Filter<Document> => ({ $or: set.map((i) => ({ uid: i.uid, threadId: i.userId })), ...sentAt });
    const open = scope.filter((i) => readable.has(i.identityId));
    const shut = scope.filter((i) => !readable.has(i.identityId));
    const wantMessages = !q.type || q.type === 'message';
    const [openMsgs, shutMsgs, ops, quotes] = await runUnscoped(() =>
      Promise.all([
        wantMessages && open.length
          ? this.db.col<Document>(C.messages).find({ ...per(open), ...(q.q ? { text: { $regex: escapeRe(q.q), $options: 'i' } } : {}) }, { projection: { raw: 0 } }).sort({ sentAt: -1 }).limit(limit + 1).toArray()
          : [],
        wantMessages && shut.length && !q.q
          ? this.db.col<Document>(C.messages).find(per(shut), { projection: { uid: 1, threadId: 1, sentAt: 1 } }).sort({ sentAt: -1 }).limit(limit + 1).toArray()
          : [],
        !q.type || q.type === 'profile' ? (q.uid || q.q ? [] : this.profileOps(d.id, sentAt)) : [],
        // M1c-02: "Đã gửi báo giá số …" lines, only of conversations the viewer may open (DK-40).
        (!q.type || q.type === 'quote') && !q.q && open.length
          ? this.db.col<Document>(C.quoteSends).find({ $or: open.map((i) => ({ uid: i.uid, threadId: i.userId })), ...sentAt }).sort({ sentAt: -1 }).limit(limit + 1).toArray()
          : [],
      ]),
    );
    if (this.vault) await this.vault.open(openMsgs);
    const byConv = new Map(all.map((i) => [`${i.uid}:${i.userId}`, i]));
    const events: TimelineEvent[] = [];
    // Phones / emails typed in message text are masked like the phone points (L-02, NĐ 13).
    const textVis = openMsgs.length ? await this.privacy.phoneVisibility(u, d) : 'full';
    const channelVis = new Map<string, string>();
    for (const m of openMsgs) {
      const i = byConv.get(`${m.uid}:${m.threadId}`)!;
      const nick = nicks.get(i.uid);
      const incoming = !ownSenders(i.uid).includes(String(m.fromUid));
      events.push({
        id: String(m._id),
        kind: 'message',
        at: (m.sentAt as Date).toISOString(),
        channel: channelOfUid(i.uid),
        uid: i.uid,
        nickLabel: nick?.label ?? null,
        nickOwnerName: nick?.ownerName ?? null,
        conversationId: i.identityId,
        contactId: i.contactId,
        contactName: i.contactName,
        direction: incoming ? 'in' : 'out',
        senderName: incoming ? null : (nick?.holder ?? nick?.ownerName ?? null),
        text: m.encrypted ? null : typeof m.text === 'string' ? m.text : null,
        msgType: typeof m.msgType === 'string' ? m.msgType : null,
        ...(m.recalled ? { recalled: true } : {}),
      });
      const ev = events[events.length - 1]!;
      if (textVis !== 'full' && ev.text) {
        const r = maskContactsInText(ev.text);
        if (r.count) {
          if (!u) continue;
          if (!channelVis.has(i.uid)) channelVis.set(i.uid, await this.authz.phoneOn(u, i.uid));
          ev.text = r.text;
          ev.textMasked = r.count;
          ev.textRevealable = textVis === 'reveal' && channelVis.get(i.uid) !== 'masked';
        }
      }
    }
    // Messages of conversations the viewer may not open: one summary row per run in the same conversation (DK-40).
    let run: TimelineEvent | null = null;
    let runConv = '';
    for (const m of shutMsgs) {
      const i = byConv.get(`${m.uid}:${m.threadId}`)!;
      const at = (m.sentAt as Date).toISOString();
      if (run && runConv === i.identityId && Date.parse(run.at) - Date.parse(at) <= CLUSTER_MINUTES * MIN) {
        run.hiddenCount = (run.hiddenCount ?? 0) + 1;
        continue;
      }
      const nick = nicks.get(i.uid);
      run = {
        id: `hidden:${String(m._id)}`,
        kind: 'hidden',
        at,
        channel: channelOfUid(i.uid),
        uid: i.uid,
        nickLabel: nick?.label ?? null,
        nickOwnerName: nick?.ownerName ?? null,
        conversationId: null,
        contactId: null,
        contactName: null,
        hiddenCount: 1,
      };
      runConv = i.identityId;
      events.push(run);
    }
    for (const x of quotes) {
      const i = byConv.get(`${x.uid}:${x.threadId}`);
      if (!i) continue;
      const nick = nicks.get(i.uid);
      events.push({
        id: `quote:${String(x._id)}`,
        kind: 'quote',
        at: (x.sentAt as Date).toISOString(),
        channel: channelOfUid(i.uid),
        uid: i.uid,
        nickLabel: nick?.label ?? null,
        nickOwnerName: nick?.ownerName ?? null,
        conversationId: i.identityId,
        contactId: i.contactId,
        contactName: i.contactName,
        direction: 'out',
        senderName: typeof x.sentByName === 'string' ? x.sentByName : null,
        text: quoteSentText(String(x.no), Number(x.total)),
      });
    }
    for (const o of ops) {
      events.push({ id: o._id, kind: 'profile', at: o.at.toISOString(), channel: null, uid: null, nickLabel: null, nickOwnerName: null, conversationId: null, contactId: null, contactName: null, op: o.op, actor: o.actor });
    }
    events.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
    const page = events.slice(0, limit);
    return {
      events: page,
      nextBefore: events.length > limit ? page[page.length - 1]!.at : null,
      contacts: d.contacts.map((c) => ({ id: c.id, name: c.name })),
      channels: [...new Map(all.map((i) => [i.uid, i])).values()].map((i) => ({ uid: i.uid, channel: channelOfUid(i.uid), nickLabel: nicks.get(i.uid)?.label ?? null })),
    };
  }

  private async profileOps(accountId: string, sentAt: Document): Promise<MergeOperationDoc[]> {
    const at = sentAt.sentAt as Document | undefined;
    return this.db
      .col<MergeOperationDoc>(CUST_C.operations)
      .find({ $or: [{ 'target.accountId': accountId }, { 'source.accountId': accountId }], ...(at ? { at } : {}) } as Filter<MergeOperationDoc>)
      .sort({ at: -1 })
      .limit(50)
      .toArray();
  }

  // ---------------------------------------------------------------------------------------------- reveal

  /**
   * "Hiện" / "Sao chép" of a phone or email of the customer (DK-44, MH-DK-01 #8). Owner and nick holder see
   * it in full already and need no click; a viewer who may reveal gets the value and a `phone.reveal` /
   * `email.reveal` audit line without the value; anybody else is refused. Too many clicks warn the person
   * and raise an alert for the managers (R1).
   */
  async reveal(accountId: string, input: CustomerRevealInput, u: Subject | undefined, actor: string): Promise<CustomerRevealResult> {
    const detail = await this.customers.detail(accountId, u);
    const vis = await this.privacy.phoneVisibility(u, detail);
    if (vis === 'masked') throw new ForbiddenException(NO_ACCESS_TEXT.api);
    const point = await this.db.col<ContactPointDoc>(CUST_C.points).findOne({ _id: input.pointId, accountId });
    if (!point) throw new NotFoundException(NO_ACCESS_TEXT.api);
    if (vis === 'reveal') {
      await this.db.audit(actor, point.kind === 'phone' ? 'phone.reveal' : 'email.reveal', accountId, { action: input.action, pointId: point._id, via: 'customer', where: 'customer360' });
    }
    const warning = u && vis === 'reveal' ? await this.alerts.warningFor(u.userId, 'R1') : null;
    return { value: point.value, ...(warning ? { warning } : {}) };
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
