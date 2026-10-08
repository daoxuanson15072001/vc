import { Component, useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, Result, Typography } from 'antd';
import { DisconnectOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api';

/** MH-UI-06 error pages. Texts follow 00 §6 (ERR-NET, ERR-500) and the MH-UI-06 table. */

/** 6-character reference the user can quote when reporting a problem. */
export function refCode(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function NotFoundView() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="Không tìm thấy trang"
      subTitle="Đường dẫn có thể đã sai hoặc trang đã được chuyển."
      extra={
        <Button type="primary" onClick={() => navigate('/conversations')}>
          Về trang chính
        </Button>
      }
    />
  );
}

export function ServerErrorView({ onRetry, code = refCode() }: { onRetry?: () => void; code?: string }) {
  const navigate = useNavigate();
  return (
    <Result
      status="500"
      title="Có lỗi xảy ra"
      subTitle="Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút."
      extra={[
        onRetry && (
          <Button key="retry" type="primary" onClick={onRetry}>
            Thử lại
          </Button>
        ),
        <Button key="home" onClick={() => navigate('/conversations')}>
          Về trang chính
        </Button>,
      ]}
    >
      <Typography.Text type="secondary">Mã tham chiếu: {code} (gửi mã này khi báo lỗi)</Typography.Text>
    </Result>
  );
}

export function OfflineView({ onRetry }: { onRetry?: () => void }) {
  return (
    <Result
      status="warning"
      icon={<DisconnectOutlined />}
      title="Không có kết nối mạng"
      subTitle="Kiểm tra mạng rồi thử lại. Nội dung đã tải vẫn xem được."
      extra={
        <Button type="primary" onClick={onRetry ?? (() => window.location.reload())}>
          Thử lại
        </Button>
      }
    >
      <Typography.Text type="secondary">Mã tham chiếu: {refCode()} (gửi mã này khi báo lỗi)</Typography.Text>
    </Result>
  );
}

/** Picks the page for a failed page load: network down, 5xx, or null for errors the caller handles. */
export function errorViewFor(error: unknown, onRetry?: () => void): ReactNode {
  if (error instanceof ApiError && error.status === 0) return <OfflineView onRetry={onRetry} />;
  if (error instanceof ApiError && error.status >= 500) return <ServerErrorView onRetry={onRetry} />;
  return null;
}

/** Banner on top of the page while the browser is offline (ERR-NET). */
export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
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
  if (online) return null;
  return <Alert banner type="warning" message="Không có kết nối mạng. Kiểm tra mạng rồi thử lại." />;
}

/** Catches JavaScript errors of the page area; the menu and header stay usable. */
export class PageErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean; code: string }> {
  state = { failed: false, code: '' };
  static getDerivedStateFromError() {
    return { failed: true, code: refCode() };
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Result
        status="warning"
        title="Trang gặp lỗi khi hiển thị"
        subTitle="Bạn có thể tải lại trang. Nếu lỗi lặp lại, gửi mã tham chiếu cho quản trị viên."
        extra={
          <Button type="primary" onClick={() => window.location.reload()}>
            Tải lại trang
          </Button>
        }
      >
        <Typography.Text type="secondary">Mã tham chiếu: {this.state.code} (gửi mã này khi báo lỗi)</Typography.Text>
      </Result>
    );
  }
}
