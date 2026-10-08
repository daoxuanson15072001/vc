import { parseArgs } from 'node:util';
import { RealmApplier } from './apply.js';
import { loadSpec } from './config.js';
import { KcAdmin, kcAuthFromEnv } from './kc.js';

const LABEL = { tao: 'Tạo', sua: 'Sửa', giu: 'Giữ', xoa: 'Xoá', bao: 'Báo' } as const;

const { values } = parseArgs({
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
const applier = new RealmApplier(new KcAdmin(kcAuthFromEnv()), spec, values['dry-run'], values['force-secrets']);
try {
  const log = await applier.run();
  const changes = log.filter((l) => l.action !== 'giu');
  for (const l of values.quiet ? changes : log) console.log(`${LABEL[l.action]}  ${l.what}`);
  console.log(`${values['dry-run'] ? '[thử] ' : ''}Realm ${spec.realm}: ${changes.filter((l) => l.action !== 'bao').length} thay đổi.`);
} catch (e) {
  console.error(`Lỗi khi áp realm ${spec.realm}: ${(e as Error).message}`);
  process.exit(1);
}
