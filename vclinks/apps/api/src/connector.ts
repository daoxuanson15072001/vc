import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './app.factory';
import { ConnectorModule } from './app.module';

process.env.TZ ??= 'Asia/Ho_Chi_Minh';
process.env.VCLINKS_ROLE = 'connector';

/**
 * Connector process (BA §2.2 #7): ingest from the extension, platform webhooks
 * and the outbox (extension pull + OutboxDispatcher), without the Dashboard
 * API or MCP. Run next to a web process started with VCLINKS_ROLE=web, which
 * then leaves sending and token refresh to this process.
 */
async function bootstrap() {
  const app = await createApp({ module: ConnectorModule });
  const port = Number(process.env.CONNECTOR_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  Logger.log(`VClinks connector on :${port} (ingest, webhooks, outbox)`, 'Bootstrap');
}

void bootstrap();
