/**
 * Runtime config: `/config.json`. Dev uses the committed file; the production container writes it from env at start
 * (one image for staging and production).
 */
export interface HomeConfig {
  authority: string;
  clientId: string;
  supportEmail: string;
  companyDomains: string[];
  /** While the person is active, ask VC ID this often whether the session still exists (an admin lock is not visible
   * to the browser otherwise). */
  sessionCheckSeconds: number;
}

export async function loadConfig(): Promise<HomeConfig> {
  const res = await fetch('/config.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`config.json ${res.status}`);
  const c = (await res.json()) as Partial<HomeConfig>;
  if (!c.authority) throw new Error('config.json thiếu authority');
  return {
    authority: c.authority,
    clientId: c.clientId ?? 'vchome',
    supportEmail: c.supportEmail ?? 'it@vcprosperous.com',
    companyDomains: c.companyDomains ?? ['vcprosperous.com', 'vcpart.vn'],
    sessionCheckSeconds: c.sessionCheckSeconds ?? 60,
  };
}
