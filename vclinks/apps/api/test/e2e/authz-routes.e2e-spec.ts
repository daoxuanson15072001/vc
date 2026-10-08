import request from 'supertest';
import { PERMISSION_KEYS, type PermissionKey } from '@vclinks/shared';
import { ROUTE_PERMISSIONS } from '../../src/authz/route-permissions';
import { ruleOf } from '../../src/authz/authz.guard';
import { startE2EApp, type E2EApp } from './helpers';

// M1b-04 "Không endpoint nào thiếu khai báo quyền": every route the app serves has a line in
// apps/api/src/authz/route-permissions.ts (the AuthzGuard refuses undeclared routes anyway).
describe('route permission declarations (e2e)', () => {
  let t: E2EApp;
  beforeAll(async () => {
    t = await startE2EApp();
  });
  afterAll(async () => {
    await t?.close();
  });

  function routes(): string[] {
    const express = t.app.getHttpAdapter().getInstance() as { _router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } };
    const out: string[] = [];
    for (const layer of express._router.stack) {
      if (!layer.route) continue;
      for (const [m, on] of Object.entries(layer.route.methods)) if (on) out.push(`${m === '_all' ? 'ALL' : m.toUpperCase()} ${layer.route.path}`);
    }
    return out;
  }

  it('finds the app routes', () => {
    expect(routes().length).toBeGreaterThan(90);
  });

  it('declares a permission for every route', () => {
    const missing = routes().filter((r) => {
      const [method, path] = r.split(' ');
      return !ruleOf(method, path);
    });
    expect(missing).toEqual([]);
  });

  it('uses only permission keys of the spec matrix', () => {
    const keys = new Set<string>(PERMISSION_KEYS);
    const wrong = Object.entries(ROUTE_PERMISSIONS).flatMap(([route, rule]) => {
      if (rule.kind !== 'perm') return [];
      const list: PermissionKey[] = [...(Array.isArray(rule.key) ? rule.key : [rule.key]), ...(rule.dataKey ? [rule.dataKey] : [])];
      return list.filter((k) => !keys.has(k)).map((k) => `${route}: ${k}`);
    });
    expect(wrong).toEqual([]);
  });

  it('refuses a route missing from the table (fail closed)', async () => {
    const saved = ROUTE_PERMISSIONS['GET /api/conversations'];
    delete ROUTE_PERMISSIONS['GET /api/conversations'];
    try {
      const r = await request(t.app.getHttpServer()).get('/api/conversations').set(t.auth.dashboard).expect(403);
      expect(r.body.message).toContain('Route chưa khai báo quyền');
    } finally {
      ROUTE_PERMISSIONS['GET /api/conversations'] = saved;
    }
  });
});
