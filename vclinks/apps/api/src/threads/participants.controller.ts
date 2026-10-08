import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { C, DbService } from '../db/db.service';

export interface Participant {
  uid: string;
  /** Name as Zalo shows it above their bubbles (what Zalo's @ list shows too). */
  name: string;
  messages: number;
}

/**
 * People who wrote in a conversation, most active first, then the group's
 * other members who have not written yet: the Dashboard's suggestions for
 * @mentions and name cards. Names come from the bubbles (senderName) or, for
 * silent members, from their 1-1 conversation as captured from the Zalo
 * sidebar — both are what Zalo Web lists in the same group's @ list.
 */
@Controller('conversations')
export class ParticipantsController {
  constructor(private readonly db: DbService) {}

  @Get(':id/participants')
  async list(@Param('id') id: string): Promise<Participant[]> {
    const i = id.indexOf(':');
    if (i <= 0 || i === id.length - 1 || id.length > 260) throw new BadRequestException('Mã hội thoại không hợp lệ');
    const uid = id.slice(0, i);
    const threadId = id.slice(i + 1);
    const rows = await this.db
      .col(C.messages)
      .aggregate<{ _id: string; name: string | null; n: number }>([
        { $match: { uid, threadId, fromUid: { $nin: ['0', null] }, senderName: { $type: 'string', $ne: '' } } },
        { $sort: { sentAt: -1 } },
        { $group: { _id: '$fromUid', name: { $first: '$senderName' }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 200 },
      ])
      .toArray();
    const out = rows.filter((r) => r.name).map((r) => ({ uid: String(r._id), name: String(r.name), messages: r.n }));
    const seen = new Set(out.map((p) => p.uid));
    seen.add(uid);
    const group = await this.db.col(C.groups).findOne({ _id: `${uid}:${threadId}` as never }, { projection: { memberIds: 1 } });
    const members = ((group?.memberIds as string[] | undefined) ?? []).map(String).filter((m) => !seen.has(m)).slice(0, 500);
    if (members.length) {
      const ids = members.map((m) => `${uid}:${m}`);
      const [convs, contacts] = await Promise.all([
        this.db.col(C.conversations).find({ _id: { $in: ids as never[] } }, { projection: { threadId: 1, name: 1 } }).toArray(),
        this.db.col(C.contacts).find({ _id: { $in: ids as never[] }, encrypted: { $ne: true } }, { projection: { userId: 1, displayName: 1, zaloName: 1 } }).toArray(),
      ]);
      const byConv = new Map(convs.map((c) => [String(c.threadId), c.name as string | undefined]));
      const byContact = new Map(contacts.map((c) => [String(c.userId), (c.displayName || c.zaloName) as string | undefined]));
      for (const m of members) {
        const name = byConv.get(m) || byContact.get(m);
        if (name) out.push({ uid: m, name: String(name), messages: 0 });
      }
    }
    return out;
  }
}
