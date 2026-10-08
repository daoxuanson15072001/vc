// Bundles the VClinks extension into ./build (load it unpacked in Chrome).
// Usage: node build.mjs [--watch]
// Each successful build writes build/build-id.json; the unpacked extension polls it
// and reloads itself when it changes (see background.ts, dev auto-reload).
import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'build');
const watch = process.argv.includes('--watch');

// ---- placeholder icons: solid PNGs generated at build time (no binaries in git)
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Blue rounded-ish square with a white "Z"-like diagonal, RGBA. */
function iconPng(size) {
  const rows = [];
  const r = Math.max(2, Math.round(size * 0.18));
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter: none
    for (let x = 0; x < size; x++) {
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      const outside = cx < r && cy < r && (r - cx) ** 2 + (r - cy) ** 2 > r * r;
      const m = Math.max(1, Math.round(size * 0.22));
      const t = Math.max(1, Math.round(size * 0.12));
      const inZ =
        x >= m && x < size - m && y >= m && y < size - m &&
        (y < m + t || y >= size - m - t || Math.abs(x + y - (size - 1)) < t);
      if (outside) row.push(0, 0, 0, 0);
      else if (inZ) row.push(255, 255, 255, 255);
      else row.push(0, 104, 255, 255);
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function copyStatic() {
  mkdirSync(join(out, 'icons'), { recursive: true });
  copyFileSync(join(root, 'manifest.json'), join(out, 'manifest.json'));
  copyFileSync(join(root, 'popup.html'), join(out, 'popup.html'));
  for (const s of [16, 48, 128]) writeFileSync(join(out, 'icons', `icon${s}.png`), iconPng(s));
}

/** Marks a new build so the running unpacked extension reloads itself. */
function writeBuildId() {
  const id = new Date().toISOString();
  writeFileSync(join(out, 'build-id.json'), JSON.stringify({ id }));
  console.log(`build-id ${id}`);
}

const common = {
  bundle: true,
  target: 'chrome116',
  logLevel: 'info',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  legalComments: 'none',
};

const configs = [
  { ...common, entryPoints: [join(root, 'src/background.ts')], outfile: join(out, 'background.js'), format: 'esm' },
  { ...common, entryPoints: [join(root, 'src/content.ts')], outfile: join(out, 'content.js'), format: 'iife' },
  // MAIN world (page context): hands approved files to Zalo's file inputs.
  { ...common, entryPoints: [join(root, 'src/file-hook-main.ts')], outfile: join(out, 'file-hook.js'), format: 'iife' },
  { ...common, entryPoints: [join(root, 'src/messenger/content.ts')], outfile: join(out, 'messenger.js'), format: 'iife' },
  { ...common, entryPoints: [join(root, 'src/popup.ts')], outfile: join(out, 'popup.js'), format: 'iife' },
];

mkdirSync(out, { recursive: true });
copyStatic();

if (watch) {
  // The bundles rebuild together; stamp the build id once they have all settled,
  // and never after a failed build (the old code keeps running).
  let stampTimer;
  let failed = false;
  const copyPlugin = {
    name: 'copy-static',
    setup: (b) =>
      b.onEnd((result) => {
        copyStatic();
        if (result.errors.length) failed = true;
        clearTimeout(stampTimer);
        stampTimer = setTimeout(() => {
          if (!failed) writeBuildId();
          failed = false;
        }, 500);
      }),
  };
  const ctxs = await Promise.all(configs.map((c) => esbuild.context({ ...c, plugins: [copyPlugin] })));
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log('Watching for changes (manifest/popup.html are re-copied on each rebuild)...');
} else {
  await Promise.all(configs.map((c) => esbuild.build(c)));
  writeBuildId();
}
