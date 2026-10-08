import { expect, type Page } from '@playwright/test';

export const KC = process.env.KC_URL ?? 'http://localhost:8180';
export const APP = process.env.APP_MAU_URL ?? 'http://localhost:4400';
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
