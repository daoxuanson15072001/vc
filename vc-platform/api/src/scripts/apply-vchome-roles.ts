/**
 * pnpm --filter @vc/api vchome-roles [--check] [--file keycloak/vchome-roles.yaml]
 * Áp danh sách người giữ vai trò VC Home lên client role của `vchome` (kế hoạch GĐ B mục 8.1): thêm, gỡ; tạo vai trò
 * `hcns@<mã>` khi cần; chỉ gán cho user đã có ở VC ID; mỗi thay đổi một dòng nhật ký.
 * `--check`: chỉ kiểm tệp (CI). Đăng nhập Admin API bằng KC_TOOL_* (quản trị realm master), không có thì KC_ADMIN_*.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { AuditService, SYSTEM } from '../audit/audit.service';
import { KeycloakAdmin } from '../auth/idp/keycloak-admin';
import { checkRolesFile } from '../auth/vchome-roles';
import { SystemClock } from '../common/clock';
import { withTx } from '../common/tx';

const BASE_ROLES = ['hcns', 'qtht', 'kiem_soat', 'bgd'];

async function main(): Promise<number> {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const check = args.includes('--check');
  const fi = args.indexOf('--file');
  const file = fi >= 0 ? args[fi + 1] : '../keycloak/vchome-roles.yaml';
  const r = checkRolesFile(readFileSync(file, 'utf8'));
  for (const w of r.warnings) console.log(`Cảnh báo: ${w}`);
  for (const e of r.errors) console.error(`Lỗi: ${e}`);
  if (r.errors.length) return 1;
  console.log(`${file}: ${r.holders.length} người, hợp lệ.`);
  if (check) return 0;

  const env = process.env;
  const kc = new KeycloakAdmin({
    baseUrl: env.KC_BASE_URL ?? env.KC_URL ?? 'http://localhost:8180',
    realm: env.KC_REALM ?? 'vc',
    authRealm: env.KC_TOOL_AUTH_REALM ?? (env.KC_TOOL_CLIENT_ID || env.KC_TOOL_USER ? 'master' : env.KC_REALM ?? 'vc'),
    clientId: env.KC_TOOL_CLIENT_ID ?? (env.KC_TOOL_USER ? 'admin-cli' : env.KC_ADMIN_CLIENT_ID ?? 'vc-home-api'),
    clientSecret: env.KC_TOOL_CLIENT_SECRET ?? (env.KC_TOOL_USER ? undefined : env.KC_ADMIN_CLIENT_SECRET),
    username: env.KC_TOOL_USER,
    password: env.KC_TOOL_PASSWORD,
  });
  const client = (await kc.get<{ id: string }[]>(`/clients?clientId=${encodeURIComponent(env.OIDC_SPA_CLIENT_ID ?? 'vchome')}`))[0];
  if (!client) throw new Error('VC ID chưa có client vchome (áp vc.yaml trước)');
  const roleBase = `/clients/${client.id}/roles`;

  // Every role in the file exists as a client role (hcns@<mã> is created here).
  const existing = new Set((await kc.get<{ name: string }[]>(roleBase)).map((x) => x.name));
  for (const role of new Set(r.holders.flatMap((h) => h.roles))) {
    if (!existing.has(role)) {
      await kc.call('POST', roleBase, { name: role, description: role.startsWith('hcns@') ? `HC-NS phạm vi ${role.slice(5)}` : undefined });
      existing.add(role);
      console.log(`Tạo vai trò ${role}`);
    }
  }
  const homeRoles = [...existing].filter((x) => BASE_ROLES.includes(x.split('@')[0]));

  // Current holders: user id → roles.
  const current = new Map<string, Set<string>>();
  for (const role of homeRoles) {
    for (const u of (await kc.get<{ id: string }[]>(`${roleBase}/${encodeURIComponent(role)}/users?max=1000`)) ?? []) {
      current.set(u.id, (current.get(u.id) ?? new Set()).add(role));
    }
  }
  const desired = new Map<string, Set<string>>();
  const missing: string[] = [];
  for (const h of r.holders) {
    const u = (await kc.get<{ id: string }[]>(`/users?email=${encodeURIComponent(h.email)}&exact=true`))[0];
    if (!u) missing.push(h.email);
    else desired.set(u.id, new Set(h.roles));
  }

  const mongo = env.MONGO_URL ? await new MongoClient(env.MONGO_URL).connect() : undefined;
  const audit = mongo ? new AuditService(mongo.db(env.MONGO_DB ?? 'vchome'), new SystemClock()) : undefined;
  const correlationId = `script-${randomBytes(6).toString('hex')}`;
  let changes = 0;
  try {
    for (const userId of new Set([...current.keys(), ...desired.keys()])) {
      const has = current.get(userId) ?? new Set<string>();
      const want = desired.get(userId) ?? new Set<string>();
      const add = [...want].filter((x) => !has.has(x));
      const remove = [...has].filter((x) => !want.has(x));
      if (!add.length && !remove.length) continue;
      const reps = async (names: string[]) => Promise.all(names.map((n) => kc.get<{ id: string; name: string }>(`${roleBase}/${encodeURIComponent(n)}`)));
      if (add.length) await kc.call('POST', `/users/${userId}/role-mappings/clients/${client.id}`, await reps(add));
      if (remove.length) await kc.call('DELETE', `/users/${userId}/role-mappings/clients/${client.id}`, await reps(remove));
      for (const [action, roles] of [['vchome_role.add', add], ['vchome_role.remove', remove]] as const) {
        for (const role of roles) {
          console.log(`${action === 'vchome_role.add' ? 'Gán' : 'Gỡ'} ${role}: user ${userId}`);
          changes++;
          if (audit && mongo) {
            await withTx(mongo, (session) =>
              audit.record(session, {
                actor: SYSTEM,
                action,
                target: { type: 'account', id: userId, label: role },
                after: { role },
                correlation_id: correlationId,
                source: { type: 'script', ref: 'apply-vchome-roles' },
              }),
            );
          }
        }
      }
    }
  } finally {
    await mongo?.close();
  }
  if (missing.length) console.log(`Chưa có ở VC ID (gán khi họ đăng nhập lần đầu rồi chạy lại): ${missing.join(', ')}`);
  console.log(`Xong: ${changes} thay đổi${audit ? '' : ' (không có MONGO_URL: không ghi nhật ký)'}.`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e: Error) => {
    console.error(`Lỗi: ${e.message}`);
    process.exit(1);
  },
);
