/** pnpm settings:set <khoá> <giá trị JSON> --reason "…" — sửa cài đặt hệ thống, ghi nhật ký (kế hoạch GĐ B phiên B-03). */
import { randomBytes } from 'node:crypto';
import { SETTINGS } from '@vc/contracts';
import { SYSTEM } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { toolContext } from './context';

async function main(): Promise<number> {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const ri = args.indexOf('--reason');
  const reason = ri >= 0 ? args[ri + 1] : '';
  const [key, raw] = args.filter((_, i) => i !== ri && i !== ri + 1);
  if (!key) {
    for (const [k, d] of Object.entries(SETTINGS)) console.log(`${k}\tmặc định ${JSON.stringify(d.default)}${(d as { readOnly?: boolean }).readOnly ? '\t(chỉ đọc)' : ''}\t${d.label}`);
    return 0;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = raw;
  }
  const app = await toolContext();
  try {
    await app.get(SettingsService).set(key, value, reason, { ...SYSTEM, sub: process.env.USER ? `cli:${process.env.USER}` : 'cli' }, {
      correlationId: `cli-${randomBytes(6).toString('hex')}`,
      source: 'script',
    });
    console.log(`Đã lưu ${key} = ${JSON.stringify(value)}`);
    return 0;
  } finally {
    await app.close();
  }
}

main().then(
  (code) => process.exit(code),
  (e: Error) => {
    console.error(`Lỗi: ${e.message}`);
    process.exit(1);
  },
);
