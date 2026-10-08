import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  LABELS_PER_CONVERSATION,
  NOTE_EDIT_MINUTES,
  type ConversationEventType,
  type ConversationLabel,
  type ConversationNote,
  type ConversationPerson,
  type LabelColor,
  type LabelInput,
  type NoteInput,
} from '@vclinks/shared';
import { AuthzService } from '../authz/authz.service';
import type { Subject } from '../authz/engine';
import { C, DbService } from '../db/db.service';
import { runUnscoped } from '../db/tenant-context';
import { NotificationsService } from '../notifications/notifications.service';
import { ConversationsService } from './conversations.service';

/** Internal notes and event lines of a conversation; channel-scoped by `uid` like messages (db.service CHANNEL_SCOPED). */
export const CONVERSATION_NOTES = 'conversation_notes';
/** VClinks labels (company-wide catalog, not Zalo's). */
export const CONVERSATION_LABELS = 'conversation_labels';

interface NoteDoc {
  _id: string;
  uid: string;
  threadId: string;
  kind: 'note' | 'event';
  text: string | null;
  mentions: string[];
  authorId: string;
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
  event?: { type: ConversationEventType; toId: string | null; reason: string | null };
}

interface LabelDoc {
  _id: string;
  name: string;
  color: LabelColor;
  createdBy: string;
  createdAt: Date;
}

