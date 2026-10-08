import { Module } from '@nestjs/common';
import { ZaloOaController, ZaloOaWebhookController } from './zalo-oa.controller';
import { ZaloOaSender } from './zalo-oa.sender';
import { ZaloOaService } from './zalo-oa.service';
import { ZaloOaTokenService } from './zalo-oa.tokens';
import { ZaloOaWebhookService } from './zalo-oa.webhook.service';

/**
 * Zalo OA channel (Zalo Official Account Open API): OAuth connect, webhook ingest, server-side send.
 * Core services (DbService, IngestService, AccountsService, CredentialsService,
 * ChannelSenderRegistry) come from the global CoreModule. Setup: docs/04-ky-thuat/kenh/zalo-oa.md.
 */
@Module({
  controllers: [ZaloOaController, ZaloOaWebhookController],
  providers: [ZaloOaService, ZaloOaTokenService, ZaloOaWebhookService, ZaloOaSender],
})
export class ZaloOaModule {}
