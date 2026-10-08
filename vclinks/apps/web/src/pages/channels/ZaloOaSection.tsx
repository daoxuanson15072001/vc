import { useEffect } from 'react';
import { Alert, App, Avatar, Button, Card, Collapse, List, Popconfirm, Space, Tag, Typography } from 'antd';
import Can from '../../components/access/Can';
import { DisconnectOutlined, MessageOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { dayjs, fmtTime } from '../../time';

/** Mirrors ZaloOaStatus / ZaloOaChannelStatus of apps/api/src/channels/zalo-oa (no secrets). */
interface ZaloOaStatus {
  uid: string;
  oaId: string;
  name: string;
  avatar: string | null;
  status: 'connected' | 'disconnected';
  hasCredentials: boolean;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  lastRefreshAt: string | null;
  needsReconnect: boolean;
  lastError: string | null;
  lastWebhookAt: string | null;
  connectedAt: string;
  connectedBy: string;
}

interface ZaloOaChannelStatus {
  configured: { appId: boolean; secretKey: boolean; publicBaseUrl: boolean; credentialsKey: boolean; webhookSecret: boolean };
  callbackUrl: string | null;
  webhookUrl: string | null;
  events: string[];
  accounts: ZaloOaStatus[];
}

const ENV_NAMES: Partial<Record<keyof ZaloOaChannelStatus['configured'], string>> = {
  appId: 'ZALO_OA_APP_ID',
  secretKey: 'ZALO_OA_SECRET_KEY',
  publicBaseUrl: 'PUBLIC_BASE_URL',
  credentialsKey: 'CREDENTIALS_KEY',
};

/** Reasons carried back by the OAuth callback redirect (`/channels?zalo_oa=error&reason=...`). */
const CALLBACK_ERRORS: Record<string, string> = {
  missing_state: 'Zalo không trả về mã phiên kết nối. Hãy bấm "Kết nối Zalo OA" lại.',
  invalid_state: 'Phiên kết nối đã hết hạn (quá 10 phút) hoặc không hợp lệ. Hãy bấm "Kết nối Zalo OA" lại.',
  denied: 'Bạn đã hủy hoặc chưa cấp quyền cho ứng dụng trên Zalo.',
  token_exchange: 'Zalo từ chối đổi mã ủy quyền lấy token. Kiểm tra ZALO_OA_APP_ID, ZALO_OA_SECRET_KEY và Callback URL trong cài đặt ứng dụng.',
  network: 'Không kết nối được máy chủ Zalo. Hãy thử lại.',
  no_oa_id: 'Không xác định được OA vừa cấp quyền. Kiểm tra quyền "Quản lý thông tin OA" của ứng dụng.',
};

function TokenTags({ a }: { a: ZaloOaStatus }) {
  if (a.status === 'disconnected') return <Tag>Đã ngắt kết nối</Tag>;
  if (a.needsReconnect || !a.hasCredentials) return <Tag color="red">Cần kết nối lại</Tag>;
  const exp = a.accessExpiresAt ? dayjs(a.accessExpiresAt) : null;
  const expired = !!exp && exp.isBefore(dayjs());
  return (
    <Space size={4} wrap>
      <Tag color="green">Đang kết nối</Tag>
      {exp && (
        <Tag color={expired ? 'orange' : 'blue'}>
          {expired ? 'Access token đã hết hạn, sẽ tự làm mới' : `Access token hết hạn ${fmtTime(a.accessExpiresAt)}`}
        </Tag>
      )}
    </Space>
  );
}

export default function ZaloOaSection() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();

  const status = useQuery({
    queryKey: ['zalo-oa'],
    queryFn: () => api<ZaloOaChannelStatus>('/channels/zalo-oa'),
  });

  // Result of the OAuth round trip, then remove our keys from the URL.
  useEffect(() => {
    const r = params.get('zalo_oa');
    if (!r) return;
    if (r === 'connected') message.success('Đã kết nối Zalo OA');
    else message.error(CALLBACK_ERRORS[params.get('reason') ?? ''] ?? 'Kết nối Zalo OA thất bại');
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const k of ['zalo_oa', 'uid', 'reason']) next.delete(k);
        return next;
      },
      { replace: true },
    );
    qc.invalidateQueries({ queryKey: ['zalo-oa'] });
    qc.invalidateQueries({ queryKey: ['accounts'] });
  }, [params, setParams, message, qc]);

  const connect = useMutation({
    mutationFn: () => api<{ url: string }>('/channels/zalo-oa/connect'),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (e) => message.error((e as Error).message),
  });

  const disconnect = useMutation({
    mutationFn: (uid: string) => api<{ ok: boolean }>(`/channels/zalo-oa/${encodeURIComponent(uid)}`, { method: 'DELETE' }),
    onSuccess: () => {
      message.success('Đã ngắt kết nối Zalo OA');
      qc.invalidateQueries({ queryKey: ['zalo-oa'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e) => message.error((e as Error).message),
  });

  const s = status.data;
  const missing = s ? (Object.keys(ENV_NAMES) as (keyof typeof ENV_NAMES)[]).filter((k) => !s.configured[k]) : [];
  const canConnect = !!s && missing.length === 0;
  const needReconnect = (s?.accounts ?? []).filter((a) => a.status === 'connected' && (a.needsReconnect || !a.hasCredentials));

  return (
    <Card
      title={
        <Space>
          <MessageOutlined style={{ color: 'var(--ch-zalo-oa)' }} />
          Zalo OA
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => status.refetch()} loading={status.isFetching} />
          <Can perm="channel.connect">
            <Button type="primary" onClick={() => connect.mutate()} loading={connect.isPending} disabled={!canConnect}>
              Kết nối Zalo OA
            </Button>
          </Can>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          Nhận và trả lời tin nhắn của Zalo Official Account bằng API chính thức. Khi bấm "Kết nối Zalo OA", Zalo sẽ hỏi admin OA chọn
          OA và cấp quyền cho ứng dụng. Token được lưu mã hóa trên máy chủ và tự làm mới trước khi hết hạn.
        </Typography.Paragraph>

        {status.isError && <Alert type="error" showIcon message="Không tải được trạng thái Zalo OA" description={(status.error as Error).message} />}

        {missing.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="Máy chủ chưa cấu hình đủ"
            description={
              <>
                Thiếu biến môi trường:{' '}
                {missing.map((k) => (
                  <Typography.Text code key={k}>
                    {ENV_NAMES[k]}
                  </Typography.Text>
                ))}
                . Xem hướng dẫn trong <Typography.Text code>docs/channels/zalo-oa.md</Typography.Text>.
              </>
            }
          />
        )}

        {needReconnect.length > 0 && (
          <Alert
            type="error"
            showIcon
            message={`${needReconnect.length} OA cần kết nối lại`}
            description="Zalo đã từ chối refresh token (hết hạn 3 tháng, bị thu hồi hoặc OA gỡ quyền ứng dụng). Tin nhắn duyệt gửi qua OA này sẽ thất bại cho tới khi bấm “Kết nối lại”."
          />
        )}

        <List<ZaloOaStatus>
          loading={status.isLoading}
          dataSource={s?.accounts ?? []}
          locale={{ emptyText: 'Chưa kết nối Zalo OA nào' }}
          renderItem={(a) => (
            <List.Item
              actions={[
                ...(a.status === 'disconnected' || a.needsReconnect || !a.hasCredentials
                  ? [
                      <Can key="re" perm="channel.connect">
                        <Button size="small" onClick={() => connect.mutate()} disabled={!canConnect}>
                          Kết nối lại
                        </Button>
                      </Can>,
                    ]
                  : []),
                ...(a.status === 'connected'
                  ? [
                      <Can key="off" perm="channel.connect">
                        <Popconfirm
                        title="Ngắt kết nối OA này?"
                        description="Xóa token của OA trên VClinks. Lịch sử tin nhắn và danh bạ vẫn được giữ."
                        okText="Ngắt kết nối"
                        cancelText="Hủy"
                        onConfirm={() => disconnect.mutate(a.uid)}
                      >
                        <Button danger size="small" icon={<DisconnectOutlined />} loading={disconnect.isPending && disconnect.variables === a.uid}>
                          Ngắt kết nối
                        </Button>
                      </Popconfirm>
                      </Can>,
                    ]
                  : []),
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar src={a.avatar ?? undefined}>{a.name.slice(0, 1)}</Avatar>}
                title={
                  <Space wrap>
                    <span>{a.name}</span>
                    <Typography.Text type="secondary">{a.uid}</Typography.Text>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <TokenTags a={a} />
                    <Typography.Text type="secondary">
                      Kết nối lúc {fmtTime(a.connectedAt)} bởi {a.connectedBy} · Làm mới token gần nhất: {fmtTime(a.lastRefreshAt)} · Refresh
                      token hết hạn: {fmtTime(a.refreshExpiresAt, 'DD/MM/YYYY')} · Webhook gần nhất: {fmtTime(a.lastWebhookAt)}
                    </Typography.Text>
                    {a.lastError && <Typography.Text type="danger">{a.lastError}</Typography.Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />

        <Collapse
          size="small"
          items={[
            {
              key: 'setup',
              label: 'Hướng dẫn cài đặt trên developers.zalo.me',
              children: (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text>
                    Callback URL (mục <i>Official Account → Thiết lập chung</i> của ứng dụng):{' '}
                    {s?.callbackUrl ? <Typography.Text code copyable>{s.callbackUrl}</Typography.Text> : <Typography.Text type="warning">cần đặt PUBLIC_BASE_URL</Typography.Text>}
                  </Typography.Text>
                  <Typography.Text>
                    Webhook URL (mục <i>Webhook</i>):{' '}
                    {s?.webhookUrl ? <Typography.Text code copyable>{s.webhookUrl}</Typography.Text> : <Typography.Text type="warning">cần đặt PUBLIC_BASE_URL</Typography.Text>}
                  </Typography.Text>
                  <Typography.Text>
                    Bật các sự kiện webhook:{' '}
                    {(s?.events ?? []).map((e) => (
                      <Tag key={e} style={{ marginBottom: 4 }}>
                        {e}
                      </Tag>
                    ))}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    Quyền cần cấp: gửi tin và thông báo qua OA, quản lý tin nhắn người dùng, quản lý thông tin OA, nhận sự kiện quản lý tin nhắn.
                    Tin tư vấn chỉ gửi được cho khách có tương tác với OA trong 7 ngày gần nhất (miễn phí trong 48 giờ từ tương tác cuối).
                    Webhook cần một địa chỉ HTTPS cố định: URL của Cloudflare quick tunnel đổi mỗi lần khởi động lại.
                  </Typography.Text>
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Card>
  );
}
