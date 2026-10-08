/**
 * Creates or revokes a personal bearer token.
 *
 *   pnpm token:create --name "Thọ Anh - dashboard" --scopes dashboard
 *   pnpm token:create --name "Extension Chrome" --scopes ingest
 *   pnpm token:create --name "Claude" --scopes mcp
 *   pnpm token:create --name "Claude Desktop" --scopes dev   (MCP phát triển /mcp/dev)
 *   pnpm token:create --revoke "Extension Chrome"
 *   --tenant <mã>  tenant của token (mặc định DEFAULT_TENANT_ID hoặc vcpv)
 */
import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { SessionService } from '../auth/session.service';
import { SCOPES, Scope, TokenService } from '../auth/token.service';
import { DbService } from '../db/db.service';

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      scopes: { type: 'string' },
      revoke: { type: 'string' },
      tenant: { type: 'string' },
    },
  });
  const db = new DbService();
  await db.onModuleInit();
  const tokens = new TokenService(db, new SessionService(db));
  try {
    if (values.revoke) {
      console.log(`Đã thu hồi ${await tokens.revoke(values.revoke)} token "${values.revoke}".`);
      return;
    }
    const scopes = (values.scopes ?? '').split(',').map((s) => s.trim()).filter(Boolean) as Scope[];
    if (!values.name || !scopes.length || scopes.some((s) => !SCOPES.includes(s))) {
      console.error(`Cách dùng: --name <tên> --scopes <${SCOPES.join('|')}>[,...]  hoặc  --revoke <tên>`);
      process.exitCode = 1;
      return;
    }
    const token = await tokens.create(values.name, scopes, values.tenant || undefined);
    console.log(`Token cho "${values.name}" (${scopes.join(', ')}) — chỉ hiển thị một lần:\n\n${token}\n`);
  } finally {
    await db.onModuleDestroy();
  }
}

void main();
