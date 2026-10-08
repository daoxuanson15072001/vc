import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

/** One realm as described in our YAML files (a subset of the Keycloak representation plus a few helpers). */
export interface RealmSpec {
  realm: string;
  /** Plain realm attributes copied onto the RealmRepresentation (displayName, loginTheme, timeouts…). */
  settings?: Record<string, unknown>;
  /** Declarative user profile: unmanaged attribute policy, and an allowed email pattern (email becomes admin-only). */
  userProfile?: {
    unmanagedAttributePolicy?: 'ENABLED' | 'ADMIN_EDIT' | 'ADMIN_VIEW';
    email?: { pattern: string; errorMessage: string };
  };
  /** Realm default client scopes (added to every new client). */
  defaultClientScopes?: string[];
  clientScopes?: ClientScopeSpec[];
  groups?: string[];
  clients?: ClientSpec[];
  identityProviders?: IdentityProviderSpec[];
  /** Config of an authenticator execution inside a built-in flow, matched by provider id. */
  authenticatorConfigs?: { flow: string; provider: string; alias: string; config: Record<string, string> }[];
  users?: UserSpec[];
  /** Realm roles granted to the service account of a client, or client roles of another client. */
}

export interface MapperSpec {
  name: string;
  protocolMapper: string;
  protocol?: string;
  config: Record<string, string>;
}

export interface ClientScopeSpec {
  name: string;
  protocol?: string;
  attributes?: Record<string, string>;
  protocolMappers?: MapperSpec[];
}

export interface ClientSpec {
  clientId: string;
  name?: string;
  enabled?: boolean;
  publicClient?: boolean;
  secret?: string;
  serviceAccountsEnabled?: boolean;
  standardFlowEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
  implicitFlowEnabled?: boolean;
  frontchannelLogout?: boolean;
  fullScopeAllowed?: boolean;
  consentRequired?: boolean;
  rootUrl?: string;
  baseUrl?: string;
  redirectUris?: string[];
  webOrigins?: string[];
  attributes?: Record<string, string>;
  defaultClientScopes?: string[];
  optionalClientScopes?: string[];
  protocolMappers?: MapperSpec[];
  /** Roles of the client itself (client roles), e.g. vchome: hcns, qtht… */
  roles?: string[];
  /** Roles granted to this client's service account: { "<clientId>": [role, …] } or { realm: [role] }. */
  serviceAccountRoles?: Record<string, string[]>;
}

export interface IdentityProviderSpec {
  alias: string;
  providerId: string;
  displayName?: string;
  enabled?: boolean;
  trustEmail?: boolean;
  storeToken?: boolean;
  firstBrokerLoginFlowAlias?: string;
  hideOnLogin?: boolean;
  config: Record<string, string>;
  mappers?: { name: string; identityProviderMapper: string; config: Record<string, string> }[];
}

export interface UserSpec {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  password?: string;
  attributes?: Record<string, string[]>;
  groups?: string[];
}

/** Replaces ${NAME} and ${NAME:-default} with environment values. Unset variables without default are an error. */
export function substituteEnv(text: string, env: NodeJS.ProcessEnv = process.env): string {
  const missing: string[] = [];
  const out = text.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_m, name: string, def?: string) => {
    const v = env[name];
    if (v !== undefined && v !== '') return v;
    if (def !== undefined) return def;
    missing.push(name);
    return '';
  });
  if (missing.length) throw new Error(`Thiếu biến môi trường: ${[...new Set(missing)].join(', ')}`);
  return out;
}

const KEYS: Record<string, string> = {
  clientScopes: 'name',
  protocolMappers: 'name',
  clients: 'clientId',
  identityProviders: 'alias',
  mappers: 'name',
  users: 'username',
  authenticatorConfigs: 'alias',
};

/** Deep merge used to lay an overlay file (dev, staging) over the base file. Keyed arrays merge item by item. */
export function deepMerge(base: unknown, over: unknown, key?: string): unknown {
  if (over === undefined) return base;
  if (Array.isArray(base) && Array.isArray(over)) {
    const id = key ? KEYS[key] : undefined;
    if (!id) return over;
    const out = base.map((b) => ({ ...b }));
    for (const o of over) {
      const i = out.findIndex((b) => b[id] === o[id]);
      if (i >= 0) out[i] = deepMerge(out[i], o) as Record<string, unknown>;
      else out.push(o);
    }
    return out;
  }
  if (isObject(base) && isObject(over)) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = deepMerge(out[k], v, k);
    return out;
  }
  return over;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function loadSpec(files: string[], env: NodeJS.ProcessEnv = process.env): RealmSpec {
  let merged: unknown = {};
  for (const f of files) {
    const doc = parse(substituteEnv(readFileSync(f, 'utf8'), env));
    merged = deepMerge(merged, doc);
  }
  const spec = merged as RealmSpec;
  if (!spec.realm) throw new Error('Tệp cấu hình thiếu khoá `realm`');
  return spec;
}
