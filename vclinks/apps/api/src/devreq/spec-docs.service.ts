import { Injectable, NotFoundException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Characters per page returned by read_ba / get_system_spec. */
export const PAGE = 12_000;

/** Topics of get_system_spec → repo files describing what the code does today. */
export const SPEC_TOPICS = {
  overview: ['CLAUDE.md'],
  rest: ['docs/04-ky-thuat/api/rest-api.md'],
  mcp: ['docs/04-ky-thuat/api/mcp-client-guide.md'],
  channels: [
    'docs/04-ky-thuat/kenh/zalo-oa.md',
    'docs/04-ky-thuat/kenh/facebook-page.md',
    'docs/04-ky-thuat/kenh/facebook-personal.md',
  ],
  zalo: ['docs/04-ky-thuat/zalo-web/zalo-web-feature-map.md', 'docs/04-ky-thuat/zalo-web/zalo-web-extraction.md'],
  driver: ['docs/06-van-hanh/chrome-driver.md'],
} as const;
/** Requirements folder (docs layout: CLAUDE.md §13). */
const BA_DIR = 'docs/02-yeu-cau';
const BA_MASTER = `${BA_DIR}/vclinks-ba.md`;
const BA_EXTRA = ['docs/01-quan-ly-du-an/quyet-dinh-chu-du-an.md', 'docs/05-kiem-thu/du-lieu-kiem-thu.md'];

export type SpecTopic = keyof typeof SPEC_TOPICS | 'progress';

/** Accent-insensitive, lowercase (Vietnamese đ included). */
const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

function findRepoRoot(): string {
  if (process.env.VCLINKS_REPO_ROOT) return process.env.VCLINKS_REPO_ROOT;
  let dir = __dirname;
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const up = dirname(dir);
    if (up === dir) return process.cwd();
    dir = up;
  }
  return dir;
}

function page(text: string, offset: number) {
  const chunk = text.slice(offset, offset + PAGE);
  const next = offset + PAGE < text.length ? offset + PAGE : null;
  return { length: text.length, offset, nextOffset: next, text: chunk };
}

/**
 * Read-only view of the BA documents (business intent) and of the repo docs
 * that describe the current system. Only whitelisted markdown files under
 * `docs/` and the root CLAUDE.md are ever read; no path comes from the caller.
 */
@Injectable()
export class SpecDocsService {
  readonly root = findRepoRoot();

  /**
   * BA files: the master BA first, then every markdown file under the
   * requirements folder (specs and review records), then the owner's decision
   * register and the shared test dataset, which live in their own folders.
   */
  baFiles(): string[] {
    const files = existsSync(join(this.root, BA_MASTER)) ? [BA_MASTER] : [];
    const walk = (dir: string) => {
      const abs = join(this.root, dir);
      if (!existsSync(abs)) return;
      for (const e of readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (e.isDirectory()) walk(`${dir}/${e.name}`);
        else if (e.name.endsWith('.md') && `${dir}/${e.name}` !== BA_MASTER) files.push(`${dir}/${e.name}`);
      }
    };
    walk(BA_DIR);
    for (const f of BA_EXTRA) if (existsSync(join(this.root, f))) files.push(f);
    return files;
  }

  private read(file: string): string {
    return readFileSync(join(this.root, file), 'utf8');
  }

  /** Accepts a full path from the table of contents or a unique fragment such as "03-sale". */
  private resolve(file: string): string {
    const files = this.baFiles();
    if (files.includes(file)) return file;
    const hits = files.filter((f) => fold(f).includes(fold(file)));
    if (hits.length === 1) return hits[0];
    throw new NotFoundException(
      hits.length ? `"${file}" khớp nhiều file: ${hits.join(', ')}` : `Không có file BA "${file}" — gọi read_ba không tham số để xem mục lục`,
    );
  }

  /** No file: table of contents (files + ## headings). File: its text, or one section of it. */
  readBa(opts: { file?: string; section?: string; offset?: number }) {
    if (!opts.file) {
      return {
        root: 'docs/',
        files: this.baFiles().map((f) => ({
          file: f,
          headings: this.read(f)
            .split('\n')
            .filter((l) => /^#{1,2} /.test(l))
            .map((l) => l.replace(/^#+ /, '')),
        })),
      };
    }
    const file = this.resolve(opts.file);
    let text = this.read(file);
    if (opts.section) {
      text = this.section(text, opts.section) ?? '';
      if (!text) throw new NotFoundException(`Không có mục "${opts.section}" trong ${file}`);
    }
    return { file, ...(opts.section ? { section: opts.section } : {}), ...page(text, opts.offset ?? 0) };
  }

  /** The first heading whose text contains `wanted` (accent-insensitive), down to the next heading of the same or higher level. */
  private section(text: string, wanted: string): string | null {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^#{1,6} /.test(l) && fold(l).includes(fold(wanted)));
    if (start < 0) return null;
    const level = lines[start].match(/^#+/)![0].length;
    const end = lines.findIndex((l, i) => i > start && new RegExp(`^#{1,${level}} `).test(l));
    return lines.slice(start, end < 0 ? undefined : end).join('\n');
  }

  /** Accent-insensitive line search across the BA files; each hit carries its file, line and enclosing heading. */
  searchBa(query: string, limit = 40) {
    const q = fold(query.trim());
    const hits: { file: string; line: number; heading: string; text: string }[] = [];
    for (const file of this.baFiles()) {
      let heading = '';
      this.read(file)
        .split('\n')
        .forEach((l, i) => {
          if (/^#{1,6} /.test(l)) heading = l.replace(/^#+ /, '');
          if (hits.length < limit && fold(l).includes(q)) hits.push({ file, line: i + 1, heading, text: l.slice(0, 400) });
        });
    }
    return { query, hits, truncated: hits.length >= limit };
  }

  /** Current state from the repo: topic docs, or `progress` = recent commits and active branches. */
  async systemSpec(topic: SpecTopic | undefined, offset = 0) {
    if (!topic) {
      return {
        topics: {
          overview: 'CLAUDE.md: kiến trúc, mô hình dữ liệu, giai đoạn, nguyên tắc bắt buộc',
          rest: 'REST API hiện có',
          mcp: 'Tool MCP vận hành (ingest, mapping, gửi tin)',
          channels: 'Kênh Zalo OA, Fanpage, Facebook cá nhân',
          zalo: 'Tính năng Zalo Web và cách extension đọc dữ liệu',
          driver: 'Chrome driver (máy thu/gửi Zalo)',
          progress: 'Commit gần nhất trên main và các nhánh đang làm',
        },
      };
    }
    if (topic === 'progress') {
      const git = (...args: string[]) => run('git', args, { cwd: this.root }).then((r) => r.stdout.trim(), () => '');
      const [main, branches] = await Promise.all([
        git('log', 'main', '-25', '--format=%h %ad %s', '--date=short'),
        git('for-each-ref', '--sort=-committerdate', '--count=15', '--format=%(refname:short) %(committerdate:short) %(subject)', 'refs/heads'),
      ]);
      return { topic, main: main.split('\n'), branches: branches.split('\n') };
    }
    const files = SPEC_TOPICS[topic].filter((f) => existsSync(join(this.root, f)));
    const text = files.map((f) => `<!-- ${f} -->\n${this.read(f)}`).join('\n\n');
    return { topic, files, ...page(text, offset) };
  }
}
