/** VH-MH-03, bản GĐ A: thông tin từ Google Workspace qua VC ID; không sửa ở đây. */
import { App as AntApp, Button } from 'antd';
import { usePageTitle } from '../components/Shell';
import { IconCopy } from '../components/icons';
import { UserAvatar } from '../components/UserAvatar';
import { claims, useAuth } from '../lib/auth';
import { myApps } from '../lib/catalog';
import { useCatalog } from '../lib/catalog-context';

export function Profile() {
  usePageTitle('Hồ sơ của tôi');
  const { state } = useAuth();
  const { apps } = useCatalog();
  const { message } = AntApp.useApp();
  const c = claims((state as Extract<typeof state, { status: 'authenticated' }>).user);
  const mine = myApps(apps, c.groups);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.email);
      void message.success('Đã sao chép email.');
    } catch {
      void message.error('Không sao chép được. Hãy chọn email rồi sao chép.');
    }
  };

  return (
    <>
      <h1 className="vh-page-title">Hồ sơ của tôi</h1>
      <section className="vh-panel vh-profile" aria-label="Thông tin tài khoản">
        <UserAvatar sub={c.sub} name={c.name} email={c.email} picture={c.picture} size={72} />
        <div className="vh-profile-info">
          <p className="vh-profile-name">{c.name || c.email}</p>
          <p className="vh-profile-line">
            <span data-testid="email">{c.email}</span>
            <Button type="text" size="small" icon={<IconCopy />} onClick={copy} aria-label="Sao chép email" />
          </p>
          <p className="vh-profile-line vh-muted">Tên miền: {c.hd ?? c.email.split('@')[1]}</p>
        </div>
      </section>

      <section className="vh-panel" aria-labelledby="app-duoc-dung">
        <h2 id="app-duoc-dung" className="vh-section-title">
          Ứng dụng được dùng
        </h2>
        {mine.length ? (
          <ul className="vh-list" data-testid="app-duoc-dung">
            {mine.map((a) => (
              <li key={a.key}>
                <img src={a.icon} alt="" width={24} height={24} />
                <a href={a.url ?? undefined}>{a.name}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="vh-muted">Chưa có ứng dụng nào.</p>
        )}
      </section>

      <p className="vh-muted vh-source">Thông tin lấy từ Google Workspace, sửa ở Google.</p>
    </>
  );
}
