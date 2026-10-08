import { Injectable } from '@nestjs/common';
import type { Channel, OutboxItem } from '@vclinks/shared';

export interface ChannelSendResult {
  ok: boolean;
  /** Platform message id of the sent message (Graph API mid, Zalo OA message_id). */
  externalMsgId?: string;
  /** Short, fixed reason; never the message text or a token. */
  error?: string;
}

/**
 * Server-side sender of an API channel (Zalo OA, Fanpage). Implementations only
 * ever receive items that passed the approval check (approvedBy + approvedAt):
 * the dispatcher claims each item through OutboxService before calling send().
 */
export interface ChannelSender {
  readonly channel: Channel;
  send(item: OutboxItem): Promise<ChannelSendResult>;
}

/** Channel modules register their sender here on init; the dispatcher looks them up. */
@Injectable()
export class ChannelSenderRegistry {
  private readonly senders = new Map<Channel, ChannelSender>();

  register(sender: ChannelSender) {
    this.senders.set(sender.channel, sender);
  }

  get(channel: Channel): ChannelSender | undefined {
    return this.senders.get(channel);
  }

  channels(): Channel[] {
    return [...this.senders.keys()];
  }
}
