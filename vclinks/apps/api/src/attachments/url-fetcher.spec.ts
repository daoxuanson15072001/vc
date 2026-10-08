import { AttachmentFetchError, UrlFetcher, allowedHost, isPrivateAddress } from './url-fetcher';

describe('attachment fetch guard (SSRF, M1c-04 gate)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('matches allowed hosts strictly', () => {
    delete process.env.ATTACHMENT_FETCH_HOSTS;
    expect(allowedHost(new URL('https://f1.zdn.vn/a.jpg'))).toBe(true);
    expect(allowedHost(new URL('https://zalo.me/x'))).toBe(true);
    expect(allowedHost(new URL('https://file-stal-16.dlfl.vn/x/bao-gia.pdf'))).toBe(true);
    expect(allowedHost(new URL('https://file-stal-16-te-vnso-ne-1.flchat.vn/x/bao-gia.pdf'))).toBe(true);
    expect(allowedHost(new URL('https://dlfl.vn.evil.com/a'))).toBe(false);
    expect(allowedHost(new URL('https://zdn.vn.evil.com/a'))).toBe(false);
    expect(allowedHost(new URL('https://evilzdn.vn/a'))).toBe(false);
    expect(allowedHost(new URL('https://zdn.vn@evil.com/a'))).toBe(false);
    expect(allowedHost(new URL('https://127.0.0.1/a'))).toBe(false);
    expect(allowedHost(new URL('https://[::1]/a'))).toBe(false);
    expect(allowedHost(new URL('http://f1.zdn.vn/a'))).toBe(false);
    expect(allowedHost(new URL('file:///etc/passwd'))).toBe(false);
  });

  it('an empty ATTACHMENT_FETCH_HOSTS (docker-compose default) means the default list, not "nothing"', () => {
    process.env.ATTACHMENT_FETCH_HOSTS = '';
    expect(allowedHost(new URL('https://f1.zdn.vn/a.jpg'))).toBe(true);
  });

  it('flags non-public addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])
      expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ['113.160.1.1', '8.8.8.8', '2001:4860:4860::8888']) expect(isPrivateAddress(ip)).toBe(false);
  });

  it('refuses an allowed name that resolves to a private address', async () => {
    process.env.ATTACHMENT_FETCH_HOSTS = 'localhost';
    process.env.ATTACHMENT_FETCH_ALLOW_HTTP = '1';
    delete process.env.ATTACHMENT_FETCH_ALLOW_PRIVATE;
    await expect(new UrlFetcher().fetchBytes('http://localhost:9/a', 10)).rejects.toEqual(new AttachmentFetchError('blocked'));
  });
});
