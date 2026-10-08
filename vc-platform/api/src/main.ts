import { createApp } from './app.factory';
import { ENV, type Env } from './config/env';

async function main(): Promise<void> {
  const app = await createApp();
  const env = app.get<Env>(ENV);
  await app.listen(env.PORT, '0.0.0.0');
  process.stdout.write(`${JSON.stringify({ t: new Date().toISOString(), level: 'info', msg: 'listening', port: env.PORT, app_env: env.APP_ENV })}\n`);
}

main().catch((e: Error) => {
  process.stderr.write(`${JSON.stringify({ t: new Date().toISOString(), level: 'error', msg: 'start_failed', error: e.message })}\n`);
  process.exit(1);
});
