/** Layout of VH-MH-01: one card in the middle; on wide screens an introduction panel on the left. */
import type { ReactNode } from 'react';
import { IconCheck } from './icons';

export function AuthLayout({ intro = false, children }: { intro?: boolean; children: ReactNode }) {
  return (
    <div className={`vh-auth${intro ? ' has-intro' : ''}`}>
      <main id="noi-dung" className="vh-auth-main">
        <div className="vh-card">{children}</div>
      </main>
      {intro && (
        <aside className="vh-intro" aria-label="Giới thiệu VC Home">
          <div className="vh-intro-brand">
            <img src="/vc-logo.svg" alt="" width={40} height={40} />
            <span>VC Phồn Vinh</span>
          </div>
          <div>
            <p className="vh-eyebrow">VC HOME</p>
            <p className="vh-intro-title">Một lần đăng nhập, mọi ứng dụng của công ty.</p>
            <p className="vh-intro-text">Bạn dùng tài khoản Google công ty để vào mọi ứng dụng, không còn mật khẩu riêng cho từng ứng dụng.</p>
            <ul className="vh-intro-list">
              <li>
                <IconCheck /> Dùng tài khoản Google Workspace của công ty
              </li>
              <li>
                <IconCheck /> Đăng xuất một lần là đóng phiên ở mọi ứng dụng
              </li>
            </ul>
          </div>
          <p className="vh-intro-apps">Dùng chung một tài khoản: VClinks, VCwiki và các ứng dụng sau này.</p>
        </aside>
      )}
    </div>
  );
}

export function SupportLine({ email }: { email: string }) {
  return (
    <p className="vh-support">
      Cần giúp? Gửi email tới <a href={`mailto:${email}`}>{email}</a>
    </p>
  );
}
