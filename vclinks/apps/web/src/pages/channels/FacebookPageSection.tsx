import { useEffect } from 'react';
import { Alert, App, Button, Card, Collapse, List, Popconfirm, Space, Tag, Typography } from 'antd';
import Can from '../../components/access/Can';
import { DisconnectOutlined, FacebookFilled, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { fmtTime } from '../../time';

/** Mirrors FbPageStatus / FbChannelStatus of apps/api/src/channels/facebook-page (no secrets). */
interface FbPageStatus {
  uid: string;
  pageId: string;
  name: string;
  status: 'connected' | 'disconnected';
  subscribed: boolean;
  hasCredentials: boolean;
  connectedAt: string;
  connectedBy: string;
  lastWebhookAt: string | null;
  tokenInvalidAt: string | null;
  lastError: string | null;
}

interface FbChannelStatus {
  graphVersion: string;
  configured: { appId: boolean; appSecret: boolean; verifyToken: boolean; publicBaseUrl: boolean; credentialsKey: boolean };
  webhookUrl: string | null;
  callbackUrl: string | null;
  subscribedFields: string[];
  scopes: string[];
  pages: FbPageStatus[];
}

const ENV_NAMES: Record<keyof FbChannelStatus['configured'], string> = {
  appId: 'FB_APP_ID',
  appSecret: 'FB_APP_SECRET',
  verifyToken: 'FB_VERIFY_TOKEN',
  publicBaseUrl: 'PUBLIC_BASE_URL',
  credentialsKey: 'CREDENTIALS_KEY',
};

/** Reasons carried back by the OAuth callback redirect (`/channels?fb_page=error&reason=...`). */
const CALLBACK_ERRORS: Record<string, string> = {
  state: 'Phiên kết nối đã hết hạn hoặc không hợp lệ. Hãy bấm "Kết nối Fanpage" lại.',
  denied: 'Bạn đã hủy hoặc không cấp quyền trên Facebook.',
  exchange: 'Không đổi được mã đăng nhập Facebook lấy token. Kiểm tra FB_APP_ID, FB_APP_SECRET và Valid OAuth Redirect URI.',
  no_pages: 'Facebook không trả về Fanpage nào. Hãy chọn ít nhất một Fanpage trong hộp thoại đăng nhập.',
  config: 'Máy chủ chưa cấu hình đủ biến môi trường cho Facebook.',
};

function PageStatusTags({ p }: { p: FbPageStatus }) {
  if (p.status === 'disconnected') return <Tag>Đã ngắt kết nối</Tag>;
  return (
    <Space size={4} wrap>
      {p.tokenInvalidAt ? <Tag color="red">Token hết hạn, cần kết nối lại</Tag> : <Tag color="green">Đang kết nối</Tag>}
      {p.subscribed ? <Tag color="blue">Đã đăng ký webhook</Tag> : <Tag color="orange">Chưa đăng ký webhook</Tag>}
      {!p.hasCredentials && <Tag color="red">Thiếu token</Tag>}
    </Space>
  );
}

export default function FacebookPageSection() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();

  const status = useQuery({
    queryKey: ['fb-page'],
    queryFn: () => api<FbChannelStatus>('/channels/facebook-page'),
  });

  // Result of the Facebook Login round trip, then clean the URL.
  useEffect(() => {
    const r = params.get('fb_page');
    if (!r) return;
    if (r === 'ok') {
      const connected = Number(params.get('connected') ?? 0);
      const failed = Number(params.get('failed') ?? 0);
      if (failed) message.warning(`Đã kết nối ${connected} Fanpage, ${failed} Fanpage chưa đăng ký được webhook`);
      else message.success(`Đã kết nối ${connected} Fanpage`);
    } else {
      message.error(CALLBACK_ERRORS[params.get('reason') ?? ''] ?? 'Kết nối Fanpage thất bại');
    }
    const next = new URLSearchParams(params);
    for (const k of ['fb_page', 'connected', 'failed', 'reason']) next.delete(k);
    setParams(next, { replace: true });
    qc.invalidateQueries({ queryKey: ['fb-page'] });
    qc.invalidateQueries({ queryKey: ['accounts'] });
  }, [params, setParams, message, qc]);

  const connect = useMutation({
    mutationFn: () => api<{ url: string }>('/channels/facebook-page/connect'),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (e) => message.error((e as Error).message),
  });

  const disconnect = useMutation({
    mutationFn: (uid: string) => api<{ ok: boolean; unsubscribed: boolean }>(`/channels/facebook-page/${encodeURIComponent(uid)}`, { method: 'DELETE' }),
    onSuccess: (r) => {
      message.success(r.unsubscribed ? 'Đã ngắt kết nối Fanpage' : 'Đã xóa token Fanpage (không hủy được webhook phía Facebook)');
      qc.invalidateQueries({ queryKey: ['fb-page'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e) => message.error((e as Error).message),
  });

  const s = status.data;
  const missing = s ? (Object.keys(ENV_NAMES) as (keyof typeof ENV_NAMES)[]).filter((k) => !s.configured[k]) : [];
  const canConnect = !!s && missing.filter((k) => k !== 'verifyToken').length === 0;

  return (
    <Card
      title={
        <Space>
          <FacebookFilled style={{ color: 'var(--ch-fb-page)' }} />
          Fanpage Facebook
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => status.refetch()} loading={status.isFetching} />
          <Can perm="channel.connect">
            <Button type="primary" onClick={() => connect.mutate()} loading={connect.isPending} disabled={!canConnect}>
              Kết nối Fanpage
            </Button>
          </Can>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          Nhận và trả lời tin nhắn Messenger của Fanpage bằng API chính thức của Meta. Khi bấm "Kết nối Fanpage", Facebook sẽ hỏi
          bạn chọn những Fanpage cho phép VClinks truy cập; mọi Fanpage bạn chọn sẽ được kết nối.
        </Typography.Paragraph>

        {status.isError && <Alert type="error" showIcon message="Không tải được trạng thái Fanpage" description={(status.error as Error).message} />}

        {missing.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="Máy chủ chưa cấu hình đủ"
            description={
              <>
                Thiếu biến môi trường: {missing.map((k) => <Typography.Text code key={k}>{ENV_NAMES[k]}</Typography.Text>)}. Xem hướng dẫn
                trong <Typography.Text code>docs/channels/facebook-page.md</Typography.Text>.
              </>
            }
          />
        )}

        <List<FbPageStatus>
          loading={status.isLoading}
          dataSource={s?.pages ?? []}
          locale={{ emptyText: 'Chưa kết nối Fanpage nào' }}
          renderItem={(p) => (
            <List.Item
              actions={
                p.status === 'connected'
                  ? [
                      <Can key="off" perm="channel.connect">
                        <Popconfirm
                        title="Ngắt kết nối Fanpage này?"
                        description="Hủy nhận webhook và xóa token. Lịch sử tin nhắn vẫn được giữ."
                        okText="Ngắt kết nối"
                        cancelText="Hủy"
                        onConfirm={() => disconnect.mutate(p.uid)}
                      >
                        <Button danger size="small" icon={<DisconnectOutlined />} loading={disconnect.isPending && disconnect.variables === p.uid}>
                          Ngắt kết nối
                        </Button>
                      </Popconfirm>
                      </Can>,
                    ]
                  : [
                      <Can key="re" perm="channel.connect">
                        <Button size="small" onClick={() => connect.mutate()} disabled={!canConnect}>
                          Kết nối lại
                        </Button>
                      </Can>,
                    ]
              }
            >
              <List.Item.Meta
                title={
                  <Space wrap>
                    <span>{p.name}</span>
                    <Typography.Text type="secondary">{p.uid}</Typography.Text>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <PageStatusTags p={p} />
                    <Typography.Text type="secondary">
                      Kết nối lúc {fmtTime(p.connectedAt)} bởi {p.connectedBy} · Webhook gần nhất: {fmtTime(p.lastWebhookAt)}
                    </Typography.Text>
                    {p.lastError && <Typography.Text type="danger">{p.lastError}</Typography.Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />

        <Alert
          type="info"
          showIcon
          message="Khung 24 giờ của Messenger"
          description="Fanpage chỉ trả lời được trong 24 giờ kể từ tin nhắn cuối của khách. Tin đã duyệt nhưng ngoài khung sẽ báo lỗi, không tự gửi. Tag HUMAN_AGENT (7 ngày) cần Meta duyệt riêng và chưa được bật."
        />

        {s && (
          <Collapse
            size="small"
            items={[
              {
                key: 'setup',
                label: 'Hướng dẫn cấu hình Meta App',
                children: (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div>
                      <Typography.Text strong>OAuth Redirect URI</Typography.Text> (Facebook Login → Settings → Valid OAuth Redirect URIs):{' '}
                      {s.callbackUrl ? <Typography.Text code copyable>{s.callbackUrl}</Typography.Text> : <Typography.Text type="warning">cần đặt PUBLIC_BASE_URL</Typography.Text>}
                    </div>
                    <div>
                      <Typography.Text strong>Webhook Callback URL</Typography.Text> (Messenger → Webhooks):{' '}
                      {s.webhookUrl ? <Typography.Text code copyable>{s.webhookUrl}</Typography.Text> : <Typography.Text type="warning">cần đặt PUBLIC_BASE_URL</Typography.Text>}
                    </div>
                    <div>
                      <Typography.Text strong>Verify token</Typography.Text>: nhập đúng giá trị biến <Typography.Text code>FB_VERIFY_TOKEN</Typography.Text> trong file{' '}
                      <Typography.Text code>.env</Typography.Text> của máy chủ ({s.configured.verifyToken ? 'đã đặt' : 'chưa đặt'}). Vì lý do bảo mật, giá trị không hiển thị ở đây.
                    </div>
                    <div>
                      <Typography.Text strong>Trường webhook</Typography.Text>:{' '}
                      {s.subscribedFields.map((f) => <Tag key={f}>{f}</Tag>)} (VClinks tự đăng ký cho từng Fanpage khi kết nối)
                    </div>
                    <div>
                      <Typography.Text strong>Quyền cần xin</Typography.Text>: {s.scopes.map((f) => <Tag key={f}>{f}</Tag>)}
                    </div>
                    <Typography.Text type="secondary">
                      Graph API {s.graphVersion}. URL công khai phải cố định (tên miền hoặc Cloudflare named tunnel); URL quick tunnel đổi mỗi lần khởi động
                      lại nên webhook sẽ ngừng nhận tin.
                    </Typography.Text>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Space>
    </Card>
  );
}
