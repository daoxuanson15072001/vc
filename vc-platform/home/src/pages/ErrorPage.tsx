/** VH-MH-01 biến thể lỗi: `/loi?ma={mã}`; các app khác cũng chuyển người dùng tới đây. */
import { Button } from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthLayout, SupportLine } from '../components/AuthLayout';
import { usePageTitle } from '../components/Shell';
import { useAuth } from '../lib/auth';
import { errorText, stamp } from '../lib/messages';

export function ErrorPage() {
  const [params] = useSearchParams();
  const raw = params.get('ma') ?? '';
  const code = /^[a-z_]{1,40}$/.test(raw) ? raw : 'loi_chung';
  const t = errorText(code);
  usePageTitle(t.title);
  const { login, switchAccount, config } = useAuth();
  const at = useMemo(() => stamp(new Date()), []);
  const [busy, setBusy] = useState<'retry' | 'select' | null>(null);

  const go = async (kind: 'retry' | 'select') => {
    setBusy(kind);
    await (kind === 'select' ? switchAccount() : login({ next: '/' })).catch(() => setBusy(null));
  };

  return (
    <AuthLayout>
      <img src="/vc-logo.svg" alt="" width={48} height={48} className="vh-card-logo" />
      <h1 className="vh-card-title">{t.title}</h1>
      <p className="vh-card-text">{t.detail}</p>
      <div className="vh-actions">
        <Button type="primary" size="large" loading={busy === 'retry'} disabled={!!busy} onClick={() => go('retry')}>
          Thử lại
        </Button>
        {t.secondary === 'select_account' && (
          <Button size="large" loading={busy === 'select'} disabled={!!busy} onClick={() => go('select')}>
            Chọn tài khoản khác
          </Button>
        )}
        {t.secondary === 'home' && (
          <Button size="large" href="/">
            Về trang chủ
          </Button>
        )}
      </div>
      <p className="vh-code" id="ma-loi">
        Mã: {code} · {at}
      </p>
      <SupportLine email={config.supportEmail} />
    </AuthLayout>
  );
}
