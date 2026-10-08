import { Button } from 'antd';
import { AuthLayout } from '../components/AuthLayout';
import { usePageTitle } from '../components/Shell';

export function NotFound() {
  usePageTitle('Không tìm thấy trang');
  return (
    <AuthLayout>
      <img src="/vc-logo.svg" alt="" width={48} height={48} className="vh-card-logo" />
      <h1 className="vh-card-title">Không tìm thấy trang.</h1>
      <p className="vh-card-text">Đường dẫn có thể đã đổi hoặc gõ nhầm.</p>
      <Button type="primary" size="large" href="/">
        Về trang chủ
      </Button>
    </AuthLayout>
  );
}
