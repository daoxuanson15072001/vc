import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/**
 * Tenant of every record (BA §2.2 #10). Data that existed before multi-tenancy
 * belongs to this tenant (migrate-tenant script). DEFAULT_TENANT_ID overrides it.
 */
export const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || 'vcpv';

/**
 * Data scope of a signed-in user (M1b-04, docs 01 §2.10 "lọc ở tầng MongoDB"): channel-scoped collections
 * only return records of these channels (account uid) or conversations. Absent = no restriction
 * (device / MCP sync tokens, legacy tokens, background jobs).
 */
export interface DataScope {
  channels: string[];
  /** Conversation ids (`${uid}:${threadId}`) opened one by one (temporary grants). */
  conversations: string[];
}

interface TenantStore {
  tenantId?: string;
  scope?: DataScope;
  /** Client address of the request (L-03): written on audit lines, read only by Admin / kiểm toán. */
  ip?: string;
}

const als = new AsyncLocalStorage<TenantStore>();

/**
 * Express middleware: opens one tenant scope per HTTP request. The AuthGuard
 * fills it from the token (setRequestTenant); public routes (webhooks, OAuth
 * callbacks) stay on the default tenant unless they switch with runAsTenant().
 * Must be registered after body parsers (stream callbacks lose the context).
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  als.run({ ip: clientIp(req) }, next);
}

/**
 * Socket addresses allowed to set `CF-Connecting-IP` (TRUSTED_PROXY_IPS, comma separated). Default: loopback,
 * since cloudflared runs on the API machine (local + Cloudflare Tunnel). Empty = never trust the header.
 */
function trustedProxies(): Set<string> {
  const raw = process.env.TRUSTED_PROXY_IPS ?? '127.0.0.1,::1';
  return new Set(raw.split(',').map((s) => s.trim().replace(/^::ffff:/, '')).filter(Boolean));
}

/**
 * Client address: `CF-Connecting-IP` when the request comes from a trusted proxy (the Cloudflare Tunnel),
 * otherwise the socket address, so a client reaching the API directly cannot pick the address it is logged
 * with. `X-Forwarded-For` is never trusted. IPv4-mapped IPv6 is shown as plain IPv4.
 */
export function clientIp(req: Pick<Request, 'headers' | 'socket'>): string | undefined {
  const sock = req.socket?.remoteAddress?.replace(/^::ffff:/, '');
  const cf = req.headers?.['cf-connecting-ip'];
  const header = Array.isArray(cf) ? cf[0] : cf;
  const raw = header && sock && trustedProxies().has(sock) ? header.trim() : sock;
  if (!raw) return undefined;
  return raw.replace(/^::ffff:/, '').slice(0, 64);
}

/** Client address of the current request (undefined in background jobs). */
export function currentIp(): string | undefined {
  return als.getStore()?.ip;
}

/** Sets the tenant of the current request (called once the token is verified). */
export function setRequestTenant(tenantId: string) {
  const store = als.getStore();
  if (store) store.tenantId = tenantId;
}

/** Tenant of the current request or job; background code without a scope uses DEFAULT_TENANT. */
export function currentTenant(): string {
  return als.getStore()?.tenantId ?? DEFAULT_TENANT;
}

/** Runs `fn` (and everything it awaits) as `tenantId`: background jobs, webhooks, scripts. */
export function runAsTenant<R>(tenantId: string, fn: () => R): R {
  return als.run({ tenantId }, fn);
}

/** Restricts channel-scoped reads and writes of the current request to `scope` (AuthzGuard). */
export function setRequestScope(scope: DataScope) {
  const store = als.getStore();
  if (store) store.scope = scope;
}

/** Data scope of the current request, if any. */
export function currentScope(): DataScope | undefined {
  return als.getStore()?.scope;
}

/** Runs `fn` without the request's data scope (permission engine lookups), same tenant. */
export function runUnscoped<R>(fn: () => R): R {
  return als.run({ tenantId: currentTenant(), ip: currentIp() }, fn);
}
