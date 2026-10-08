import { useMemo, useState } from 'react';
import { Alert, App, Button, Dropdown, Empty, InputNumber, Space, Table, Tag, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import type { ErpMatchingRow } from '@vclinks/shared';
import { ApiError } from '../api';
import NoAccess, { isNoAccessError } from '../components/access/NoAccess';
import { useConfirmErp, useErpMatching } from '../components/customers/customerApi';
import ErpTaskFormModal from '../components/customers/ErpTaskFormModal';
import { usePermissions } from '../state/permissions';
import { fmtTime } from '../time';

/** A row can join the batch confirmation only with a strong signal: score ≥ 90 (SĐT V2+ or MST), MH-DK-13 #3. */
export const BATCH_MIN_SCORE = 90;

/**
 * Đối chiếu mã KH (02 MH-DK-13): customers without a VCsales code and the best code suggested for each. Sale admin
 * selects and confirms; the division director only reads (no tick boxes, no confirm button, D8-17); other roles never
 * reach it (menu and 403 "dạng A"). VCsales is mock until E5; nothing is written to VCsales (BR12).
 */
export default function ErpMatchingPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const perms = usePermissions();
  const q = useErpMatching();
  const confirm = useConfirmErp();
  const [minScore, setMinScore] = useState(40);
  const [picked, setPicked] = useState<string[]>([]);
  const [queueing, setQueueing] = useState<ErpMatchingRow | null>(null);
  const canConfirm = q.data?.canConfirm ?? false;

  const rows = useMemo(() => (q.data?.items ?? []).filter((r) => (r.candidates[0]?.score ?? 0) >= minScore), [q.data, minScore]);
  const batchable = (r: ErpMatchingRow) => (r.candidates[0]?.score ?? 0) >= BATCH_MIN_SCORE;

  if (q.isError && isNoAccessError(q.error)) {
    return <NoAccess kind="page" pageName="Đối chiếu mã KH" roles={['Sale admin (xác nhận)', 'NVKD (xem đề xuất của mình)', 'Giám đốc bán hàng division (chỉ xem)']} />;
  }

  const link = async (list: ErpMatchingRow[]) => {
    let ok = 0;
    for (const r of list) {
      try {
        await confirm.mutateAsync({ accountId: r.accountId, customerId: r.candidates[0]!.customerId });
        ok += 1;
      } catch (e) {
        message.error(`${r.accountName}: ${e instanceof ApiError ? e.message : 'không liên kết được'}`);
      }
    }
    if (ok) message.success(`Đã liên kết ${ok} khách.`);
    setPicked([]);
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Đối chiếu mã KH · VCsales
      </Typography.Title>
      {q.data?.erpMode === 'mock' ? (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Dữ liệu VCsales hiện là bản mô phỏng. VClinks chỉ đọc, không ghi gì sang VCsales." />
      ) : q.data && q.data.catalogSize === 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={
            <span>
              Chưa nạp danh mục khách VCsales nên chưa có gợi ý. Sale admin nạp ở <Link to="/customers/erp-catalog">Danh mục VCsales</Link>.
            </span>
          }
        />
      ) : (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`Gợi ý từ ${q.data?.catalogSize.toLocaleString('vi-VN') ?? 0} khách VCsales đã nạp. VClinks chỉ đọc, không ghi gì sang VCsales.`} />
      )}
      <Space wrap style={{ marginBottom: 12 }}>
        <span>
          Điểm từ <InputNumber min={0} max={100} value={minScore} onChange={(v) => setMinScore(v ?? 0)} style={{ width: 70 }} />
        </span>
        {canConfirm && (
          <Button
            type="primary"
            disabled={!picked.length}
            loading={confirm.isPending}
            onClick={() => {
              const list = rows.filter((r) => picked.includes(r.accountId));
              modal.confirm({
                title: `Liên kết ${list.length} khách với mã KH đã gợi ý?`,
                content: (
                  <div style={{ maxHeight: 360, overflow: 'auto' }}>
                    {list.map((r) => (
                      <div key={r.accountId}>
                        {r.accountName} → {r.candidates[0]!.customerId} · {r.candidates[0]!.score} · {r.candidates[0]!.reasons.join(', ')}
                      </div>
                    ))}
                  </div>
                ),
                okText: 'Liên kết',
                cancelText: 'Hủy',
                onOk: () => link(list),
              });
            }}
          >
            Xác nhận các dòng đã chọn ({picked.length})
          </Button>
        )}
      </Space>
      <Table<ErpMatchingRow>
        rowKey="accountId"
        size="middle"
        loading={q.isLoading}
        dataSource={rows}
        pagination={{ pageSize: 50, showSizeChanger: false }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={q.isError ? 'Không tải được danh sách. Thử lại sau ít phút.' : 'Mọi khách đã được đối chiếu.'} /> }}
        rowSelection={canConfirm ? { selectedRowKeys: picked, onChange: (k) => setPicked(k as string[]), getCheckboxProps: (r) => ({ disabled: !batchable(r) }) } : undefined}
        columns={[
          { title: 'Khách VClinks', render: (_: unknown, r) => <div><div>{r.accountName}</div><Typography.Text type="secondary">{r.owners.map((o) => o.userName).filter(Boolean).join(', ') || 'Chưa có người phụ trách'}</Typography.Text></div> },
          {
            title: 'Gợi ý VCsales',
            render: (_: unknown, r) => {
              const c = r.candidates[0]!;
              return <div><div><b>{c.customerId}</b> {c.name}</div>{r.candidates.length > 1 && <Typography.Text type="secondary">Gợi ý khác ({r.candidates.length - 1})</Typography.Text>}</div>;
            },
          },
          { title: 'Điểm', width: 150, render: (_: unknown, r) => <div><Tag color={r.candidates[0]!.score >= BATCH_MIN_SCORE ? 'green' : 'default'}>{r.candidates[0]!.score}</Tag><div><Typography.Text type="secondary">{r.candidates[0]!.reasons.join(', ')}</Typography.Text></div></div> },
          { title: 'MST / Địa chỉ', render: (_: unknown, r) => `${r.candidates[0]!.taxCode ?? '—'} / ${r.candidates[0]!.address ?? '—'}` },
          { title: 'NV phụ trách', width: 140, render: (_: unknown, r) => r.candidates[0]!.salesperson ?? '–' },
          {
            title: '',
            width: 150,
            render: (_: unknown, r) => (
              <Space size={4}>
                <Button size="small" onClick={() => navigate(`/customers/${encodeURIComponent(r.accountId)}?tab=commerce`)}>
                  Xem
                </Button>
                {canConfirm && (
                  <Dropdown menu={{ items: [{ key: 'queue', label: 'Đưa vào hàng chờ tạo mã' }], onClick: () => setQueueing(r) }} trigger={['click']}>
                    <Button size="small">Khác ▾</Button>
                  </Dropdown>
                )}
              </Space>
            ),
          },
        ]}
      />
      {queueing && <ErpTaskFormModal accountId={queueing.accountId} accountName={queueing.accountName} onClose={() => setQueueing(null)} />}
      {!perms.loading && !canConfirm && q.data && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          Bạn chỉ xem. Sale admin xác nhận liên kết. Cập nhật lúc {fmtTime(new Date().toISOString(), 'HH:mm')}.
        </Typography.Paragraph>
      )}
    </div>
  );
}
