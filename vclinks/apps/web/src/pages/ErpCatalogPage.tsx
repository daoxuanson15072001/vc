import { Alert, App, Button, Card, Descriptions, Space, Spin, Table, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { ERP_SYNC_KIND_LABELS, type ErpSyncKind, type ErpSyncRunView } from '@vclinks/shared';
import NoAccess, { isNoAccessError } from '../components/access/NoAccess';
import { useErpSync, useStartErpSync } from '../components/customers/erpTaskApi';
import { usePageTitle } from '../components/layout/PageTitle';
import { fullTime } from '../utils/time';

const KIND_COLOR: Record<ErpSyncKind, string> = { preview: 'default', full: 'blue', incremental: 'green' };

/** "Đã đọc 4.567 · tạo 12 · cập nhật 30 …": the non-zero counts of one run. */
function countsText(r: ErpSyncRunView): string {
  const c = r.counts;
  const preview = r.kind === 'preview';
  const parts: [number, string][] = [
    [c.fetched, 'đã đọc'],
    [c.created, preview ? 'sẽ tạo hồ sơ' : 'tạo hồ sơ'],
    [c.updated, preview ? 'sẽ cập nhật' : 'cập nhật'],
    [c.unchanged, 'không đổi'],
    [c.deleted, 'đã xóa trên VCsales'],
    [c.held, 'mã mới chờ gắn cho việc tạo mã'],
    [c.ownersSet, preview ? 'sẽ đặt người phụ trách' : 'đặt người phụ trách'],
    [c.ownerUnmatched, 'NV phụ trách chưa ghép được'],
    [c.ownerMismatch, 'lệch người phụ trách'],
    [c.autoMerged, 'tự gộp'],
    [c.suggestions, 'gợi ý gộp'],
    [c.tasksDone, 'việc VCsales tự xong'],
    [c.tasksReopened, 'việc mở lại'],
    [c.codeSuggestions, 'gợi ý mã mới'],
  ];
  return parts
    .filter(([n], i) => n > 0 || i === 0)
    .map(([n, label]) => `${label} ${n.toLocaleString('vi-VN')}`)
    .join(' · ');
}

/**
 * Danh mục VCsales (plan C11, D3-09): loads the VCsales customer catalogue into VClinks. "Xem trước" only counts;
 * "Nạp toàn bộ" makes the profiles once (first owners by e-mail, D8-06); afterwards VClinks reads only the changes,
 * every hour, or now with "Đồng bộ ngay". Sale admins and sales directors run it.
 */
export default function ErpCatalogPage() {
  usePageTitle('Danh mục VCsales');
  const { message, modal } = App.useApp();
  const q = useErpSync();
  const start = useStartErpSync();
  if (q.isError && isNoAccessError(q.error)) return <NoAccess kind="page" pageName="Danh mục VCsales" roles={['Sale admin', 'Giám đốc bán hàng']} />;
  if (q.isLoading) return <Spin />;
  if (q.isError || !q.data) return <Alert type="error" showIcon message="Không tải được trạng thái danh mục VCsales." action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />;
  const s = q.data;
  const run = (kind: ErpSyncKind) =>
    start.mutate(kind, {
      onSuccess: () => message.info(kind === 'preview' ? 'Đang xem trước, không ghi gì.' : 'Đã bắt đầu. Trang tự cập nhật khi xong.'),
      onError: (e) => message.error((e as Error).message),
    });
  const busy = !!s.running || start.isPending;
  const last = s.runs[0];
  return (
    <div style={{ maxWidth: 1100 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Danh mục VCsales
      </Typography.Title>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {s.mode === 'mock' && <Alert type="info" showIcon message="VClinks đang dùng dữ liệu VCsales giả (chế độ thử). Nạp ở đây chỉ nạp khách giả." />}
        <Card title="Trạng thái">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Nạp lần đầu">{s.firstImportAt ? fullTime(s.firstImportAt) : <Tag color="warning">Chưa nạp</Tag>}</Descriptions.Item>
            <Descriptions.Item label="Đồng bộ lần cuối">{s.lastSyncAt ? fullTime(s.lastSyncAt) : '–'}</Descriptions.Item>
            <Descriptions.Item label="Đã đọc thay đổi tới">{s.since ? fullTime(s.since) : '–'}</Descriptions.Item>
            <Descriptions.Item label="Khách VCsales trong VClinks">{s.snapshotCount.toLocaleString('vi-VN')}</Descriptions.Item>
            <Descriptions.Item label="Division nhận người phụ trách lần đầu">{s.division ?? 'Chốt ở lần nạp đầu: division của người bấm'}</Descriptions.Item>
            <Descriptions.Item label="Tự đồng bộ">
              {s.everyMinutes > 0 ? `${s.everyMinutes} phút một lần, chỉ đọc khách đã đổi` : 'Tắt'}
              {s.everyMinutes > 0 && !s.firstImportAt ? ' (bắt đầu sau lần nạp đầu)' : ''}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        {s.running && (
          <Alert
            type="info"
            showIcon
            icon={<Spin size="small" />}
            message={`${ERP_SYNC_KIND_LABELS[s.running.kind]} đang chạy: đã đọc ${s.running.fetched.toLocaleString('vi-VN')} khách`}
            description={`Bắt đầu lúc ${fullTime(s.running.startedAt)}. Có thể rời trang, việc vẫn chạy tiếp.`}
          />
        )}
        {last?.error && <Alert type="error" showIcon message={`Lần ${ERP_SYNC_KIND_LABELS[last.kind].toLowerCase()} lúc ${fullTime(last.startedAt)} không xong`} description={last.error} />}
        {s.canRun ? (
          <Card title="Chạy">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space wrap>
                <Button disabled={busy} onClick={() => run('preview')}>
                  Xem trước
                </Button>
                <Button
                  type={s.firstImportAt ? 'default' : 'primary'}
                  disabled={busy}
                  onClick={() =>
                    modal.confirm({
                      title: s.firstImportAt ? 'Nạp lại toàn bộ danh mục VCsales?' : 'Nạp toàn bộ danh mục VCsales lần đầu?',
                      width: 560,
                      content: (
                        <Space direction="vertical">
                          <span>Mỗi khách VCsales chưa có hồ sơ được tạo hồ sơ, có mã KH, SĐT và email (mức V3).</span>
                          <span>Người phụ trách lần đầu lấy theo NV phụ trách trên VCsales (ghép email); người chưa ghép được thì khách để "Chưa phân công".</span>
                          <span>Sau đó VClinks chạy quy tắc gộp: hồ sơ đủ điều kiện tự gộp, còn lại thành gợi ý cho sale admin.</span>
                          <Typography.Text type="secondary">Nên bấm "Xem trước" để xem số liệu trước. VClinks không ghi gì sang VCsales.</Typography.Text>
                        </Space>
                      ),
                      okText: 'Nạp toàn bộ',
                      cancelText: 'Hủy',
                      onOk: () => run('full'),
                    })
                  }
                >
                  Nạp toàn bộ
                </Button>
                <Button type={s.firstImportAt ? 'primary' : 'default'} disabled={busy || !s.firstImportAt} onClick={() => run('incremental')}>
                  Đồng bộ ngay
                </Button>
              </Space>
              <Typography.Text type="secondary">
                "Xem trước" chỉ đếm, không ghi. "Đồng bộ ngay" chỉ đọc khách đã đổi từ lần trước. Ghép NV phụ trách theo email: xem{' '}
                <Link to="/admin/vcsales">Quản trị → Kết nối VCsales</Link>.
              </Typography.Text>
            </Space>
          </Card>
        ) : (
          <Typography.Text type="secondary">Sale admin hoặc giám đốc bán hàng nạp và đồng bộ danh mục. Bạn chỉ xem.</Typography.Text>
        )}
        <Card title="Các lần chạy gần nhất">
          <Table<ErpSyncRunView>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={s.runs}
            locale={{ emptyText: 'Chưa chạy lần nào.' }}
            columns={[
              { title: 'Loại', width: 130, render: (_, r) => <Tag color={KIND_COLOR[r.kind]}>{ERP_SYNC_KIND_LABELS[r.kind]}</Tag> },
              { title: 'Lúc', width: 150, render: (_, r) => fullTime(r.startedAt) },
              { title: 'Thời gian', width: 90, render: (_, r) => (r.finishedAt ? `${Math.max(1, Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000))} giây` : '–') },
              { title: 'Kết quả', render: (_, r) => (r.error ? <Typography.Text type="danger">{r.error}</Typography.Text> : countsText(r)) },
              { title: 'Người chạy', width: 150, render: (_, r) => (r.by.startsWith('system:') ? 'Tự động' : (r.byName ?? 'Quản trị')) },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
}
