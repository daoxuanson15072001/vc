import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { OutboxItem } from '@vclinks/shared';
import { IngestService } from '../../ingest/ingest.service';
import { ChannelSenderRegistry, type ChannelSendResult, type ChannelSender } from '../channel-sender';
import { CredentialsService } from '../credentials.service';
import { TOKEN_ERROR_CODES, ZaloApiError, sendCsText } from './zalo-api';
import { ZaloOaReconnectError, ZaloOaTokenService } from './zalo-oa.tokens';

/** Zalo OA error codes (developers.zalo.me, "Mã lỗi Official Account API") → short Vietnamese reasons. */
const ERROR_REASONS: Record<number, string> = {
  [-32]: 'Vượt giới hạn tốc độ gọi API của Zalo, hãy thử lại sau',
  [-200]: 'Zalo báo gửi tin thất bại',
  [-201]: 'Tham số không hợp lệ (người nhận hoặc nội dung)',
  [-204]: 'OA đã bị xóa',
  [-205]: 'OA không tồn tại',
  [-209]: 'Ứng dụng Zalo chưa được kích hoạt',
  [-210]: 'Nội dung vượt giới hạn cho phép (tối đa 2.000 ký tự)',
  [-211]: 'OA đã hết hạn mức (quota) gửi tin',
  [-212]: 'Ứng dụng chưa đăng ký API gửi tin OA',
  [-213]: 'Người dùng chưa quan tâm OA',
  [-216]: 'Access token OA không hợp lệ, cần kết nối lại OA',
  [-218]: 'Đã quá giới hạn số tin gửi đến người dùng này',
  [-219]: 'Ứng dụng Zalo đã bị gỡ hoặc vô hiệu hóa',
  [-220]: 'Access token OA đã hết hạn, cần kết nối lại OA',
  [-223]: 'OA chưa cấp quyền gửi tin cho ứng dụng',
  [-224]: 'OA chưa mua gói dịch vụ cần cho tính năng này',
  [-227]: 'Tài khoản khách bị khóa hoặc không online quá 45 ngày',
  [-230]: 'Khách không tương tác với OA trong 7 ngày qua, không gửi được tin tư vấn',
  [-232]: 'Khách chưa tương tác hoặc tương tác cuối đã quá hạn, không gửi được tin tư vấn',
  [-244]: 'Khách đã chặn nhận loại tin này từ OA',
  [-248]: 'Tin bị chặn do vi phạm tiêu chuẩn nền tảng Zalo',
  [-320]: 'Tin ngoài khung 48h tính phí: ứng dụng chưa liên kết Zalo Cloud Account',
  [-321]: 'Tin ngoài khung 48h tính phí: Zalo Cloud Account hết tiền hoặc không trừ được phí',
};

export function reasonFor(e: unknown): string {
  if (e instanceof ZaloOaReconnectError) return 'OA cần được kết nối lại trên trang Kênh kết nối';
  if (e instanceof ZaloApiError) {
    if (e.transient || e.code === 0) return 'Không kết nối được Zalo, hãy thử lại sau';
    return ERROR_REASONS[e.code] ?? `Zalo từ chối gửi tin (mã ${e.code})`;
  }
  return 'Lỗi không rõ khi gửi qua Zalo OA';
}

/**
 * Sends approved outbox items of Zalo OA accounts as customer-service text
 * (`/v3.0/oa/message/cs`). On a token error the tokens are refreshed once
 * (serialized in ZaloOaTokenService) and the send retried once. The sent
 * message is ingested right away (fromUid '0'); Zalo's `oa_send_text` echo
 * later upserts the same msgId.
 */
@Injectable()
export class ZaloOaSender implements ChannelSender, OnModuleInit {
  readonly channel = 'zalo_oa' as const;
  private readonly logger = new Logger(ZaloOaSender.name);

  constructor(
    private readonly registry: ChannelSenderRegistry,
    private readonly tokens: ZaloOaTokenService,
    private readonly credentials: CredentialsService,
    private readonly ingest: IngestService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async send(item: OutboxItem): Promise<ChannelSendResult> {
    if (!this.credentials.available) return { ok: false, error: 'Máy chủ chưa cấu hình CREDENTIALS_KEY' };
    const uid = item.uid;
    let sent: { messageId: string; sentTime?: number };
    try {
      let token = await this.tokens.getAccessToken(uid);
      try {
        sent = await sendCsText(token, item.threadId, item.text);
      } catch (e) {
        if (!(e instanceof ZaloApiError) || !TOKEN_ERROR_CODES.has(e.code)) throw e;
        token = await this.tokens.refresh(uid, token);
        sent = await sendCsText(token, item.threadId, item.text);
      }
    } catch (e) {
      if (e instanceof ZaloApiError && TOKEN_ERROR_CODES.has(e.code)) {
        await this.tokens.markReconnect(uid, 'Access token bị từ chối sau khi làm mới');
      }
      const reason = reasonFor(e);
      this.logger.warn(`[${uid}] send failed: ${e instanceof ZaloApiError ? `code ${e.code}` : reason}`);
      return { ok: false, error: reason };
    }

    try {
      await this.ingest.ingest('messages', uid, [
        {
          msgId: sent.messageId,
          threadId: item.threadId,
          fromUid: '0',
          toUid: item.threadId,
          msgType: 'oa_send_text',
          text: item.text,
          sentAt: sent.sentTime ?? Date.now(),
          contentStatus: 'complete',
        },
      ]);
    } catch (e) {
      // The send succeeded; the webhook echo will still record the message.
      this.logger.warn(`[${uid}] could not record sent message: ${e instanceof Error ? e.constructor.name : 'error'}`);
    }
    return { ok: true, externalMsgId: sent.messageId };
  }
}
