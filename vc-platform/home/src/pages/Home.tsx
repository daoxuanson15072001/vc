/** VH-MH-02 Trang chủ, phần GĐ A: lời chào, câu trạng thái, "Ứng dụng của bạn", "Sắp có". */
import { Alert, Button, Skeleton } from 'antd';
import { useMemo, useState } from 'react';
import { AppTile, SoonTile } from '../components/AppTile';
import { usePageTitle } from '../components/Shell';
import { claims, useAuth } from '../lib/auth';
import { comingSoon, myApps, readPinned, togglePin } from '../lib/catalog';
import { useCatalog } from '../lib/catalog-context';
import { greeting, statusNotice } from '../lib/messages';

export function Home() {
  usePageTitle('VC Home');
  const { state, config } = useAuth();
  const catalog = useCatalog();
  const c = claims((state as Extract<typeof state, { status: 'authenticated' }>).user);
  const [pinned, setPinned] = useState(() => readPinned(c.sub));
  const hello = useMemo(() => greeting(new Date(), c.givenName), [c.givenName]);
  const mine = myApps(catalog.apps, c.groups, pinned);
  const soon = comingSoon(catalog.apps);
  const notice = statusNotice(c.status, config.supportEmail);

  return (
    <>
      <h1 className="vh-page-title">{hello}</h1>
      {notice && <Alert className="vh-status" type={notice.type} showIcon message={notice.text} data-testid="trang-thai" />}

      <section aria-labelledby="ung-dung-cua-ban" className="vh-section">
        <h2 id="ung-dung-cua-ban" className="vh-section-title">
          Ứng dụng của bạn
        </h2>
        {catalog.loading ? (
          <ul className="vh-grid" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="vh-tile">
                <Skeleton avatar active paragraph={{ rows: 1 }} title={false} />
              </li>
            ))}
          </ul>
        ) : catalog.failed ? (
          <div className="vh-empty" role="alert">
            <p>Chưa tải được danh sách ứng dụng.</p>
            <Button onClick={catalog.retry}>Thử lại</Button>
          </div>
        ) : mine.length ? (
          <>
            <ul className="vh-grid" data-testid="luoi-app">
              {mine.map((a) => (
                <AppTile key={a.key} app={a} pinned={pinned.includes(a.key)} onTogglePin={() => setPinned(togglePin(c.sub, a.key))} />
              ))}
            </ul>
            {catalog.stale && <p className="vh-muted">Danh sách ứng dụng có thể chưa mới nhất.</p>}
          </>
        ) : (
          !notice && <p className="vh-empty">Bạn chưa được cấp ứng dụng nào. Liên hệ quản trị viên.</p>
        )}
      </section>

      {soon.length > 0 && (
        <section aria-labelledby="sap-co" className="vh-section">
          <h2 id="sap-co" className="vh-section-title">
            Sắp có
          </h2>
          <ul className="vh-grid">
            {soon.map((a) => (
              <SoonTile key={a.key} app={a} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
