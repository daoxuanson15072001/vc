import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './app.factory';

process.env.TZ ??= 'Asia/Ho_Chi_Minh';

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`VClinks API on :${port} (REST /api, MCP /mcp, dev MCP /mcp/dev)`, 'Bootstrap');
}

void bootstrap();
