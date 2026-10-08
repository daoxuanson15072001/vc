/** Thin client of the Keycloak Admin REST API (khung chung mục 3: only a few endpoints, no SDK). */
export interface KeycloakAdminOptions {
  baseUrl: string;
  /** Realm whose data is read or changed. */
  realm: string;
  /** Realm that holds the credentials (the target realm for `vc-home-api`, `master` for tools). */
  authRealm?: string;
  clientId: string;
  clientSecret?: string;
  username?: string;
  password?: string;
}

export class KeycloakError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    body: string,
  ) {
    super(`${method} ${path} → ${status}: ${body.slice(0, 200)}`);
  }
}

export class KeycloakAdmin {
  private token?: { value: string; exp: number };

  constructor(private readonly o: KeycloakAdminOptions) {}

  private get base(): string {
    return this.o.baseUrl.replace(/\/$/, '');
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.exp - 30_000 > Date.now()) return this.token.value;
    const form = new URLSearchParams({ client_id: this.o.clientId });
    if (this.o.clientSecret) {
      form.set('grant_type', 'client_credentials');
      form.set('client_secret', this.o.clientSecret);
    } else {
      form.set('grant_type', 'password');
      form.set('username', this.o.username ?? '');
      form.set('password', this.o.password ?? '');
    }
    const realm = this.o.authRealm ?? this.o.realm;
    const res = await fetch(`${this.base}/realms/${realm}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new KeycloakError(res.status, 'POST', `/realms/${realm}/token`, await res.text());
    const b = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: b.access_token, exp: Date.now() + b.expires_in * 1000 };
    return b.access_token;
  }

  /** `path` is relative to /admin/realms/<realm>. GET 404 returns undefined. */
  async call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.base}/admin/realms/${this.o.realm}${path}`;
    const res = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${await this.accessToken()}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404 && method === 'GET') return undefined as T;
    if (!res.ok) throw new KeycloakError(res.status, method, path, await res.text());
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.call<T>('GET', path);
  }
}
