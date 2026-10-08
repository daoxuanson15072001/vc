import type { ClientScopeSpec, ClientSpec, IdentityProviderSpec, MapperSpec, RealmSpec, UserSpec } from './config.js';
import { KcAdmin } from './kc.js';

type Rep = Record<string, any>;

export interface ApplyLog {
  action: 'tao' | 'sua' | 'giu' | 'xoa' | 'bao';
  what: string;
}

/**
 * Applies a realm spec idempotently. Running it twice leaves the realm unchanged the second time.
 * Only objects declared in the spec are managed; undeclared clients, groups and users are left alone
 * (reported), except mappers of a declared client / scope / IdP, which the spec owns completely.
 */
export class RealmApplier {
  readonly log: ApplyLog[] = [];

  constructor(
    private readonly kc: KcAdmin,
    private readonly spec: RealmSpec,
    private readonly dryRun = false,
    /** Resend identity-provider secrets even when nothing else changed (Keycloak masks them, so they cannot be compared). */
    private readonly forceSecrets = false,
  ) {}

  private get r(): string {
    return `/${encodeURIComponent(this.spec.realm)}`;
  }

  private note(action: ApplyLog['action'], what: string): void {
    this.log.push({ action, what });
  }

  /** Write helper: skipped in dry-run. */
  private async write<T = unknown>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
    if (this.dryRun) return 'dry-run' as T;
    return this.kc.call<T>(method, path, body ?? (method === 'DELETE' ? undefined : {}));
  }

  async run(): Promise<ApplyLog[]> {
    await this.realm();
    await this.userProfile();
    await this.clientScopes();
    await this.defaultClientScopes();
    await this.groups();
    await this.clients();
    await this.identityProviders();
    await this.authenticatorConfigs();
    await this.users();
    return this.log;
  }

  async realm(): Promise<void> {
    const existing = await this.kc.get<Rep>(this.r);
    const desired = { realm: this.spec.realm, enabled: true, ...(this.spec.settings ?? {}) };
    if (!existing) {
      await this.write('POST', '', desired);
      this.note('tao', `realm ${this.spec.realm}`);
      return;
    }
    if (changed(existing, desired)) {
      await this.write('PUT', this.r, { ...existing, ...desired });
      this.note('sua', `realm ${this.spec.realm}`);
    } else this.note('giu', `realm ${this.spec.realm}`);
  }

  async userProfile(): Promise<void> {
    const want = this.spec.userProfile;
    if (!want || this.dryRunNewRealm()) return;
    const up = await this.kc.get<Rep>(`${this.r}/users/profile`);
    let next: Rep = { ...up };
    if (want.unmanagedAttributePolicy) next.unmanagedAttributePolicy = want.unmanagedAttributePolicy;
    if (want.email) {
      const email = (up.attributes as Rep[]).find((a) => a.name === 'email');
      if (!email) throw new Error('User profile không có thuộc tính email');
      const validations = { ...(email.validations ?? {}), pattern: { pattern: want.email.pattern, 'error-message': want.email.errorMessage } };
      const permissions = { view: ['admin', 'user'], edit: ['admin'] };
      next = { ...next, attributes: (up.attributes as Rep[]).map((a) => (a.name === 'email' ? { ...a, validations, permissions } : a)) };
    }
    if (!changed(up, next)) return this.note('giu', 'user profile');
    await this.write('PUT', `${this.r}/users/profile`, next);
    this.note('sua', 'user profile (thuộc tính ngoài khai báo, email chỉ nhận domain công ty)');
  }

  private dryRunNewRealm(): boolean {
    return this.dryRun && this.log.some((l) => l.action === 'tao' && l.what.startsWith('realm '));
  }

  async clientScopes(): Promise<void> {
    if (this.dryRunNewRealm()) return;
    const all = await this.kc.get<Rep[]>(`${this.r}/client-scopes`);
    for (const s of this.spec.clientScopes ?? []) {
      let cur = all.find((x) => x.name === s.name);
      const desired = { name: s.name, protocol: s.protocol ?? 'openid-connect', attributes: s.attributes ?? {} };
      let id = cur?.id as string | undefined;
      if (!cur) {
        id = await this.write<string>('POST', `${this.r}/client-scopes`, desired);
        this.note('tao', `client scope ${s.name}`);
      } else if (changed(cur, desired)) {
        await this.write('PUT', `${this.r}/client-scopes/${id}`, { ...cur, ...desired });
        this.note('sua', `client scope ${s.name}`);
      }
      if (id && id !== 'dry-run') await this.mappers(`${this.r}/client-scopes/${id}`, s.protocolMappers ?? [], `scope ${s.name}`);
    }
  }

  async defaultClientScopes(): Promise<void> {
    const want = this.spec.defaultClientScopes;
    if (!want || this.dryRunNewRealm()) return;
    const all = await this.kc.get<Rep[]>(`${this.r}/client-scopes`);
    const cur = await this.kc.get<Rep[]>(`${this.r}/default-default-client-scopes`);
    for (const name of want) {
      if (cur.some((c) => c.name === name)) continue;
      const scope = all.find((s) => s.name === name);
      if (!scope) throw new Error(`Không có client scope ${name}`);
      await this.write('PUT', `${this.r}/default-default-client-scopes/${scope.id}`);
      this.note('tao', `scope mặc định của realm: ${name}`);
    }
  }

  async groups(): Promise<void> {
    if (this.dryRunNewRealm()) return;
    const existing = await this.kc.get<Rep[]>(`${this.r}/groups?briefRepresentation=true&max=1000`);
    for (const g of this.spec.groups ?? []) {
      if (existing.some((e) => e.name === g)) continue;
      await this.write('POST', `${this.r}/groups`, { name: g });
      this.note('tao', `nhóm ${g}`);
    }
    for (const e of existing) if (!(this.spec.groups ?? []).includes(e.name)) this.note('bao', `nhóm không khai: ${e.name}`);
  }

  async clients(): Promise<void> {
    if (this.dryRunNewRealm()) return;
    for (const c of this.spec.clients ?? []) await this.client(c);
  }

  private async client(c: ClientSpec): Promise<void> {
    const found = await this.kc.get<Rep[]>(`${this.r}/clients?clientId=${encodeURIComponent(c.clientId)}`);
    let cur = found[0];
    const { defaultClientScopes, optionalClientScopes, protocolMappers, roles, serviceAccountRoles, ...plain } = c;
    const desired: Rep = {
      protocol: 'openid-connect',
      enabled: true,
      fullScopeAllowed: false,
      consentRequired: false,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      ...plain,
    };
    let id = cur?.id as string | undefined;
    if (!cur) {
      id = await this.write<string>('POST', `${this.r}/clients`, desired);
      this.note('tao', `client ${c.clientId}`);
      if (this.dryRun) return;
      cur = await this.kc.get<Rep>(`${this.r}/clients/${id}`);
    } else {
      // The secret is write-only from our side: compare it separately.
      const secretChanged = c.secret !== undefined && (await this.secretOf(id!)) !== c.secret;
      const { secret: _s, ...cmp } = desired;
      if (changed(cur, cmp) || secretChanged) {
        await this.write('PUT', `${this.r}/clients/${id}`, deepAssign(cur, desired));
        this.note('sua', `client ${c.clientId}`);
      } else this.note('giu', `client ${c.clientId}`);
    }
    if (!id || id === 'dry-run') return;
    await this.clientScopeLinks(id, 'default-client-scopes', defaultClientScopes, c.clientId);
    await this.clientScopeLinks(id, 'optional-client-scopes', optionalClientScopes, c.clientId);
    await this.mappers(`${this.r}/clients/${id}`, protocolMappers ?? [], `client ${c.clientId}`);
    await this.clientRoles(id, roles ?? [], c.clientId);
    if (serviceAccountRoles) await this.serviceAccountRoles(id, serviceAccountRoles, c.clientId);
  }

  private async secretOf(id: string): Promise<string | undefined> {
    const s = await this.kc.get<Rep>(`${this.r}/clients/${id}/client-secret`);
    return s?.value;
  }

  private async clientScopeLinks(id: string, kind: string, want: string[] | undefined, clientId: string): Promise<void> {
    if (!want) return;
    const all = await this.kc.get<Rep[]>(`${this.r}/client-scopes`);
    const cur = await this.kc.get<Rep[]>(`${this.r}/clients/${id}/${kind}`);
    for (const name of want) {
      if (cur.some((x) => x.name === name)) continue;
      const scope = all.find((s) => s.name === name);
      if (!scope) throw new Error(`Không có client scope ${name} (client ${clientId})`);
      await this.write('PUT', `${this.r}/clients/${id}/${kind}/${scope.id}`);
      this.note('tao', `${kind} ${name} → ${clientId}`);
    }
    for (const x of cur) {
      if (want.includes(x.name)) continue;
      await this.write('DELETE', `${this.r}/clients/${id}/${kind}/${x.id}`);
      this.note('xoa', `${kind} ${x.name} khỏi ${clientId}`);
    }
  }

  private async clientRoles(id: string, roles: string[], clientId: string): Promise<void> {
    if (!roles.length) return;
    const cur = await this.kc.get<Rep[]>(`${this.r}/clients/${id}/roles`);
    for (const role of roles) {
      if (cur.some((x) => x.name === role)) continue;
      await this.write('POST', `${this.r}/clients/${id}/roles`, { name: role });
      this.note('tao', `vai trò ${clientId}:${role}`);
    }
  }

  private async serviceAccountRoles(id: string, want: Record<string, string[]>, clientId: string): Promise<void> {
    const sa = await this.kc.get<Rep>(`${this.r}/clients/${id}/service-account-user`);
    if (!sa) throw new Error(`Client ${clientId} chưa bật service account`);
    for (const [owner, roles] of Object.entries(want)) {
      if (owner === 'realm') {
        const cur = await this.kc.get<Rep[]>(`${this.r}/users/${sa.id}/role-mappings/realm`);
        const missing = [];
        for (const r of roles) {
          if (cur.some((x) => x.name === r)) continue;
          missing.push(await this.kc.get<Rep>(`${this.r}/roles/${encodeURIComponent(r)}`));
        }
        if (missing.length) {
          await this.write('POST', `${this.r}/users/${sa.id}/role-mappings/realm`, missing);
          this.note('tao', `${clientId}: vai trò realm ${roles.join(', ')}`);
        }
        continue;
      }
      const target = (await this.kc.get<Rep[]>(`${this.r}/clients?clientId=${encodeURIComponent(owner)}`))[0];
      if (!target) throw new Error(`Không có client ${owner}`);
      const cur = await this.kc.get<Rep[]>(`${this.r}/users/${sa.id}/role-mappings/clients/${target.id}`);
      const missing = [];
      for (const r of roles) {
        if (cur.some((x) => x.name === r)) continue;
        const role = await this.kc.get<Rep>(`${this.r}/clients/${target.id}/roles/${encodeURIComponent(r)}`);
        if (!role) throw new Error(`Không có vai trò ${owner}:${r}`);
        missing.push(role);
      }
      if (missing.length) {
        await this.write('POST', `${this.r}/users/${sa.id}/role-mappings/clients/${target.id}`, missing);
        this.note('tao', `${clientId}: ${owner} ${missing.map((m) => m.name).join(', ')}`);
      }
    }
  }

  /** Mappers of a client or client scope: the spec owns the full list. */
  private async mappers(base: string, want: MapperSpec[], label: string): Promise<void> {
    const cur = await this.kc.get<Rep[]>(`${base}/protocol-mappers/models`);
    for (const m of want) {
      const desired = { name: m.name, protocol: m.protocol ?? 'openid-connect', protocolMapper: m.protocolMapper, config: m.config };
      const ex = cur.find((x) => x.name === m.name);
      if (!ex) {
        await this.write('POST', `${base}/protocol-mappers/models`, desired);
        this.note('tao', `mapper ${m.name} (${label})`);
      } else if (changed(ex, desired)) {
        await this.write('PUT', `${base}/protocol-mappers/models/${ex.id}`, { ...desired, id: ex.id });
        this.note('sua', `mapper ${m.name} (${label})`);
      }
    }
    for (const ex of cur) {
      if (want.some((m) => m.name === ex.name)) continue;
      await this.write('DELETE', `${base}/protocol-mappers/models/${ex.id}`);
      this.note('xoa', `mapper ${ex.name} (${label})`);
    }
  }

  async identityProviders(): Promise<void> {
    if (this.dryRunNewRealm()) return;
    for (const idp of this.spec.identityProviders ?? []) await this.identityProvider(idp);
  }

  private async identityProvider(idp: IdentityProviderSpec): Promise<void> {
    const path = `${this.r}/identity-provider/instances/${encodeURIComponent(idp.alias)}`;
    const cur = await this.kc.get<Rep>(path);
    const { mappers, ...plain } = idp;
    const desired: Rep = { enabled: true, ...plain };
    if (!cur) {
      await this.write('POST', `${this.r}/identity-provider/instances`, desired);
      this.note('tao', `nhà cung cấp định danh ${idp.alias}`);
    } else {
      // clientSecret comes back masked: never compare it, always resend when declared.
      const { config: dc, ...rest } = desired;
      const { clientSecret: _c, ...cfgCmp } = dc as Rep;
      const providerChanged = cur.providerId !== desired.providerId;
      if (providerChanged) {
        await this.write('DELETE', path);
        await this.write('POST', `${this.r}/identity-provider/instances`, desired);
        this.note('sua', `nhà cung cấp định danh ${idp.alias} (đổi loại ${cur.providerId} → ${desired.providerId})`);
      } else if (changed(cur, { ...rest, config: cfgCmp }) || (this.forceSecrets && 'clientSecret' in (dc as Rep))) {
        await this.write('PUT', path, deepAssign(cur, desired));
        this.note('sua', `nhà cung cấp định danh ${idp.alias}`);
      } else this.note('giu', `nhà cung cấp định danh ${idp.alias}`);
    }
    if (this.dryRun && !cur) return;
    const curM = (await this.kc.get<Rep[]>(`${path}/mappers`)) ?? [];
    for (const m of mappers ?? []) {
      const desiredM = { name: m.name, identityProviderAlias: idp.alias, identityProviderMapper: m.identityProviderMapper, config: m.config };
      const ex = curM.find((x) => x.name === m.name);
      if (!ex) {
        await this.write('POST', `${path}/mappers`, desiredM);
        this.note('tao', `mapper ${m.name} (IdP ${idp.alias})`);
      } else if (changed(ex, desiredM)) {
        await this.write('PUT', `${path}/mappers/${ex.id}`, { ...desiredM, id: ex.id });
        this.note('sua', `mapper ${m.name} (IdP ${idp.alias})`);
      }
    }
    for (const ex of curM) {
      if ((mappers ?? []).some((m) => m.name === ex.name)) continue;
      await this.write('DELETE', `${path}/mappers/${ex.id}`);
      this.note('xoa', `mapper ${ex.name} (IdP ${idp.alias})`);
    }
  }

  async authenticatorConfigs(): Promise<void> {
    if (this.dryRunNewRealm()) return;
    for (const a of this.spec.authenticatorConfigs ?? []) {
      const execs = await this.kc.get<Rep[]>(`${this.r}/authentication/flows/${encodeURIComponent(a.flow)}/executions`);
      const ex = execs.find((e) => e.providerId === a.provider);
      if (!ex) throw new Error(`Luồng "${a.flow}" không có bước ${a.provider}`);
      if (ex.authenticationConfig) {
        const cfg = await this.kc.get<Rep>(`${this.r}/authentication/config/${ex.authenticationConfig}`);
        if (!changed(cfg, { config: a.config })) continue;
        await this.write('PUT', `${this.r}/authentication/config/${ex.authenticationConfig}`, { ...cfg, config: { ...cfg.config, ...a.config } });
        this.note('sua', `cấu hình ${a.provider} trong "${a.flow}"`);
      } else {
        await this.write('POST', `${this.r}/authentication/executions/${ex.id}/config`, { alias: a.alias, config: a.config });
        this.note('tao', `cấu hình ${a.provider} trong "${a.flow}"`);
      }
    }
  }

  /** Users are declared only in test realms (the fake Google). Production users come from Google. */
  async users(): Promise<void> {
    if (this.dryRunNewRealm()) return;
    for (const u of this.spec.users ?? []) await this.user(u);
  }

  private async user(u: UserSpec): Promise<void> {
    const found = await this.kc.get<Rep[]>(`${this.r}/users?username=${encodeURIComponent(u.username)}&exact=true`);
    const { password, groups, ...plain } = u;
    const desired = { enabled: true, emailVerified: true, ...plain };
    let id = found[0]?.id as string | undefined;
    if (!id) {
      id = await this.write<string>('POST', `${this.r}/users`, desired);
      this.note('tao', `người dùng ${u.username}`);
      if (this.dryRun) return;
      if (password) await this.write('PUT', `${this.r}/users/${id}/reset-password`, { type: 'password', value: password, temporary: false });
    } else if (changed(found[0], desired)) {
      await this.write('PUT', `${this.r}/users/${id}`, { ...found[0], ...desired });
      this.note('sua', `người dùng ${u.username}`);
    }
    if (groups?.length && id !== 'dry-run') {
      const all = await this.kc.get<Rep[]>(`${this.r}/groups?briefRepresentation=true&max=1000`);
      const cur = await this.kc.get<Rep[]>(`${this.r}/users/${id}/groups`);
      for (const g of groups) {
        if (cur.some((x) => x.name === g)) continue;
        const grp = all.find((x) => x.name === g);
        if (!grp) throw new Error(`Không có nhóm ${g}`);
        await this.write('PUT', `${this.r}/users/${id}/groups/${grp.id}`);
        this.note('tao', `${u.username} vào nhóm ${g}`);
      }
    }
  }
}

