import { useState } from 'react';
import { Alert, App, Button, Checkbox, Descriptions, Divider, Drawer, Empty, Input, List, Modal, Select, Space, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import {
  ERP_CLOSE_REASON_LABELS,
  ERP_CLOSE_REASONS,
  ERP_FORM_FIELD_LABELS,
  ERP_FORM_FIELDS,
  ERP_TASK_KIND_LABELS,
  ERP_TASK_STATUS_LABELS,
  type ContactPointView,
  type ErpCloseReason,
  type ErpFormField,
  type ErpTaskCandidate,
  type ErpTaskView,
} from '@vclinks/shared';
import { usePermissions } from '../../state/permissions';
import { fullTime } from '../../utils/time';
import ContactValue from './ContactValue';
import ErpTaskFormModal from './ErpTaskFormModal';
import { ageText, useErpTaskAction } from './erpTaskApi';

const STATUS_COLOR: Record<ErpTaskView['status'], string> = { open: 'processing', waiting_sale: 'warning', done: 'success', closed: 'default' };

function Candidate({ c, onLink, linking, canLink }: { c: ErpTaskCandidate; onLink: () => void; linking: boolean; canLink: boolean }) {
  return (
    <List.Item
      actions={
        canLink && !c.linkedTo
          ? [
              <Button key="link" size="small" type="primary" loading={linking} onClick={onLink}>
                Gắn mã này
              </Button>,
            ]
          : undefined
      }
    >
      <List.Item.Meta
        title={
          <Space wrap>
            <Tag color="blue">{c.code}</Tag>
            {c.name}
            {c.reasons.map((r) => (
              <Tag key={r}>{r}</Tag>
            ))}
          </Space>
        }
        description={
          <Space direction="vertical" size={0}>
            <Typography.Text type="secondary">
              {[c.taxCode ? `MST ${c.taxCode}` : null, c.address, c.phones.join(', ') || null, c.salesperson ? `NV: ${c.salesperson}` : null].filter(Boolean).join(' · ') || '—'}
            </Typography.Text>
            {c.linkedTo && <Typography.Text type="warning">Mã {c.code} đang gắn với {c.linkedTo.name}.</Typography.Text>}
          </Space>
        }
      />
    </List.Item>
  );
}

/**
 * Drawer "Xử lý" of one Việc VCsales (02 MH-DK-12). The sale admin claims, checks duplicates, opens VCsales to make the
 * code and links it, sends the form back or closes it; on the update tab he marks the change done on VCsales. Others
 * read; the salesperson edits his own create form.
 */
export default function ErpTaskDrawer({ task: initial, createUrl, lastSyncAt, onClose }: { task: ErpTaskView; createUrl: string | null; lastSyncAt: string | null; onClose: () => void }) {
  const { message, modal } = App.useApp();
  const perms = usePermissions();
  const me = perms.me?.userId ?? null;
  const [t, setT] = useState(initial);
  const [code, setCode] = useState('');
  const [editing, setEditing] = useState(false);
  const [giveBack, setGiveBack] = useState<{ missing: ErpFormField[]; note: string } | null>(null);
  const [closing, setClosing] = useState<{ reason: ErpCloseReason | null; note: string } | null>(null);
  const act = useErpTaskAction();
  const run = (a: Parameters<typeof act.mutate>[0], after?: () => void) =>
    act.mutate(a, {
      onSuccess: (r) => {
        setT(r.task);
        if (r.message) message.success(r.message);
        after?.();
      },
      onError: (e) => message.error((e as Error).message),
    });
  const busy = (kind: string) => act.isPending && act.variables?.kind === kind;
  const create = t.kind === 'create_customer';
  const canProcess = t.can.process;
  const heldByOther = !!t.claim && t.claim.by !== me;
  const newPoint: ContactPointView | undefined = t.newValue
    ? {
        id: t.newValue.pointId,
        kind: t.kind === 'update_email' ? 'email' : 'phone',
        ...(t.kind === 'update_email' ? { email: t.newValue.masked } : { phone: t.newValue.masked }),
        masked: true,
        revealable: canProcess,
        level: 'V2',
        state: 'active',
        source: 'erp_task',
      }
    : undefined;
  const link = (c: string) => run({ id: t.id, kind: 'link', code: c });

  return (
    <Drawer open width={640} onClose={onClose} title={`${ERP_TASK_KIND_LABELS[t.kind]} · ${t.accountName}`} extra={<Tag color={STATUS_COLOR[t.status]}>{ERP_TASK_STATUS_LABELS[t.status]}</Tag>} destroyOnClose>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Khách">
            <Link to={`/customers/${encodeURIComponent(t.accountId)}`}>{t.accountName}</Link>
          </Descriptions.Item>
          <Descriptions.Item label="Người phụ trách">{t.owners.map((o) => o.userName ?? '–').join(', ') || 'Chưa có'}</Descriptions.Item>
          {!create && <Descriptions.Item label="Mã KH">{t.code ?? '—'}</Descriptions.Item>}
          {!create && <Descriptions.Item label="Việc">{t.summary}</Descriptions.Item>}
          <Descriptions.Item label="Lý do vào hàng">{t.origin}</Descriptions.Item>
          <Descriptions.Item label="Tạo lúc">
            {fullTime(t.createdAt)} ({ageText(t.createdAt)}){t.createdByName ? ` · ${t.createdByName}` : ''}
          </Descriptions.Item>
          {t.doneAt && <Descriptions.Item label="Xong lúc">{fullTime(t.doneAt)}</Descriptions.Item>}
        </Descriptions>

        {t.reopenedNote && <Alert type="warning" showIcon message="Việc mở lại" description={t.reopenedNote} />}
        {heldByOther && <Alert type="info" showIcon message={`${t.claim!.byName ?? 'Người khác'} đang xử lý (đến ${fullTime(t.claim!.until)}).`} />}

        {create && (
          <>
            <Divider orientation="left" plain style={{ margin: 0 }}>
              Phiếu thông tin tạo mã
            </Divider>
            {t.status === 'waiting_sale' && t.returned && (
              <Alert
                type="warning"
                showIcon
                message={`Đã trả cho sale bổ sung: ${t.returned.missing.map((f) => ERP_FORM_FIELD_LABELS[f]).join(', ')}`}
                description={[t.returned.note, `Lúc ${fullTime(t.returned.at)}`].filter(Boolean).join(' · ')}
              />
            )}
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Tên pháp lý">{t.form?.legalName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Loại khách">{t.form?.type ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="MST">{t.form?.taxCode ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="SĐT">{t.form?.phoneMasked ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao hàng">{t.form?.deliveryAddress ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ xuất hóa đơn">{t.form?.invoiceAddress ?? '—'}</Descriptions.Item>
              {t.form?.note && <Descriptions.Item label="Ghi chú">{t.form.note}</Descriptions.Item>}
            </Descriptions>
            {t.missing.length > 0 && <Alert type="warning" showIcon message={`Phiếu còn thiếu: ${t.missing.map((f) => ERP_FORM_FIELD_LABELS[f]).join(', ')}`} />}
            {t.can.editForm && (
              <Button onClick={() => setEditing(true)} style={{ alignSelf: 'flex-start' }}>
                Sửa phiếu
              </Button>
            )}

            {t.suggestion && (
              <Alert
                type="success"
                showIcon
                message={`VCsales có mã mới khớp ${t.suggestion.reasons.join(', ') || 'phiếu'}: ${t.suggestion.code} · ${t.suggestion.name}`}
                description={
                  <Space direction="vertical" size={4}>
                    <span>{[t.suggestion.taxCode ? `MST ${t.suggestion.taxCode}` : null, t.suggestion.phones.join(', ') || null, t.suggestion.address].filter(Boolean).join(' · ')}</span>
                    {t.suggestion.linkedTo && <Typography.Text type="warning">Mã này đang gắn với {t.suggestion.linkedTo.name}.</Typography.Text>}
                    {canProcess && !t.suggestion.linkedTo && (
                      <Button type="primary" size="small" loading={busy('link')} onClick={() => link(t.suggestion!.code)}>
                        Gắn mã này
                      </Button>
                    )}
                    <Typography.Text type="secondary">Đồng bộ VCsales lần cuối {lastSyncAt ? fullTime(lastSyncAt) : 'chưa có'}</Typography.Text>
                  </Space>
                }
              />
            )}

            {canProcess && (
              <Space wrap>
                {!t.claim && (
                  <Button loading={busy('claim')} onClick={() => run({ id: t.id, kind: 'claim' })}>
                    Nhận xử lý
                  </Button>
                )}
                <Button loading={busy('check')} onClick={() => run({ id: t.id, kind: 'check' })}>
                  Kiểm tra trùng trên VCsales
                </Button>
                {createUrl && (
                  <Button
                    type="primary"
                    onClick={() => {
                      window.open(createUrl, '_blank', 'noopener');
                      if (!t.claim) run({ id: t.id, kind: 'claim' });
                    }}
                  >
                    Mở VCsales tạo mã
                  </Button>
                )}
                <Button onClick={() => setGiveBack({ missing: t.missing, note: '' })}>Thiếu thông tin → trả sale</Button>
                <Button danger onClick={() => setClosing({ reason: null, note: '' })}>
                  Không tạo mã
                </Button>
              </Space>
            )}

            {canProcess && (
              <Space.Compact style={{ width: '100%' }}>
                <Input placeholder="Đã tạo mã KH: nhập mã vừa tạo trên VCsales" value={code} onChange={(e) => setCode(e.target.value)} onPressEnter={() => code.trim() && link(code.trim())} />
                <Button type="primary" disabled={!code.trim()} loading={busy('link')} onClick={() => link(code.trim())}>
                  Kiểm tra và gắn
                </Button>
              </Space.Compact>
            )}

            {t.duplicates && (
              <div>
                <Typography.Text strong>Kiểm tra trùng lúc {fullTime(t.duplicates.at)}</Typography.Text>
                <List
                  size="small"
                  dataSource={t.duplicates.candidates}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="VCsales chưa có khách nào trùng SĐT, MST hay tên." /> }}
                  renderItem={(c) => <Candidate c={c} canLink={canProcess} linking={busy('link') && act.variables?.kind === 'link' && act.variables.code === c.code} onLink={() => link(c.code)} />}
                />
              </div>
            )}
          </>
        )}

        {!create && (
          <>
            {newPoint && (
              <div>
                <Typography.Text strong>{t.kind === 'update_email' ? 'Email mới' : 'SĐT mới'}: </Typography.Text>
                <ContactValue accountId={t.accountId} point={newPoint} allowCopy />
              </div>
            )}
            {t.merge && (
              <Alert type="info" showIcon message={`Gộp mã ${t.merge.otherCodes.join(', ')} vào ${t.merge.mainCode} trên VCsales`} description="VClinks đã liên kết mã chính. Việc tự xong khi đồng bộ thấy mã phụ đã gộp hoặc đã xóa trên VCsales." />
            )}
            {t.vcsalesUrl && (
              <a href={t.vcsalesUrl} target="_blank" rel="noopener noreferrer">
                Mở khách {t.code} trên VCsales ↗
              </a>
            )}
            {canProcess && (
              <Space wrap>
                {!t.claim && (
                  <Button loading={busy('claim')} onClick={() => run({ id: t.id, kind: 'claim' })}>
                    Nhận xử lý
                  </Button>
                )}
                <Button
                  type="primary"
                  loading={busy('done')}
                  onClick={() =>
                    modal.confirm({
                      title: 'Đã cập nhật trên VCsales?',
                      content: 'Lần đồng bộ sau VClinks so lại với VCsales; nếu vẫn khác, việc mở lại.',
                      okText: 'Đã cập nhật',
                      cancelText: 'Chưa',
                      onOk: () => run({ id: t.id, kind: 'done' }),
                    })
                  }
                >
                  Đã cập nhật trên VCsales
                </Button>
              </Space>
            )}
          </>
        )}

        {!canProcess && (t.status === 'open' || t.status === 'waiting_sale') && !heldByOther && (
          <Typography.Text type="secondary">Sale admin xử lý việc này trên VCsales. Bạn {t.can.editForm ? 'sửa được phiếu, ' : ''}chỉ xem.</Typography.Text>
        )}
      </Space>

      {editing && <ErpTaskFormModal accountId={t.accountId} accountName={t.accountName} task={t} onClose={() => setEditing(false)} />}

      <Modal
        open={!!giveBack}
        title="Thiếu thông tin → trả sale"
        okText="Trả phiếu"
        cancelText="Hủy"
        okButtonProps={{ disabled: !giveBack?.missing.length }}
        confirmLoading={busy('return')}
        onCancel={() => setGiveBack(null)}
        onOk={() => giveBack && run({ id: t.id, kind: 'return', missing: giveBack.missing, note: giveBack.note || null }, () => setGiveBack(null))}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>Chọn trường còn thiếu. Người phụ trách khách nhận nhắc việc để bổ sung.</Typography.Text>
          <Checkbox.Group
            value={giveBack?.missing ?? []}
            onChange={(v) => setGiveBack((g) => (g ? { ...g, missing: v as ErpFormField[] } : g))}
            options={ERP_FORM_FIELDS.map((f) => ({ value: f, label: ERP_FORM_FIELD_LABELS[f] }))}
          />
          <Input.TextArea placeholder="Ghi chú (tùy chọn)" maxLength={300} value={giveBack?.note ?? ''} onChange={(e) => setGiveBack((g) => (g ? { ...g, note: e.target.value } : g))} />
        </Space>
      </Modal>

      <Modal
        open={!!closing}
        title={`Không tạo mã cho ${t.accountName}`}
        okText="Đóng việc"
        okButtonProps={{ danger: true, disabled: !closing?.reason }}
        cancelText="Hủy"
        confirmLoading={busy('close')}
        onCancel={() => setClosing(null)}
        onOk={() => closing?.reason && run({ id: t.id, kind: 'close', reason: closing.reason, note: closing.note || null }, () => setClosing(null))}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            style={{ width: '100%' }}
            placeholder="Lý do"
            value={closing?.reason ?? undefined}
            onChange={(v) => setClosing((c) => (c ? { ...c, reason: v } : c))}
            options={ERP_CLOSE_REASONS.map((r) => ({ value: r, label: ERP_CLOSE_REASON_LABELS[r] }))}
          />
          <Input.TextArea placeholder="Ghi chú (tùy chọn)" maxLength={300} value={closing?.note ?? ''} onChange={(e) => setClosing((c) => (c ? { ...c, note: e.target.value } : c))} />
        </Space>
      </Modal>
    </Drawer>
  );
}
