import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { sourceIdOfUid, type OutboxItem } from '@vclinks/shared';
import { C, DbService } from '../../db/db.service';
import { ChannelSenderRegistry, type ChannelSendResult, type ChannelSender } from '../channel-sender';
import { FacebookPageService } from './facebook-page.service';
import { GraphError, graph } from './graph';
import { PAGE_SENDER } from './webhook-mapper';

/** Meta's standard messaging window: a Page may reply within 24h of the customer's last message. */
export const STANDARD_WINDOW_MS = 24 * 3600_000;

const fmtVn = (d: Date) =>
  d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

export const OUTSIDE_WINDOW_ERROR =
  'Ngoài khung 24 giờ của Messenger: chỉ trả lời được trong 24 giờ kể từ tin cuối của khách. Chờ khách nhắn lại (tag HUMAN_AGENT cần Meta duyệt, chưa bật).';

/** Graph Send API error → short Vietnamese reason (never the text, never the token). */
export function graphSendError(e: unknown): string {
  if (!(e instanceof GraphError)) return 'Lỗi không rõ khi gửi qua Graph API';
  if (e.status === 0) return 'Không kết nối được Graph API (mạng hoặc hết thời gian chờ)';
  const { code, subcode } = e;
  if (code === 10 && (subcode === 2018278 || subcode === 2534022)) return OUTSIDE_WINDOW_ERROR;
  if (code === 10 && subcode === 1893063) return 'Fanpage đang bị Meta tạm hạn chế gửi tin';
  if (code === 190) return 'Token Fanpage hết hạn hoặc bị thu hồi, cần kết nối lại Fanpage';
  if (code === 200 || code === 10)
    return 'Thiếu quyền pages_messaging (app chưa qua App Review, hoặc người nhận không phải admin/tester khi app ở chế độ Development)';
  if (code === 551) return 'Khách hiện không nhận tin từ Fanpage (đã chặn hoặc không khả dụng)';
  if (code === 100 && subcode === 2018001) return 'Không tìm thấy người nhận (PSID không hợp lệ với Fanpage này)';
  if (code === 4 || code === 32 || code === 613) return 'Vượt giới hạn gửi của Graph API, sẽ cần thử lại sau';
  return `Graph API từ chối (mã ${code ?? e.status}${subcode != null ? `/${subcode}` : ''})`;
}

/**
 * Sends approved outbox items of Fanpage accounts with the Graph Send API
 * (messaging_type RESPONSE). Only called by OutboxDispatcher on claimed items,
 * which already passed the approval check (CLAUDE.md §12.1).
 *
 * The 24-hour standard window is enforced here before calling Graph, from the
 * last customer message we hold for the thread. Message tags (HUMAN_AGENT,
 * 7 days) are deliberately not used: that tag needs Meta approval.
 */
@Injectable()
export class FacebookPageSender implements ChannelSender, OnModuleInit {
  readonly channel = 'fb_page' as const;
  private readonly logger = new Logger(FacebookPageSender.name);

  constructor(
    private readonly db: DbService,
    private readonly pages: FacebookPageService,
    private readonly registry: ChannelSenderRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async send(item: OutboxItem): Promise<ChannelSendResult> {
    const token = await this.pages.pageToken(item.uid);
    if (!token || !(await this.pages.isConnected(item.uid))) {
      return { ok: false, error: 'Fanpage chưa kết nối hoặc đã ngắt kết nối' };
    }

    const lastInbound = await this.db
      .col(C.messages)
      .find({ uid: item.uid, threadId: item.threadId, fromUid: { $ne: PAGE_SENDER } }, { projection: { sentAt: 1 } })
      .sort({ sentAt: -1 })
      .limit(1)
      .next();
    const lastAt = lastInbound?.sentAt instanceof Date ? lastInbound.sentAt : null;
    if (!lastAt) return { ok: false, error: `${OUTSIDE_WINDOW_ERROR} Chưa có tin nào của khách trong hội thoại.` };
    if (Date.now() - lastAt.getTime() > STANDARD_WINDOW_MS) {
      return { ok: false, error: `${OUTSIDE_WINDOW_ERROR} Tin cuối của khách: ${fmtVn(lastAt)}.` };
    }

    try {
      const r = await graph<{ recipient_id?: string; message_id?: string }>(`${sourceIdOfUid(item.uid)}/messages`, {
        method: 'POST',
        token,
        body: { recipient: { id: item.threadId }, messaging_type: 'RESPONSE', message: { text: item.text } },
      });
      return { ok: true, externalMsgId: r.message_id };
    } catch (e) {
      if (e instanceof GraphError && e.code === 190) await this.pages.markTokenInvalid(item.uid);
      this.logger.warn(`[${item.uid}] send failed: ${e instanceof GraphError ? e.message : 'unexpected error'}`);
      return { ok: false, error: graphSendError(e) };
    }
  }
}