const split = (id: string) => {
  const i = id.indexOf(':');
  if (i <= 0) throw new NotFoundException('Mã hội thoại không hợp lệ');
  return { uid: id.slice(0, i), threadId: id.slice(i + 1) };
};
const newId = (p: string) => `${p}${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;

/**
 * Work on a conversation (00 MH-UI-10, 01 §3.1): claim / assign / transfer / release of the handler on channels
 * without a nick holder, internal notes with @mentions, VClinks labels. The routes check the permission on the
 * conversation (route-permissions); this service checks the state (still unassigned, the target sees it, the
 * author edits within 15 minutes) and writes an event line, an audit row and the notifications.
 */
@Injectable()
export class ConversationWorkService {
  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    private readonly notifications: NotificationsService,
    private readonly conversations: ConversationsService,
  ) {}

  private notesCol() {
    return this.db.col<NoteDoc>(CONVERSATION_NOTES);
  }

  private labelsCol() {
    return this.db.col<LabelDoc>(CONVERSATION_LABELS);
  }

  private async conversation(id: string): Promise<{ _id: string; uid: string; threadId: string; assigneeId?: string | null; vcLabels?: string[] }> {
    const c = await this.db.col<{ _id: string; uid: string; threadId: string; assigneeId?: string | null; vcLabels?: string[] }>(C.conversations).findOne({ _id: id });
    if (!c) throw new NotFoundException('Không tìm thấy hội thoại');
    return c;
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const want = [...new Set(ids.filter(Boolean))];
    if (!want.length) return out;
    for (const u of await runUnscoped(() => this.db.col<{ _id: string; fullName?: string }>(C.users).find({ _id: { $in: want } }, { projection: { fullName: 1 } }).toArray())) {
      out.set(u._id, u.fullName ?? u._id);
    }
    return out;
  }

  private async title(id: string): Promise<string> {
    try {
      return (await this.conversations.get(id)).name ?? 'không tên';
    } catch {
      return 'không tên';
    }
  }

  private actor(s: Subject | undefined): string {
    return s?.userId ?? 'token';
  }

  // ---------------------------------------------------------------- handler

  /** Claim / assign / transfer need a channel without a nick holder (02 DK-21: the holder handles a personal nick). */
  private async assertAssignable(uid: string): Promise<void> {
    const { holders, official } = await this.authz.ownership();
    const holder = holders.get(uid);
    if (!official.has(uid) && holder) {
      const name = (await this.names([holder])).get(holder) ?? 'người giữ nick';
      throw new ConflictException(`Hội thoại trên nick cá nhân do người giữ nick (${name}) xử lý: không nhận, giao hay chuyển được.`);
    }
  }

  /** Active people who see this conversation (their own data scope): picker of assign / transfer and the @ list. */
  async people(id: string): Promise<ConversationPerson[]> {
    const c = await this.conversation(id);
    const { holders } = await this.authz.ownership();
    const handler = c.assigneeId || holders.get(c.uid) || null;
    const users = await runUnscoped(() =>
      this.db
        .col<{ _id: string; fullName?: string; status?: string }>(C.users)
        .find({ status: { $in: ['hoat_dong', 'cho_kich_hoat'] } }, { projection: { fullName: 1 } })
        .toArray(),
    );
    const out: ConversationPerson[] = [];
    for (const u of users) {
      if (!(await this.sees(u._id, c.uid, id))) continue;
      out.push({ id: u._id, name: u.fullName ?? u._id, handler: u._id === handler });
    }
    return out.sort((a, b) => Number(b.handler) - Number(a.handler) || a.name.localeCompare(b.name, 'vi'));
  }

  /** The user would see the conversation in their inbox (same data scope as the list and the messages). */
  private async sees(userId: string, uid: string, id: string): Promise<boolean> {
    const subject = await this.authz.subject(userId);
    const scope = await this.authz.dataScope(subject, 'conv.view');
    return !scope || scope.channels.includes(uid) || scope.conversations.includes(id);
  }

  private async event(c: { uid: string; threadId: string }, actor: string, type: ConversationEventType, toId: string | null, reason: string | null) {
    await this.notesCol().insertOne({
      _id: newId('ce_'),
      uid: c.uid,
      threadId: c.threadId,
      kind: 'event',
      text: null,
      mentions: [],
      authorId: actor,
      createdAt: new Date(),
      event: { type, toId, reason },
    });
  }

  /** "Nhận": the first click wins (UAT-OA-13); the other gets who took it. */
  async claim(id: string, s: Subject | undefined): Promise<{ ok: true }> {
    const c = await this.conversation(id);
    await this.assertAssignable(c.uid);
    const me = this.actor(s);
    const r = await this.db.col(C.conversations).updateOne({ _id: id, $or: [{ assigneeId: null }, { assigneeId: { $exists: false } }] } as never, { $set: { assigneeId: me, assignedAt: new Date() } });
    if (!r.modifiedCount) {
      const now = await this.conversation(id);
      const who = now.assigneeId ? ((await this.names([now.assigneeId])).get(now.assigneeId) ?? 'người khác') : 'người khác';
      throw new ConflictException(`Hội thoại ${await this.title(id)} vừa được ${who} nhận.`);
    }
    await this.event(c, me, 'claim', me, null);
    await this.db.audit(`user:${me}`, 'conversation.claim', id);
    return { ok: true };
  }

  /** "Phân công cho…" (GS, GĐ, trưởng nhóm CSKH) and "Chuyển cho…" (the handler, with a reason). */
  async setHandler(id: string, kind: 'assign' | 'transfer', toUserId: string, reason: string | null, s: Subject | undefined): Promise<{ ok: true }> {
    const c = await this.conversation(id);
    await this.assertAssignable(c.uid);
    const me = this.actor(s);
    if (kind === 'transfer' && s && c.assigneeId !== me) {
      const canAssign = this.authz.decide(s, 'conv.assign', await this.authz.conversationTarget(c.uid, c.threadId)).allowed;
      if (!canAssign) throw new ForbiddenException('Chỉ người đang xử lý hoặc quản lý mới chuyển được hội thoại này.');
    }
    if (toUserId === c.assigneeId) throw new BadRequestException('Người này đang xử lý hội thoại rồi.');
    const names = await this.names([toUserId, me]);
    const toName = names.get(toUserId);
    if (!toName) throw new BadRequestException('Không tìm thấy người nhận.');
    if (!(await this.sees(toUserId, c.uid, id))) throw new BadRequestException(`${toName} không xem được hội thoại này (chưa được gán kênh), nên chưa giao được.`);
    await this.db.col(C.conversations).updateOne({ _id: id } as never, { $set: { assigneeId: toUserId, assignedAt: new Date() } });
    await this.event(c, me, kind, toUserId, reason);
    await this.db.audit(`user:${me}`, `conversation.${kind}`, id, { from: c.assigneeId ?? null, to: toUserId, reason });
    if (toUserId !== me) {
      const who = names.get(me) ?? 'Quản lý';
      const verb = kind === 'assign' ? 'phân công cho bạn' : 'chuyển cho bạn';
      await this.notifications
        .notify([toUserId], 'conversation.assigned', `${who} ${verb} hội thoại ${await this.title(id)}${reason ? `. Lý do: ${reason}` : ''}`, `/conversations/${encodeURIComponent(id)}`)
        .catch(() => undefined);
    }
    return { ok: true };
  }

  /** "Trả về Chưa phân công": the handler (or a manager) gives the conversation back to the queue. */
  async release(id: string, s: Subject | undefined): Promise<{ ok: true }> {
    const c = await this.conversation(id);
    await this.assertAssignable(c.uid);
    const me = this.actor(s);
    if (!c.assigneeId) throw new ConflictException('Hội thoại đang ở Chưa phân công.');
    if (s && c.assigneeId !== me && !this.authz.decide(s, 'conv.assign', await this.authz.conversationTarget(c.uid, c.threadId)).allowed) {
      throw new ForbiddenException('Chỉ người đang xử lý hoặc quản lý mới trả được hội thoại này.');
    }
    await this.db.col(C.conversations).updateOne({ _id: id } as never, { $set: { assigneeId: null }, $unset: { assignedAt: '' } });
    await this.event(c, me, 'release', null, null);
    await this.db.audit(`user:${me}`, 'conversation.release', id, { from: c.assigneeId });
    return { ok: true };
  }

  // ---------------------------------------------------------------- notes

  async notes(id: string, s: Subject | undefined): Promise<ConversationNote[]> {
    const { uid, threadId } = split(id);
    const docs = await this.notesCol().find({ uid, threadId, deletedAt: { $exists: false } }).sort({ createdAt: 1 }).limit(500).toArray();
    const names = await this.names(docs.flatMap((d) => [d.authorId, ...d.mentions, d.event?.toId ?? '']));
    const me = s?.userId;
    const editUntil = Date.now() - NOTE_EDIT_MINUTES * 60_000;
    return docs.map((d) => ({
      id: d._id,
      kind: d.kind,
      text: d.text,
      mentions: d.mentions.map((m) => ({ id: m, name: names.get(m) ?? m })),
      authorId: d.authorId,
      authorName: names.get(d.authorId) ?? (d.authorId === 'token' ? 'Hệ thống' : d.authorId),
      createdAt: d.createdAt.toISOString(),
      editedAt: d.editedAt?.toISOString() ?? null,
      canEdit: d.kind === 'note' && !!me && d.authorId === me && d.createdAt.getTime() >= editUntil,
      ...(d.event ? { event: { type: d.event.type, toId: d.event.toId, toName: d.event.toId ? (names.get(d.event.toId) ?? null) : null, reason: d.event.reason } } : {}),
    }));
  }

  /** Saves a note; people @mentioned who see the conversation get a notice (never the note text in the title). */
  async addNote(id: string, input: NoteInput, s: Subject | undefined): Promise<ConversationNote> {
    const c = await this.conversation(id);
    const me = this.actor(s);
    const mentions: string[] = [];
    for (const m of [...new Set(input.mentions)]) if (m !== me && (await this.sees(m, c.uid, id))) mentions.push(m);
    const doc: NoteDoc = { _id: newId('cn_'), uid: c.uid, threadId: c.threadId, kind: 'note', text: input.text, mentions, authorId: me, createdAt: new Date() };
    await this.notesCol().insertOne(doc);
    await this.db.audit(`user:${me}`, 'conversation.note', id, { mentions: mentions.length });
    if (mentions.length) {
      const author = (await this.names([me])).get(me) ?? 'Đồng nghiệp';
      await this.notifications
        .notify(mentions, 'note.mention', `${author} nhắc bạn trong ghi chú nội bộ ở hội thoại ${await this.title(id)}`, `/conversations/${encodeURIComponent(id)}?note=${doc._id}`)
        .catch(() => undefined);
    }
    return (await this.notes(id, s)).find((n) => n.id === doc._id)!;
  }

  private async ownNote(id: string, noteId: string, s: Subject | undefined): Promise<NoteDoc> {
    const { uid, threadId } = split(id);
    const n = await this.notesCol().findOne({ _id: noteId, uid, threadId, kind: 'note', deletedAt: { $exists: false } });
    if (!n) throw new NotFoundException('Không tìm thấy ghi chú');
    if (!s || n.authorId !== s.userId) throw new ForbiddenException('Chỉ người viết mới sửa hoặc xóa được ghi chú.');
    if (n.createdAt.getTime() < Date.now() - NOTE_EDIT_MINUTES * 60_000) throw new ForbiddenException(`Ghi chú chỉ sửa hoặc xóa được trong ${NOTE_EDIT_MINUTES} phút sau khi viết.`);
    return n;
  }

  async editNote(id: string, noteId: string, text: string, s: Subject | undefined): Promise<ConversationNote> {
    await this.ownNote(id, noteId, s);
    await this.notesCol().updateOne({ _id: noteId }, { $set: { text, editedAt: new Date() } });
    await this.db.audit(`user:${this.actor(s)}`, 'conversation.note_edit', id, { noteId });
    return (await this.notes(id, s)).find((n) => n.id === noteId)!;
  }

  async deleteNote(id: string, noteId: string, s: Subject | undefined): Promise<{ ok: true }> {
    await this.ownNote(id, noteId, s);
    await this.notesCol().updateOne({ _id: noteId }, { $set: { deletedAt: new Date() } });
    await this.db.audit(`user:${this.actor(s)}`, 'conversation.note_delete', id, { noteId });
    return { ok: true };
  }

  // ---------------------------------------------------------------- labels

  async labels(): Promise<ConversationLabel[]> {
    const docs = await this.labelsCol().find({}).sort({ name: 1 }).toArray();
    return docs.map((d) => ({ id: d._id, name: d.name, color: d.color }));
  }

  /** New label; the same name (any case) returns the existing one. */
  async createLabel(input: LabelInput, s: Subject | undefined): Promise<ConversationLabel> {
    const same = (await this.labelsCol().find({}).toArray()).find((d) => d.name.toLocaleLowerCase('vi') === input.name.toLocaleLowerCase('vi'));
    if (same) return { id: same._id, name: same.name, color: same.color };
    const doc: LabelDoc = { _id: newId('lb_'), name: input.name, color: input.color, createdBy: this.actor(s), createdAt: new Date() };
    await this.labelsCol().insertOne(doc);
    await this.db.audit(`user:${this.actor(s)}`, 'conversation_label.create', doc._id, { name: input.name });
    return { id: doc._id, name: doc.name, color: doc.color };
  }

  async updateLabel(labelId: string, input: LabelInput, s: Subject | undefined): Promise<ConversationLabel> {
    const r = await this.labelsCol().findOneAndUpdate({ _id: labelId }, { $set: { name: input.name, color: input.color } }, { returnDocument: 'after' });
    if (!r) throw new NotFoundException('Không tìm thấy nhãn');
    await this.db.audit(`user:${this.actor(s)}`, 'conversation_label.update', labelId, { name: input.name });
    return { id: r._id, name: r.name, color: r.color };
  }

  /** Deletes a label and takes it off every conversation (including ones outside the caller's channels). */
  async deleteLabel(labelId: string, s: Subject | undefined): Promise<{ ok: true }> {
    const r = await this.labelsCol().deleteOne({ _id: labelId });
    if (!r.deletedCount) throw new NotFoundException('Không tìm thấy nhãn');
    await runUnscoped(() => this.db.col(C.conversations).updateMany({ vcLabels: labelId } as never, { $pull: { vcLabels: labelId } } as never));
    await this.db.audit(`user:${this.actor(s)}`, 'conversation_label.delete', labelId);
    return { ok: true };
  }

  async setLabels(id: string, labelIds: string[], s: Subject | undefined): Promise<ConversationLabel[]> {
    await this.conversation(id);
    const want = [...new Set(labelIds)];
    if (want.length > LABELS_PER_CONVERSATION) throw new BadRequestException(`Tối đa ${LABELS_PER_CONVERSATION} nhãn mỗi hội thoại.`);
    const found = await this.labelsCol().find({ _id: { $in: want } }).toArray();
    if (found.length !== want.length) throw new BadRequestException('Có nhãn không còn tồn tại, tải lại trang rồi chọn lại.');
    await this.db.col(C.conversations).updateOne({ _id: id } as never, { $set: { vcLabels: want } });
    await this.db.audit(`user:${this.actor(s)}`, 'conversation.labels', id, { labels: want.length });
    const byId = new Map(found.map((d) => [d._id, d]));
    return want.map((x) => byId.get(x)!).map((d) => ({ id: d._id, name: d.name, color: d.color }));
  }
}
