/** VH-MH-01: trang chào, đã đăng xuất, phiên hết hạn. */
import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout, SupportLine } from '../components/AuthLayout';
import { IconInfo, IconLogin } from '../components/icons';
import { useOnline } from '../components/OfflineBanner';
import { usePageTitle } from '../components/Shell';
import { SWITCH_STATE, useAuth } from '../lib/auth';
import { authErrorCode } from '../lib/messages';

export type WelcomeVariant = 'welcome' | 'signed_out' | 'expired';

const TEXT: Record<WelcomeVariant, { title: string; detail?: string; button: string }> = {
  welcome: { title: 'VC Home', detail: 'Cổng làm việc của nhân viên VC Phồn Vinh.', button: 'Đăng nhập bằng tài khoản công ty' },
  signed_out: { title: 'Bạn đã đăng xuất khỏi mọi ứng dụng', detail: 'Phiên ở VC Home, VClinks, VCwiki và các app khác đã đóng.', button: 'Đăng nhập lại' },
  expired: { title: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', button: 'Đăng nhập lại' },
};

export function Welcome({ variant = 'welcome' }: { variant?: WelcomeVariant }) {
  const t = TEXT[variant];
  usePageTitle(variant === 'welcome' ? 'VC Home' : variant === 'signed_out' ? 'Đã đăng xuất' : 'Phiên hết hạn');
  const { login, config, userManager } = useAuth();
  const online = useOnline();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // Signed out to choose another account (ErrorPage "Chọn tài khoản khác"): continue to Google at once.
  useEffect(() => {
    if (variant !== 'signed_out' || !new URLSearchParams(window.location.search).has('state')) return;
    userManager
      .signoutRedirectCallback()
      .then((r) => {
        if (r.userState !== SWITCH_STATE) return;
        setBusy(true);
        return login({ next: '/', selectAccount: true });
      })
      .catch(() => setBusy(false));
  }, [variant, userManager, login]);

  const start = async () => {
    setBusy(true);
    try {
      // Signed out: start from home. Otherwise come back to the page being viewed (VH-AUT-05 mục 5).
      await login(variant === 'signed_out' ? { next: '/' } : {});
    } catch (e) {
      setBusy(false);
      navigate(`/loi?ma=${authErrorCode(e)}`);
    }
  };

  return (
    <AuthLayout intro={variant === 'welcome'}>
      <img src="/vc-logo.svg" alt="" width={48} height={48} className="vh-card-logo" />
      <h1 className="vh-card-title">{t.title}</h1>
      {t.detail && <p className="vh-card-text">{t.detail}</p>}
      <Button type="primary" size="large" block icon={busy ? undefined : <IconLogin />} loading={busy} disabled={!online} onClick={start}>
        {busy ? 'Đang chuyển tới trang đăng nhập…' : t.button}
      </Button>
      <p className="vh-note">
        <IconInfo />
        <span>
          Chỉ nhận tài khoản <b>@vcprosperous.com</b> hoặc <b>@vcpart.vn</b>. Bạn chọn tài khoản Google một lần, các ứng dụng khác tự nhận.
        </span>
      </p>
      <SupportLine email={config.supportEmail} />
    </AuthLayout>
  );
}