/** True when any declared field differs from the current representation (undeclared fields are ignored). */
export function changed(cur: unknown, desired: unknown): boolean {
  if (desired === undefined) return false;
  if (Array.isArray(desired)) {
    if (!Array.isArray(cur) || cur.length !== desired.length) return true;
    // Order-insensitive: redirect URIs, scope lists… come back in any order.
    const a = cur.map((x) => JSON.stringify(x)).sort();
    const b = desired.map((x) => JSON.stringify(x)).sort();
    return a.some((x, i) => x !== b[i]);
  }
  if (desired !== null && typeof desired === 'object') {
    if (cur === null || typeof cur !== 'object') return true;
    return Object.entries(desired as Rep).some(([k, v]) => changed((cur as Rep)[k], v));
  }
  // Keycloak drops empty config values and returns booleans/numbers as strings inside `attributes` / `config`.
  if (desired === '' && (cur === undefined || cur === null)) return false;
  return String(cur) !== String(desired);
}

/** Deep-assigns desired onto current (objects merge, scalars and arrays replace). */
function deepAssign(cur: Rep, desired: Rep): Rep {
  const out: Rep = { ...cur };
  for (const [k, v] of Object.entries(desired)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && cur[k] && typeof cur[k] === 'object' ? deepAssign(cur[k], v) : v;
  }
  return out;
}

export type { ClientScopeSpec };
