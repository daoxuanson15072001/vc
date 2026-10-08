import { useEffect, useState } from 'react';
import { Alert, Button, Card, Collapse, Form, Grid, Input, Typography } from 'antd';
import { GoogleOutlined, KeyOutlined } from '@ant-design/icons';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { COMPANY_DOMAINS_TEXT, type AuthConfig, type WhoAmI } from '@vclinks/shared';
import { api, ApiError, getToken, setToken } from '../api';

/** Exact texts of docs 00 MH-UI-02; the API sends only an error code (and the email). */
function loginErrorText(code: string | null, email: string | null, reason: string | null): string | null {
  if (reason === 'expired') return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  switch (code) {
    case 'outside_domain':
      return `Chỉ tài khoản ${COMPANY_DOMAINS_TEXT} được đăng nhập VClinks. Bạn đang dùng ${email ?? ''}.`;
    case 'not_granted':
      return `Tài khoản ${email ?? ''} chưa được cấp quyền dùng VClinks. Liên hệ Admin hệ thống để được thêm vào.`;
    case 'locked':
      return `Tài khoản ${email ?? ''} đã bị khóa. Liên hệ Admin hệ thống nếu đây là nhầm lẫn.`;
    case 'cancelled':
      return 'Bạn đã hủy đăng nhập Google.';
    case 'google_unreachable':
      return 'Không kết nối được Google. Vui lòng thử lại sau ít phút.';
    case 'state_invalid':
      return 'Phiên đăng nhập Google không hợp lệ hoặc đã quá 10 phút. Vui lòng thử lại.';
    default:
      return code ? 'Đăng nhập không thành công. Vui lòng thử lại.' : null;
  }
}

/** The API hands the new session back in the URL fragment; store it and clean the address bar. */
function takeSessionFromHash(): string | null {
  const p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const session = p.get('session');
  if (!session) return null;
  setToken(session);
  window.history.replaceState(null, '', window.location.pathname);
  const next = p.get('next') ?? '';
  return /^\/(?![/\\])/.test(next) ? next : '/conversations';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const screens = Grid.useBreakpoint();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [fromSso] = useState(takeSessionFromHash);

  useEffect(() => {
    api<AuthConfig>('/auth/config', { noRedirect: true })
      .then(setConfig)
      // API unreachable: keep the token form so a developer can still log in.
      .catch(() => setConfig({ ssoEnabled: false, tokenLogin: true }));
  }, []);

  if (fromSso) return <Navigate to={fromSso} replace />;
  if (getToken()) return <Navigate to="/conversations" replace />;

  const urlError = loginErrorText(params.get('error'), params.get('email'), params.get('reason'));
  const shownError = error ?? urlError;
  // Under 768 px the token form is hidden for good (MH-UI-02, phone).
  const wide = screens.md ?? true;
  const tokenForm = config?.tokenLogin && wide;

  const next = params.get('next');
  const googleHref = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`;

  const onFinish = async ({ token }: { token: string }) => {
    const t = token.trim();
    setLoading(true);
    setError(null);
    try {
      const me = await api<WhoAmI>('/me', { token: t, noRedirect: true });
      if (!me.scopes.includes('dashboard')) {
        setError('Token hợp lệ nhưng không có quyền "dashboard".');
        return;
      }
      setToken(t);
      navigate('/conversations', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Token không hợp lệ hoặc đã bị thu hồi.' : (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 16 }}>
      <div style={{ width: 400, maxWidth: '100%' }}>
        <Card>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            VClinks
          </Typography.Title>
          <Typography.Paragraph type="secondary">Chăm sóc khách hàng đa kênh</Typography.Paragraph>
          {shownError && <Alert type="error" showIcon message={shownError} style={{ marginBottom: 16 }} />}
          {config?.ssoEnabled && (
            <>
              <Button type="primary" block icon={<GoogleOutlined />} href={googleHref} disabled={loading}>
                Đăng nhập bằng Google
              </Button>
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, textAlign: 'center' }}>
                Chỉ dùng tài khoản {COMPANY_DOMAINS_TEXT}
              </Typography.Text>
            </>
          )}
          {tokenForm && (
            <Collapse
              ghost
              style={{ marginTop: config?.ssoEnabled ? 16 : 0 }}
              // Without SSO the token is the only way in, so the form starts open.
              defaultActiveKey={config?.ssoEnabled ? [] : ['token']}
              items={[
                {
                  key: 'token',
                  label: 'Đăng nhập bằng token nội bộ',
                  children: (
                    <Form layout="vertical" onFinish={onFinish} requiredMark={false} disabled={false}>
                      <Form.Item
                        name="token"
                        label="Token truy cập"
                        rules={[{ required: true, whitespace: true, message: 'Nhập token' }]}
                      >
                        <Input.Password prefix={<KeyOutlined />} placeholder="Dán token vào đây" autoFocus={!config?.ssoEnabled} />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" block loading={loading}>
                        Đăng nhập
                      </Button>
                    </Form>
                  ),
                },
              ]}
            />
          )}
        </Card>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 16, textAlign: 'center' }}>
          VC Phồn Vinh · VCsoft
        </Typography.Text>
      </div>
    </div>
  );
}
