import { Alert, Card, Empty, Space, Table, Tag, Typography } from 'antd';
import type { AccountStatus, StreamStatus } from '@vclinks/shared';
import { useAccounts } from '../../components/AccountSelect';
import { fmtTime } from '../../time';

/**
 * Facebook personal (Messenger) channel: setup steps for the VClinks
 * Extension, the account-lock warning, and the sync status of connected
 * `fb_` accounts (from GET /api/accounts).
 */

const STREAM_LABEL: Partial<Record<StreamStatus['stream'], string>> = {
  messages: 'Tin nhắn',
  conversations: 'Hội thoại',
  contacts: 'Liên hệ',
};

const num = (n: number) => n.toLocaleString('vi-VN');

/** Latest ingest over all streams (the extension sends no IndexedDB counts for Messenger). */
function lastIngest(a: AccountStatus): string | null {
  const times = [a.lastSyncAt, ...a.streams.map((s) => s.lastIngestAt)].filter((t): t is string => !!t);
  return times.sort().at(-1) ?? null;
}

function count(a: AccountStatus, stream: StreamStatus['stream']): number {
  return a.streams.find((s) => s.stream === stream)?.dbCount ?? 0;
}

export default function FacebookPersonalSection() {
  const accounts = useAccounts(30_000);
  const fb = (accounts.data ?? []).filter((a) => a.channel === 'fb_personal');

  return (
    <Card title="Facebook cá nhân (Messenger)">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="warning"
          showIcon
          message="Rủi ro bị khóa tài khoản Facebook"
          description={
            <>
              Facebook cá nhân không có API chính thức. Việc tự động đọc và gửi tin trên tài khoản cá nhân trái điều khoản của
              Meta, và tài khoản có thể bị hạn chế hoặc khóa. Chủ dự án đã chấp nhận rủi ro này (28/09/2026). Extension chỉ đọc
              những gì Messenger đang hiển thị trên tab của anh, chỉ gửi tin đã duyệt, từng tin một, chậm như người gõ (tối đa
              20 tin/giờ), và không bao giờ gửi hàng loạt.
            </>
          }
        />

        <div>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            Cách kết nối
          </Typography.Title>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            <li>
              Cài hoặc cập nhật <b>VClinks Extension</b> trên Chrome (thư mục <Typography.Text code>apps/extension/build</Typography.Text>)
              và cấu hình địa chỉ API, token như với Zalo.
            </li>
            <li>
              Mở <Typography.Text code>https://www.messenger.com</Typography.Text> hoặc{' '}
              <Typography.Text code>https://www.facebook.com/messages</Typography.Text> và đăng nhập. Tab đã mở từ trước thì tải lại
              (F5).
            </li>
            <li>
              Bấm biểu tượng VClinks, xem mục <b>Facebook cá nhân</b>. Nếu extension chưa tự nhận ra tài khoản, nhập ID Facebook
              (dãy số) của anh rồi bấm Lưu. Tài khoản sẽ xuất hiện ở bảng dưới với mã <Typography.Text code>fb_&lt;ID&gt;</Typography.Text>.
            </li>
            <li>
              Mở từng hội thoại cần lưu: extension tự lấy các tin <b>đang hiển thị</b>. Muốn lấy tin cũ hơn thì cuộn lên trong hội
              thoại đó. Chat mã hóa đầu cuối phải được mở khóa bằng mã PIN trên trình duyệt trước.
            </li>
            <li>
              Muốn gửi tin đã duyệt từ Dashboard: bật <b>Cho phép gửi tin trên Facebook</b> trong popup (mặc định tắt) và để tab
              Messenger mở. Extension tạm dừng khi anh đang gõ hoặc thao tác trên tab đó.
            </li>
          </ol>
        </div>

        <Table<AccountStatus>
          size="small"
          rowKey="uid"
          loading={accounts.isLoading}
          dataSource={fb}
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có tài khoản Facebook cá nhân nào" /> }}
          columns={[
            {
              title: 'Tài khoản',
              key: 'label',
              render: (_, a) => (
                <Space direction="vertical" size={0}>
                  <span>{a.label || a.uid}</span>
                  <Typography.Text type="secondary" copyable={{ text: a.uid }}>
                    {a.uid}
                  </Typography.Text>
                </Space>
              ),
            },
            ...(['messages', 'conversations', 'contacts'] as const).map((s) => ({
              title: STREAM_LABEL[s],
              key: s,
              align: 'right' as const,
              render: (_: unknown, a: AccountStatus) => num(count(a, s)),
            })),
            {
              title: 'Nhận dữ liệu gần nhất',
              key: 'last',
              render: (_, a) => fmtTime(lastIngest(a)),
            },
            {
              title: 'Trạng thái',
              key: 'state',
              render: (_, a) => {
                const last = lastIngest(a);
                if (a.openDrifts > 0) return <Tag color="red">{a.openDrifts} lỗi selector (drift)</Tag>;
                if (!last) return <Tag>Chưa có dữ liệu</Tag>;
                const idleH = (Date.now() - Date.parse(last)) / 3_600_000;
                return idleH > 24 ? <Tag color="orange">Không nhận dữ liệu hơn 24 giờ</Tag> : <Tag color="green">Đang nhận</Tag>;
              },
            },
          ]}
        />

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Giới hạn: chỉ lưu những tin Messenger đã tải và hiển thị trên tab của anh; tin phía trên mốc thời gian đầu tiên đang hiển
          thị được lấy khi anh cuộn lên thêm. Selector giao diện Messenger chưa được khảo sát trên trang thật; khi Messenger đổi giao
          diện, extension báo lỗi selector (drift) ở đây. Chi tiết: <Typography.Text code>docs/channels/facebook-personal.md</Typography.Text>.
        </Typography.Text>
      </Space>
    </Card>
  );
}
