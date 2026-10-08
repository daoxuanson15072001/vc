import { Module } from '@nestjs/common';
import { FacebookPageController, FacebookWebhookController } from './facebook-page.controller';
import { FacebookPageSender } from './facebook-page.sender';
import { FacebookPageService } from './facebook-page.service';
import { FacebookWebhookService } from './facebook-webhook.service';

/**
 * Facebook Page channel (Messenger Platform / Graph API): connect, webhook ingest, server-side send.
 * Core services (DbService, IngestService, AccountsService, CredentialsService,
 * ChannelSenderRegistry) come from the global CoreModule.
 */
@Module({
  controllers: [FacebookPageController, FacebookWebhookController],
  providers: [FacebookPageService, FacebookWebhookService, FacebookPageSender],
})
export class FacebookPageModule {}
