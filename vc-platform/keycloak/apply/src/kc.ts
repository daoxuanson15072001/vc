/** Minimal Keycloak Admin REST client (only what realm-apply and vc-provisioner need). */
export interface KcAuth {
  baseUrl: string;
  /** Realm that holds the admin credentials (master for the bootstrap admin). */
  authRealm?: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
}

export class KcError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: string,
  ) {
    super(`${method} ${path} → ${status}: ${body.slice(0, 300)}`);
  }
}

export class KcAdmin {
  private token?: { value: string; exp: number };

  constructor(private readonly auth: KcAuth) {}

  get baseUrl(): string {
    return this.auth.baseUrl.replace(/\/$/, '');
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.exp - 30_000 > Date.now()) return this.token.value;
    const a = this.auth;
    const realm = a.authRealm ?? 'master';
    const form = new URLSearchParams();
    if (a.clientSecret) {
      form.set('grant_type', 'client_credentials');
      form.set('client_id', a.clientId ?? '');
      form.set('client_secret', a.clientSecret);
    } else {
      form.set('grant_type', 'password');
      form.set('client_id', a.clientId ?? 'admin-cli');
      form.set('username', a.username ?? '');
      form.set('password', a.password ?? '');
    }
    const res = await fetch(`${this.baseUrl}/realms/${realm}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!res.ok) throw new KcError(res.status, 'POST', `/realms/${realm}/token`, await res.text());
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, exp: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  /** Calls `/admin/realms/…`; returns parsed JSON, or the id from `Location` for 201 without body. */
  async call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/admin/realms${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 404 && method === 'GET') return undefined as T;
    if (!res.ok) throw new KcError(res.status, method, path, await res.text());
    if (res.status === 201) {
      const loc = res.headers.get('location');
      return (loc ? loc.substring(loc.lastIndexOf('/') + 1) : undefined) as T;
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.call<T>('GET', path);
  }
  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.call<T>('POST', path, body ?? {});
  }
  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.call<T>('PUT', path, body ?? {});
  }
  del<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.call<T>('DELETE', path, body);
  }
}

export function kcAuthFromEnv(env: NodeJS.ProcessEnv = process.env): KcAuth {
  return {
    baseUrl: env.KC_URL ?? 'http://localhost:8180',
    authRealm: env.KC_AUTH_REALM ?? 'master',
    username: env.KC_ADMIN_USER,
    password: env.KC_ADMIN_PASSWORD,
    clientId: env.KC_ADMIN_CLIENT_ID,
    clientSecret: env.KC_ADMIN_CLIENT_SECRET,
  };
}
