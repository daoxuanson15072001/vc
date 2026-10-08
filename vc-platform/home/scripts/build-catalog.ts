/**
 * apps.yaml (+ các tệp trong CATALOG_EXTRA_FILES, cách nhau dấu phẩy) → public/catalog.json.
 * Sai schema hoặc thiếu biểu tượng thì dừng với mã 1, không ghi tệp.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { substituteEnv } from '@vc/realm-apply/config';
import { Catalog, type CatalogT } from './catalog-schema.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Later files replace apps with the same key. */
export function buildCatalog(texts: string[], env: NodeJS.ProcessEnv = process.env): CatalogT {
  const byKey = new Map<string, unknown>();
  for (const t of texts) {
    const doc = parse(substituteEnv(t, env)) as { version?: unknown; apps?: { key: string }[] };
    if (doc?.version !== 1) throw new Error('Tệp danh mục phải có version: 1');
    for (const a of doc.apps ?? []) byKey.set(a.key, a);
  }
  const res = Catalog.safeParse({ version: 1, apps: [...byKey.values()] });
  if (!res.success) throw new Error(res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
  res.data.apps.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  return res.data;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = ['apps.yaml', ...(process.env.CATALOG_EXTRA_FILES ?? '').split(',').map((s) => s.trim()).filter(Boolean)];
  try {
    const catalog = buildCatalog(files.map((f) => readFileSync(join(ROOT, f), 'utf8')));
    const missing = catalog.apps.filter((a) => !existsSync(join(ROOT, 'public', a.icon)));
    if (missing.length) throw new Error(`Thiếu biểu tượng: ${missing.map((a) => a.icon).join(', ')}`);
    const out = join(ROOT, 'public/catalog.json');
    writeFileSync(`${out}.tmp`, `${JSON.stringify(catalog, null, 2)}\n`);
    renameSync(`${out}.tmp`, out);
    console.log(`catalog.json: ${catalog.apps.length} app (${files.join(', ')})`);
  } catch (e) {
    console.error(`Danh mục app sai:\n${(e as Error).message}`);
    process.exitCode = 1;
  }
}
