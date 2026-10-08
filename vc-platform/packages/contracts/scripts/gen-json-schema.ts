/** Writes json-schema/<name>.json for every schema in PUBLISHED (gửi đội app, 07). `--check` fails when a file is stale. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PUBLISHED } from '../src/schemas.js';

// Run from the package directory (pnpm scripts do).
const dir = join(process.cwd(), 'json-schema');
const check = process.argv.includes('--check');
let stale = 0;
for (const [name, schema] of Object.entries(PUBLISHED)) {
  const file = join(dir, `${name}.json`);
  const text = `${JSON.stringify(zodToJsonSchema(schema, { name, $refStrategy: 'none' }), null, 2)}\n`;
  if (check) {
    let cur = '';
    try {
      cur = readFileSync(file, 'utf8');
    } catch {}
    if (cur !== text) {
      console.error(`JSON Schema cũ: ${file} (chạy pnpm --filter @vc/contracts json-schema)`);
      stale++;
    }
  } else {
    writeFileSync(file, text);
    console.log(`Đã ghi ${file}`);
  }
}
process.exitCode = stale ? 1 : 0;
