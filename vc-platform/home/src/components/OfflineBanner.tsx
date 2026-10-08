import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** LOI-MANG (06 mục 1.4). */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="vh-offline" role="alert">
      Không có kết nối mạng. Kiểm tra mạng rồi thử lại.
    </div>
  );
}
