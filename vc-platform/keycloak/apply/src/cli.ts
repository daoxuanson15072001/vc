import { parseArgs } from 'node:util';
import { RealmApplier } from './apply.js';
import { loadSpec } from './config.js';
import { KcAdmin, kcAuthFromEnv } from './kc.js';

const LABEL = { tao: 'Tạo', sua: 'Sửa', giu: 'Giữ', xoa: 'Xoá', bao: 'Báo' } as const;

// pnpm passes `--` through (`pnpm realm:apply -- --file …`); drop it so the flags are still read as flags.
const { values } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: {
    file: { type: 'string', multiple: true },
    'dry-run': { type: 'boolean', default: false },
    quiet: { type: 'boolean', default: false },
    'force-secrets': { type: 'boolean', default: false },
  },
});

const files = values.file ?? [];
if (!files.length) {
  console.error('Cách dùng: realm-apply --file realm/vc.yaml [--file realm/vc.dev.yaml] [--dry-run] [--force-secrets]');
  process.exit(2);
}

const spec = loadSpec(files);
const kc = new KcAdmin(kcAuthFromEnv());
const applier = new RealmApplier(kc, spec, values['dry-run'], values['force-secrets']);
try {
  await kc.waitReady();
  const log = await applier.run();
  const changes = log.filter((l) => l.action !== 'giu');
  for (const l of values.quiet ? changes : log) console.log(`${LABEL[l.action]}  ${l.what}`);
  console.log(`${values['dry-run'] ? '[thử] ' : ''}Realm ${spec.realm}: ${changes.filter((l) => l.action !== 'bao').length} thay đổi.`);
} catch (e) {
  console.error(`Lỗi khi áp realm ${spec.realm}: ${(e as Error).message}`);
  process.exit(1);
}
