import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { AI_DRAFT_ACTIONS, CONTACT_ROLES, type AiDraftAction, type ContactRole } from '@vclinks/shared';
import { load } from 'js-yaml';
import { z } from 'zod';

/*
 * Reply playbook (CLAUDE.md §8): per-role handling (draft / summary_only / ignore), how to address the
 * customer, draft length, sample phrases and rules. Source: config/playbook.yaml (PLAYBOOK_PATH overrides).
 * Everything here is C1 (internal) context sent to the AI.
 */
const action = z.enum(AI_DRAFT_ACTIONS);
const role = z.enum(CONTACT_ROLES);

export const playbookSchema = z.object({
  version: z.number().int().optional(),
  actions: z.record(role, action).default({}),
  defaultAction: action.default('draft'),
  groupAction: action.default('draft'),
  address: z.record(role, z.string().max(300)).default({}),
  defaultAddress: z.string().max(300).default('Xưng em, gọi khách là anh/chị.'),
  maxSentences: z.number().int().min(1).max(10).default(4),
  phrases: z.array(z.string().max(300)).max(50).default([]),
  rules: z.array(z.string().max(300)).max(50).default([]),
});
export type Playbook = z.infer<typeof playbookSchema>;

/** Used when the file is missing or invalid: staff and family are never drafted. */
export const DEFAULT_PLAYBOOK: Playbook = playbookSchema.parse({
  actions: {
    nhan_vien: 'summary_only',
    quan_ly: 'summary_only',
    ngan_hang: 'summary_only',
    co_quan_nha_nuoc: 'summary_only',
    gia_dinh_ban_be: 'ignore',
    oa_doanh_nghiep: 'ignore',
  },
});

function findFile(): string | null {
  if (process.env.PLAYBOOK_PATH) return resolve(process.env.PLAYBOOK_PATH);
  for (const start of [process.cwd(), __dirname]) {
    let dir = start;
    for (let i = 0; i < 8; i++) {
      const p = join(dir, 'config', 'playbook.yaml');
      if (existsSync(p)) return p;
      const up = dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}

let cached: Playbook | null = null;

/** Playbook from config/playbook.yaml, read once per process (restart the API after editing). */
export function loadPlaybook(): Playbook {
  if (cached) return cached;
  const file = findFile();
  const log = new Logger('Playbook');
  if (!file) {
    log.warn('config/playbook.yaml not found, using the built-in default');
    cached = DEFAULT_PLAYBOOK;
    return cached;
  }
  try {
    cached = playbookSchema.parse(load(readFileSync(file, 'utf8')));
  } catch (e) {
    log.error(`Invalid playbook ${file}: ${(e as Error).message.slice(0, 200)}; using the built-in default`);
    cached = DEFAULT_PLAYBOOK;
  }
  return cached;
}

/** Test helper. */
export function resetPlaybookCache() {
  cached = null;
}

/** What to do for a conversation: groups use groupAction, 1-1 chats the contact's role. */
export function actionFor(pb: Playbook, opts: { isGroup: boolean; role?: ContactRole | null }): AiDraftAction {
  if (opts.isGroup) return pb.groupAction;
  if (opts.role && pb.actions[opts.role]) return pb.actions[opts.role]!;
  return pb.defaultAction;
}

export function addressFor(pb: Playbook, role?: ContactRole | null): string {
  return (role && pb.address[role]) || pb.defaultAddress;
}
