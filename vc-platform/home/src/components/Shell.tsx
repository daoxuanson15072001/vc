import { useEffect, type ReactNode } from 'react';
import { Header } from './Header';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title === 'VC Home' ? title : `${title} · VC Home`;
  }, [title]);
}

/** Signed-in frame: header + content. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="vh-shell">
      <a href="#noi-dung" className="vh-skip">
        Bỏ qua tới nội dung
      </a>
      <Header />
      <main id="noi-dung" className="vh-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export function Loading({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="vh-loading" role="status" aria-live="polite">
      <img src="/vc-logo.svg" alt="" width={48} height={48} />
      <span>{label}</span>
    </div>
  );
}
