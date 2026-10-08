#!/usr/bin/env node
'use strict';
/**
 * Regenerates the PERMISSION_KEYS / PERMISSION_INFO / ROLE_MATRIX block of packages/shared/src/permissions.ts
 * from the spec matrix (docs/02-yeu-cau/dac-ta/01-phan-quyen.md §3). Run after the spec changes:
 *   node tools/authz/gen-permissions.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { COLUMNS, parseMatrix } = require('./matrix-source');

const TARGET = path.resolve(__dirname, '../../packages/shared/src/permissions.ts');
const OPEN = '// <generated:permissions> — node tools/authz/gen-permissions.js';
const CLOSE = '// </generated:permissions>';

const { keys, cells } = parseMatrix();
const q = (s) => JSON.stringify(s);
const cellTs = (c) => {
  const parts = [`s: ${q(c.s)}`];
  if (c.log) parts.push('log: true');
  if (c.mode) parts.push(`mode: ${q(c.mode)}`);
  if (c.cond) parts.push(`cond: ${q(c.cond)}`);
  if (c.notSelf) parts.push('notSelf: true');
  if (c.reveal) parts.push(`reveal: ${q(c.reveal)}`);
  return `{ ${parts.join(', ')} }`;
};

const out = [OPEN, '/* eslint-disable */', '/** Every permission key of the spec §3, in spec order. */'];
out.push('export const PERMISSION_KEYS = [');
for (const k of keys) out.push(`  ${q(k.key)},`);
out.push('] as const;', 'export type PermissionKey = (typeof PERMISSION_KEYS)[number];', '');
out.push('/** Label ("Chức năng") and spec section of each key, for the role matrix screen (MH-PQ-05). */');
out.push('export const PERMISSION_INFO: Record<PermissionKey, { label: string; section: string }> = {');
for (const k of keys) out.push(`  ${q(k.key)}: { label: ${q(k.label)}, section: ${q(k.section)} },`);
out.push('};', '');
out.push('/** System roles → key → cell. Keys absent for a role are ✖. */');
out.push('export const ROLE_MATRIX: Record<RoleKey, Partial<Record<PermissionKey, PermCell>>> = {');
for (const role of COLUMNS) {
  out.push(`  ${role}: {`);
  for (const k of keys) {
    const c = cells[k.key][role].cell;
    if (c.s && (c.s.length || (c.reveal && c.reveal.length))) out.push(`    ${q(k.key)}: ${cellTs(c)},`);
  }
  out.push('  },');
}
out.push('};', CLOSE);

const src = fs.readFileSync(TARGET, 'utf8');
const a = src.indexOf(OPEN);
const b = src.indexOf(CLOSE);
if (a < 0 || b < 0) throw new Error('Không thấy vùng sinh tự động trong permissions.ts');
fs.writeFileSync(TARGET, src.slice(0, a) + out.join('\n') + src.slice(b + CLOSE.length));
console.log(`permissions.ts: ${keys.length} khóa, ${COLUMNS.length} vai trò.`);
