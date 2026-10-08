import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changed } from '../src/apply.js';
import { deepMerge, substituteEnv } from '../src/config.js';

test('substituteEnv thay biến và giá trị mặc định', () => {
  assert.equal(substituteEnv('a=${A} b=${B:-x}', { A: '1' }), 'a=1 b=x');
  assert.throws(() => substituteEnv('${THIEU}', {}), /THIEU/);
});

test('deepMerge gộp mảng theo khoá (client theo clientId, mapper theo name)', () => {
  const base = { clients: [{ clientId: 'a', redirectUris: ['x'], attributes: { k: '1' } }, { clientId: 'b' }] };
  const over = { clients: [{ clientId: 'a', attributes: { j: '2' } }, { clientId: 'c' }] };
  const m = deepMerge(base, over) as any;
  assert.deepEqual(m.clients.map((c: any) => c.clientId), ['a', 'b', 'c']);
  assert.deepEqual(m.clients[0].attributes, { k: '1', j: '2' });
  assert.deepEqual(m.clients[0].redirectUris, ['x']);
});

test('changed bỏ qua trường không khai, thứ tự mảng, kiểu chuỗi của Keycloak và giá trị rỗng bị bỏ', () => {
  assert.equal(changed({ a: 1, b: 2 }, { a: 1 }), false);
  assert.equal(changed({ l: ['y', 'x'] }, { l: ['x', 'y'] }), false);
  assert.equal(changed({ c: { v: 'true' } }, { c: { v: true } }), false);
  assert.equal(changed({ c: {} }, { c: { v: '' } }), false);
  assert.equal(changed({ a: 1 }, { a: 2 }), true);
  assert.equal(changed({ l: ['x'] }, { l: ['x', 'y'] }), true);
});
