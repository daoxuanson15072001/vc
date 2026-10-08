/**
 * vc-provisioner CLI (thiết kế SSO mục 5.6).
 *   sync [--apply] [--confirm-bulk]    one run; dry-run unless --apply or PROVISIONER_MODE=apply
 *   loop                               sync every PROVISIONER_INTERVAL_MIN (15) minutes
 *   report [--json]                    who may enter apps, grouped by status (I9) + mismatches
 *   disable <email> --reason "…"       emergency lock (VH-AUT-06)
 *   enable <email> [--also-google]     remove the emergency lock
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { KcAdmin } from '@vc/realm-apply/kc';
import { FileGoogleDirectory, RealGoogleDirectory, type GoogleDirectory } from './google.js';
import { disableUser, enableUser, execute, plan, type Exclusion, type KcUser, type Plan } from './sync.js';

const env = process.env;
const REALM = env.KC_REALM ?? 'vc';
const DOMAINS = (env.COMPANY_DOMAINS ?? 'vcprosperous.com,vcpart.vn').split(',').map((s) => s.trim());
const DEFAULT_GROUPS = (env.DEFAULT_APP_GROUPS ?? 'app-vclinks,app-vcwiki').split(',').map((s) => s.trim());
const STATE_FILE = env.PROVISIONER_STATE_FILE ?? '.provisioner-state.json';

const kc = new KcAdmin({
  baseUrl: env.KC_URL ?? 'http://localhost:8180',
  authRealm: REALM,
  clientId: env.PROVISIONER_CLIENT_ID ?? 'vc-provisioner',
  clientSecret: env.PROVISIONER_CLIENT_SECRET,
});

function directory(): GoogleDirectory {
  if ((env.DIRECTORY_MODE ?? 'google') === 'file') {
    // Dev/CI only: ids of the fake Google users are looked up in the fake Google realm with the master admin.
    const fakeRealm = env.DIRECTORY_FAKE_REALM ?? 'gia-google';
    const admin = new KcAdmin({ baseUrl: env.KC_URL ?? 'http://localhost:8180', username: env.KC_ADMIN_USER, password: env.KC_ADMIN_PASSWORD });
    return new FileGoogleDirectory(env.DIRECTORY_FILE ?? 'fixtures/directory.dev.json', async (email) => {
      const u = await admin.get<any[]>(`/${fakeRealm}/users?email=${encodeURIComponent(email)}&exact=true`);
      return u[0]?.id;
    });
  }
  if (!env.GOOGLE_SA_KEY_FILE || !env.GOOGLE_ADMIN_SUBJECT) throw new Error('Thiếu GOOGLE_SA_KEY_FILE hoặc GOOGLE_ADMIN_SUBJECT (đầu vào I4)');
  return new RealGoogleDirectory(env.GOOGLE_SA_KEY_FILE, env.GOOGLE_ADMIN_SUBJECT, (env.GOOGLE_WORKSPACES ?? DOMAINS.join(',')).split(','));
}

function exclusions(): Exclusion[] {
  const f = env.EXCLUSIONS_FILE ?? 'loai-tru.yaml';
  if (!existsSync(f)) return [];
  const doc = parse(readFileSync(f, 'utf8')) as { loai_tru?: Exclusion[] } | null;
  return (doc?.loai_tru ?? []).map((e) => ({ ...e, email: e.email.toLowerCase() }));
}

async function groupIds(): Promise<Map<string, string>> {
  const all = await kc.get<any[]>(`/${REALM}/groups?briefRepresentation=true&max=1000`);
  return new Map(all.map((g) => [g.name as string, g.id as string]));
}

async function kcUsers(gids: Map<string, string>): Promise<KcUser[]> {
  const users: any[] = [];
  for (let first = 0; ; first += 500) {
    const page = await kc.get<any[]>(`/${REALM}/users?briefRepresentation=false&first=${first}&max=500`);
    users.push(...page);
    if (page.length < 500) break;
  }
  const membership = new Map<string, string[]>();
  for (const g of DEFAULT_GROUPS) {
    const id = gids.get(g);
    if (!id) continue;
    for (let first = 0; ; first += 500) {
      const page = await kc.get<any[]>(`/${REALM}/groups/${id}/members?briefRepresentation=true&first=${first}&max=500`);
      for (const m of page) membership.set(m.id, [...(membership.get(m.id) ?? []), g]);
      if (page.length < 500) break;
    }
  }
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    enabled: u.enabled,
    attributes: u.attributes ?? {},
    groups: membership.get(u.id) ?? [],
  }));
}

function readState(): { lastGoogleCount?: number } {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function notify(lines: string[]): Promise<void> {
  if (!lines.length) return;
  for (const l of lines) console.log(`[báo vc-id-admin] ${l}`);
  if (env.ALERT_WEBHOOK_URL) {
    await fetch(env.ALERT_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: lines.join('\n') }) }).catch(
      (e) => console.error(`Không gửi được cảnh báo: ${(e as Error).message}`),
    );
  }
}

const LABEL: Record<string, string> = {
  tao_user: 'Tạo sẵn user',
  them_nhom: 'Cấp nhóm app',
  go_nhom: 'Gỡ nhóm app',
  dat_trang_thai: 'Ghi trạng thái',
  khoa_google: 'Khoá theo Google',
  bao_mo_lai: 'Báo: Google mở lại',
};

function describe(p: Plan): string[] {
  return p.actions.map((a) => {
    const extra = 'groups' in a ? ` (${a.groups.join(', ')})` : 'value' in a ? ` = ${a.value}` : 'reason' in a ? ` (${a.reason})` : '';
    return `${LABEL[a.kind]}: ${a.email}${extra}`;
  });
}

async function buildPlan(confirmBulk: boolean): Promise<{ p: Plan; gids: Map<string, string>; googleCount: number }> {
  const [google, gids] = await Promise.all([directory().listUsers(), groupIds()]);
  const users = await kcUsers(gids);
  const p = plan(google, users, exclusions(), {
    defaultGroups: DEFAULT_GROUPS,
    companyDomains: DOMAINS,
    previousGoogleCount: readState().lastGoogleCount,
    confirmBulk,
  });
  return { p, gids, googleCount: google.length };
}

async function sync(apply: boolean, confirmBulk: boolean): Promise<number> {
  const { p, gids, googleCount } = await buildPlan(confirmBulk);
  if (p.stop) {
    await notify([`vc-provisioner dừng, không đổi gì: ${p.stop}.`]);
    return 3;
  }
  for (const l of describe(p)) console.log(`${apply ? '' : '[thử] '}${l}`);
  if (p.held) await notify([`vc-provisioner chờ xác nhận: ${p.held}.`]);
  if (apply) {
    await notify(await execute(kc, REALM, p, gids));
    writeFileSync(STATE_FILE, JSON.stringify({ lastGoogleCount: googleCount, lastRunAt: new Date().toISOString() }));
  }
  console.log(`${apply ? '' : '[thử] '}${p.actions.length} việc; ${googleCount} tài khoản Google.`);
  return 0;
}

async function report(json: boolean): Promise<void> {
  const { p } = await buildPlan(false);
  const groups: Record<string, string[]> = {};
  for (const [email, st] of Object.entries(p.statuses)) (groups[st] ??= []).push(email);
  if (json) {
    console.log(JSON.stringify({ statuses: groups, pending: describe(p), stop: p.stop, held: p.held }, null, 2));
    return;
  }
  const NAMES: Record<string, string> = {
    du_dieu_kien: 'Được vào app',
    chua_bat_2_buoc: 'Chưa bật xác thực 2 bước (chưa vào app)',
    loai_tru: 'Thuộc danh sách loại trừ (không vào app)',
    bi_khoa: 'Bị khoá trên Google',
  };
  for (const k of Object.keys(NAMES)) {
    const list = (groups[k] ?? []).sort();
    console.log(`\n${NAMES[k]}: ${list.length}`);
    for (const e of list) console.log(`  ${e}`);
  }
  console.log(`\nViệc lượt sau sẽ làm: ${p.actions.length}`);
  for (const l of describe(p)) console.log(`  ${l}`);
}

async function findUserId(email: string): Promise<string> {
  const u = await kc.get<any[]>(`/${REALM}/users?email=${encodeURIComponent(email)}&exact=true`);
  if (!u[0]) throw new Error(`VC ID không có user ${email}`);
  return u[0].id;
}

const { positionals, values } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== '--'),
  allowPositionals: true,
  options: {
    apply: { type: 'boolean', default: false },
    'confirm-bulk': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    reason: { type: 'string' },
    'also-google': { type: 'boolean', default: false },
  },
});
const [cmd, arg] = positionals;
const apply = values.apply || env.PROVISIONER_MODE === 'apply';

try {
  switch (cmd) {
    case 'sync':
      process.exitCode = await sync(apply, values['confirm-bulk']);
      break;
    case 'loop': {
      const minutes = Number(env.PROVISIONER_INTERVAL_MIN ?? 15);
      for (;;) {
        await kc
          .waitReady(60_000)
          .then(() => sync(apply, false))
          .catch((e) => notify([`vc-provisioner lỗi: ${(e as Error).message}`]));
        await new Promise((r) => setTimeout(r, minutes * 60_000));
      }
    }
    case 'report':
      await report(values.json);
      break;
    case 'disable':
      if (!arg || !values.reason) throw new Error('Cách dùng: disable <email> --reason "…"');
      await disableUser(kc, REALM, await findUserId(arg.toLowerCase()), values.reason);
      await notify([`Đã khoá khẩn cấp ${arg}: ${values.reason}. Mọi app nhận lệnh đăng xuất.`]);
      break;
    case 'enable': {
      if (!arg) throw new Error('Cách dùng: enable <email> [--also-google]');
      const r = await enableUser(kc, REALM, await findUserId(arg.toLowerCase()), values['also-google']);
      console.log(r.enabled ? `Đã mở khoá ${arg}.` : `${arg} vẫn khoá vì: ${r.remaining.join(', ')}.`);
      break;
    }
    default:
      console.error('Lệnh: sync | loop | report | disable | enable (xem đầu tệp src/cli.ts)');
      process.exitCode = 2;
  }
} catch (e) {
  console.error(`Lỗi: ${(e as Error).message}`);
  process.exitCode = 1;
}
