/** Google Directory: who exists on Google, suspended or not, 2-step verification on or not. */
import { readFileSync } from 'node:fs';
import { importPKCS8, SignJWT } from 'jose';

export interface GoogleUser {
  /** Google user id; equals the `sub` Google puts in OpenID tokens (checked against real Google in SSO-00). */
  id: string;
  email: string;
  givenName?: string;
  familyName?: string;
  suspended: boolean;
  archived: boolean;
  isEnrolledIn2Sv: boolean;
  /** Workspace domain (`hd`). */
  domain: string;
}

export interface GoogleDirectory {
  /** Every user of every configured Workspace, including suspended and archived ones. */
  listUsers(): Promise<GoogleUser[]>;
}

const domainOf = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';

/**
 * Real Directory API through a service account with domain-wide delegation
 * (scope admin.directory.user.readonly, impersonating a Workspace admin). One instance per Workspace (I4, I6).
 */
export class RealGoogleDirectory implements GoogleDirectory {
  constructor(
    private readonly keyFile: string,
    private readonly adminSubject: string,
    private readonly domains: string[],
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async token(): Promise<string> {
    const key = JSON.parse(readFileSync(this.keyFile, 'utf8')) as { client_email: string; private_key: string };
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/admin.directory.user.readonly' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(key.client_email)
      .setSubject(this.adminSubject)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(await importPKCS8(key.private_key, 'RS256'));
    const res = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!res.ok) throw new Error(`Google token ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return ((await res.json()) as { access_token: string }).access_token;
  }

  async listUsers(): Promise<GoogleUser[]> {
    const token = await this.token();
    const out: GoogleUser[] = [];
    for (const domain of this.domains) {
      let pageToken: string | undefined;
      do {
        const q = new URLSearchParams({ domain, maxResults: '500', projection: 'basic' });
        if (pageToken) q.set('pageToken', pageToken);
        const res = await this.fetchImpl(`https://admin.googleapis.com/admin/directory/v1/users?${q}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Directory ${domain} ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const body = (await res.json()) as { users?: any[]; nextPageToken?: string };
        for (const u of body.users ?? []) {
          out.push({
            id: String(u.id),
            email: String(u.primaryEmail).toLowerCase(),
            givenName: u.name?.givenName,
            familyName: u.name?.familyName,
            suspended: !!u.suspended,
            archived: !!u.archived,
            isEnrolledIn2Sv: !!u.isEnrolledIn2Sv,
            domain: domainOf(u.primaryEmail),
          });
        }
        pageToken = body.nextPageToken;
      } while (pageToken);
    }
    return out;
  }
}

/** Fake Directory for dev and CI: a JSON file; ids can be resolved from the fake Google realm by email. */
export class FileGoogleDirectory implements GoogleDirectory {
  constructor(
    private readonly file: string,
    private readonly resolveId?: (email: string) => Promise<string | undefined>,
  ) {}

  async listUsers(): Promise<GoogleUser[]> {
    const rows = JSON.parse(readFileSync(this.file, 'utf8')) as (Partial<GoogleUser> & { email: string })[];
    const out: GoogleUser[] = [];
    for (const r of rows) {
      const email = r.email.toLowerCase();
      const id = r.id && r.id !== 'auto' ? r.id : await this.resolveId?.(email);
      if (!id) throw new Error(`Directory giả: không tìm được id cho ${email}`);
      out.push({
        id,
        email,
        givenName: r.givenName,
        familyName: r.familyName,
        suspended: !!r.suspended,
        archived: !!r.archived,
        isEnrolledIn2Sv: !!r.isEnrolledIn2Sv,
        domain: domainOf(email),
      });
    }
    return out;
  }
}
