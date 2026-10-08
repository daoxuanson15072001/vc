import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

export const KC = process.env.KC_URL ?? 'http://localhost:8180';
export const APP = process.env.APP_MAU_URL ?? 'http://localhost:4400';
export const HOME = process.env.VCHOME_URL ?? 'http://localhost:5173';
export const PASSWORD = process.env.GIA_GOOGLE_PASSWORD ?? 'Thu@123456';

type Rep = Record<string, any>;
let token: { v: string; exp: number } | undefined;

async function adminToken(): Promise<string> {
  if (token && token.exp > Date.now() + 10_000) return token.v;
  const res = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: process.env.KC_ADMIN_USER ?? 'admin',
      password: process.env.KC_ADMIN_PASSWORD ?? 'admin-dev-only',
    }),
  });
  const b = (await res.json()) as { access_token: string; expires_in: number };
  token = { v: b.access_token, exp: Date.now() + b.expires_in * 1000 };
  return token.v;
}

export async function admin<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${KC}/admin/realms${path}`, {
    method,
    headers: { authorization: `Bearer ${await adminToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return undefined as T;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  const t = await res.text();
  return (t ? JSON.parse(t) : undefined) as T;
}

export async function findUser(realm: string, email: string): Promise<Rep | undefined> {
  const list = await admin<Rep[]>('GET', `/${realm}/users?email=${encodeURIComponent(email)}&exact=true`);
  return list[0];
}

export async function deleteUserIfAny(realm: string, email: string): Promise<void> {
  const u = await findUser(realm, email);
  if (u) await admin('DELETE', `/${realm}/users/${u.id}`);
}

export async function groupId(realm: string, name: string): Promise<string> {
  const g = (await admin<Rep[]>('GET', `/${realm}/groups?search=${encodeURIComponent(name)}&exact=true`))[0];
  return g.id;
}

export async function addToGroup(realm: string, userId: string, group: string): Promise<void> {
  await admin('PUT', `/${realm}/users/${userId}/groups/${await groupId(realm, group)}`);
}

export async function appState(): Promise<{ sessions: Rep[]; events: Rep[] }> {
  return (await fetch(`${APP}/_test/state`)).json();
}

/** Fills the login form of the fake Google realm (the page a real user would see at accounts.google.com). */
export async function loginFakeGoogle(page: Page, email: string): Promise<void> {
  await expect(page).toHaveURL(/\/realms\/gia-google\//);
  await page.locator('#username').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('#kc-login').click();
}

// vc-provisioner with a fake Directory per test run (tệp gốc: provisioner/fixtures/directory.dev.json).
const PROV = resolve(__dirname, '../../../provisioner');
const tmp = mkdtempSync(join(tmpdir(), 'vc-prov-'));
const directoryFile = join(tmp, 'directory.json');
const baseDirectory = JSON.parse(readFileSync(join(PROV, 'fixtures/directory.dev.json'), 'utf8')) as Rep[];

export function provisioner(...args: string[]): string {
  return execFileSync('npx', ['tsx', 'src/cli.ts', ...args], {
    cwd: PROV,
    env: { ...process.env, DIRECTORY_MODE: 'file', DIRECTORY_FILE: directoryFile, PROVISIONER_STATE_FILE: join(tmp, 'state.json') },
    encoding: 'utf8',
  });
}

/** Writes the fake Directory, optionally changed (for example someone turns on 2-step verification). */
export function setDirectory(change: (rows: Rep[]) => Rep[] = (r) => r): void {
  writeFileSync(directoryFile, JSON.stringify(change(structuredClone(baseDirectory))));
}

/** Applies keycloak/vchome-roles.dev.yaml to VC ID (VC Home admin roles of the fake Google users). */
export function applyHomeRoles(): string {
  const api = resolve(__dirname, '../../../api');
  if (!existsSync(join(api, 'dist/scripts/apply-vchome-roles.js'))) execFileSync('pnpm', ['build'], { cwd: api, stdio: 'ignore' });
  return execFileSync('node', ['dist/scripts/apply-vchome-roles.js', '--file', '../keycloak/vchome-roles.dev.yaml'], {
    cwd: api,
    env: { ...process.env, KC_TOOL_USER: process.env.KC_ADMIN_USER ?? 'admin', KC_TOOL_PASSWORD: process.env.KC_ADMIN_PASSWORD ?? 'admin-dev-only', MONGO_URL: '' },
    encoding: 'utf8',
  });
}
