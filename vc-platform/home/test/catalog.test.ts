import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCatalog } from '../scripts/build-catalog.js';

const prod = readFileSync(new URL('../apps.yaml', import.meta.url), 'utf8');
const dev = readFileSync(new URL('../apps.dev.yaml', import.meta.url), 'utf8');
const app = (x: Record<string, unknown>) =>
  `version: 1\napps:\n  - ${Object.entries({ key: 'vcx', name: 'VCx', description: 'Mô tả', url: 'https://x.vcprosperous.com/', icon: '/icons/vcx.svg', group: 'app-vcx', status: 'live', order: 1, ...x })
    .map(([k, v]) => `${k}: ${v === null ? 'null' : JSON.stringify(v)}`)
    .join('\n    ')}\n`;

test('apps.yaml production: URL mặc định https, sắp theo order, không có app mẫu', () => {
  const c = buildCatalog([prod], {});
  assert.deepEqual(c.apps.map((a) => a.key), ['vclinks', 'vcwiki', 'vcsale']);
  assert.equal(c.apps[0].url, 'https://vclink.tramaphutung.com/');
  assert.equal(c.apps[2].url, null);
});

test('Dev: URL theo biến môi trường, thêm app mẫu từ apps.dev.yaml', () => {
  const c = buildCatalog([prod, dev], { VCLINKS_URL: 'http://localhost:3000' });
  assert.equal(c.apps[0].url, 'http://localhost:3000/');
  assert.equal(c.apps.at(-1)?.group, 'app-app-mau');
});

test('Từ chối: http ngoài localhost, thiếu url với app live, khoá sai mẫu, trường lạ, trùng nhóm', () => {
  assert.throws(() => buildCatalog([app({ url: 'http://x.vcprosperous.com/' })], {}), /https/);
  assert.throws(() => buildCatalog([app({ url: null })], {}), /url bắt buộc/);
  assert.doesNotThrow(() => buildCatalog([app({ url: null, status: 'coming_soon' })], {}));
  assert.throws(() => buildCatalog([app({ key: 'VC-X' })], {}), /key/);
  assert.throws(() => buildCatalog([app({ email: 'lan@vcprosperous.com' })], {}), /Unrecognized key/);
  assert.throws(() => buildCatalog([app({}), app({ key: 'vcy' })], {}), /group trùng/);
  assert.throws(() => buildCatalog([app({ status: 'an' })], {}), /status/);
});
