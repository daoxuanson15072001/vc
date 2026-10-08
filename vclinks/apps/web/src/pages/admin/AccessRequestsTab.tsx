import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, DatePicker, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import {
  GRANT_DURATION_HOURS,
  GRANT_RIGHT_LABELS,
  GRANT_STATUS_LABELS,
  GRANT_TAB_LABELS,
  GRANT_TYPE_LABELS,
  fmtVnDateTime,
  type AccessGrantList,
  type AccessGrantRow,
  type CoverOptions,
  type GrantActionResult,
  type GrantStatus,
  type GrantTab,
} from '@vclinks/shared';
import { api } from '../../api';
import { usePermissions } from '../../state/permissions';

const STATUS_COLOR: Record<GrantStatus, string> = { cho_duyet: 'gold', hieu_luc: 'green', tu_choi: 'red', het_han: 'default', thu_hoi: 'default' };
const HOURS_LABEL: Record<number, string> = { 4: '4 giờ', 24: '1 ngày', 72: '3 ngày', 168: '7 ngày' };
const EMPTY: Record<GrantTab, string> = {
  pending: 'Không có yêu cầu nào chờ bạn duyệt.',
  mine: 'Bạn chưa xin quyền tạm thời nào.',
  cover: 'Không có trực thay nào đang hiệu lực trong phạm vi của bạn.',
  scope: 'Không có quyền tạm thời nào trong phạm vi của bạn.',
  all: 'Không có quyền tạm thời nào.',
};
const t = (d?: string) => (d ? fmtVnDateTime(new Date(d)) : '—');

const post = (path: string, body: unknown = {}) => api<GrantActionResult>(path, { method: 'POST', body });

/**
 * MH-PQ-07 "Quyền tạm thời" (docs 01 §2.6, M1b-10): "Chờ tôi duyệt", "Của tôi", "Trực thay", "Tất cả trong
 * phạm vi", "Tất cả" (admin); modals "Tạo trực thay", "Đăng ký vắng", "Xin quyền theo SĐT / mã KH".
 * Every rule (PQ-30, PQ-31, revoke scope, overlaps) is checked by the API; buttons follow its flags.
 */
export default function AccessRequestsTab() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as GrantTab | null) ?? undefined;
  const perms = usePermissions().me?.permissions ?? {};
  const q = useQuery({
    queryKey: ['access-grants', tab ?? ''],
    queryFn: () => api<AccessGrantList>('/access-grants', { query: { tab } }),
  });
  const done = (r: GrantActionResult) => {
    message.success(r.message);
    void qc.invalidateQueries({ queryKey: ['access-grants'] });
  };
  const act = useMutation({ mutationFn: (v: { path: string; body?: unknown }) => post(v.path, v.body), onSuccess: done, onError: (e: Error) => message.error(e.message) });

  const [reject, setReject] = useState<AccessGrantRow | null>(null);
  const [approve, setApprove] = useState<AccessGrantRow | null>(null);
  const [cover, setCover] = useState<{ open: boolean; leave?: AccessGrantRow }>({ open: false });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);

  const data = q.data;
  const active = data?.tab ?? 'mine';
  const columns = [
    { title: 'Người xin', render: (_: unknown, r: AccessGrantRow) => r.userName },
    { title: 'Loại', render: (_: unknown, r: AccessGrantRow) => GRANT_TYPE_LABELS[r.type] },
    {
      title: 'Đối tượng',
      render: (_: unknown, r: AccessGrantRow) =>
        r.type === 'truc_thay' ? `Nick ${r.targetLabel} · vắng: ${r.absentUserName ?? ''}` : r.type === 'dang_ky_vang' ? `Đề xuất trực: ${r.proposedCoverName ?? '—'}` : r.targetLabel,
    },
    { title: 'Quyền', render: (_: unknown, r: AccessGrantRow) => (r.rights.length ? GRANT_RIGHT_LABELS[r.rights[r.rights.length - 1]] : '—') },
    {
      title: 'Thời hạn',
      render: (_: unknown, r: AccessGrantRow) => (r.from && r.to ? `${t(r.from)} – ${t(r.to)}` : r.durationHours ? HOURS_LABEL[r.durationHours] ?? `${r.durationHours} giờ` : '—'),
    },
    { title: 'Lý do', dataIndex: 'reason', ellipsis: true },
    { title: 'Gửi lúc', render: (_: unknown, r: AccessGrantRow) => t(r.createdAt) },
    { title: 'Trạng thái', render: (_: unknown, r: AccessGrantRow) => <Tag color={STATUS_COLOR[r.status]}>{GRANT_STATUS_LABELS[r.status]}</Tag> },
    {
      title: '',
      render: (_: unknown, r: AccessGrantRow) => (
        <Space wrap>
          {r.canApprove && (
            <Button size="small" type="primary" onClick={() => (r.type === 'dang_ky_vang' ? setCover({ open: true, leave: r }) : setApprove(r))}>
              {r.type === 'dang_ky_vang' ? 'Đồng ý' : 'Duyệt'}
            </Button>
          )}
          {r.canReject && <Button size="small" onClick={() => setReject(r)}>Từ chối</Button>}
          {r.canCancel && <Button size="small" onClick={() => act.mutate({ path: `/access-grants/${r.id}/cancel` })}>Hủy yêu cầu</Button>}
          {r.canRevoke && <Button size="small" danger onClick={() => act.mutate({ path: `/access-grants/${r.id}/revoke` })}>Thu hồi</Button>}
          {r.canEnd && <Button size="small" danger onClick={() => act.mutate({ path: `/access-grants/${r.id}/end` })}>Kết thúc sớm</Button>}
          {r.canReviewRequest && <Button size="small" onClick={() => act.mutate({ path: `/access-grants/${r.id}/review-request` })}>Đề nghị xem lại</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        {perms['grant.leave_request'] && <Button onClick={() => setLeaveOpen(true)}>Đăng ký vắng</Button>}
        {perms['grant.cover'] && <Button type="primary" onClick={() => setCover({ open: true })}>+ Tạo trực thay</Button>}
        {perms['grant.request'] && <Button onClick={() => setIdentityOpen(true)}>Xin quyền theo SĐT / mã KH</Button>}
      </Space>
      {q.isError ? (
        <Alert type="error" showIcon message="Không tải được danh sách yêu cầu." action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />
      ) : (
        <Tabs
          activeKey={active}
          onChange={(k) => setParams({ tab: k })}
          items={(data?.tabs ?? ['mine']).map((k) => ({
            key: k,
            label: k === 'pending' ? `${GRANT_TAB_LABELS[k]} (${data?.pendingCount ?? 0})` : GRANT_TAB_LABELS[k],
            children: (
              <Table
                rowKey="id"
                size="small"
                loading={q.isLoading}
                dataSource={k === active ? (data?.items ?? []) : []}
                columns={columns}
                pagination={{ pageSize: 20 }}
                locale={{ emptyText: EMPTY[k] }}
                scroll={{ x: 1000 }}
              />
            ),
          }))}
        />
      )}

      <ApproveModal row={approve} onClose={() => setApprove(null)} onDone={done} />
      <ReasonModal
        title="Từ chối"
        label="Lý do từ chối"
        open={!!reject}
        onClose={() => setReject(null)}
        onSubmit={(reason) => post(`/access-grants/${reject!.id}/reject`, { reason }).then((r) => (done(r), setReject(null)))}
      />
      {cover.open && <CoverModal leave={cover.leave} onClose={() => setCover({ open: false })} onDone={done} />}
      {leaveOpen && <LeaveModal onClose={() => setLeaveOpen(false)} onDone={done} />}
      {identityOpen && <IdentityModal onClose={() => setIdentityOpen(false)} onDone={done} />}
    </div>
  );
}

function ApproveModal({ row, onClose, onDone }: { row: AccessGrantRow | null; onClose: () => void; onDone: (r: GrantActionResult) => void }) {
  const [hours, setHours] = useState<number | undefined>();
  const max = row?.durationHours ?? 24;
  const options = GRANT_DURATION_HOURS.filter((h) => h <= max).map((h) => ({ value: h, label: HOURS_LABEL[h] }));
  return (
    <Modal
      open={!!row}
      title={`Duyệt yêu cầu của ${row?.userName ?? ''}`}
      okText="Duyệt"
      cancelText="Hủy"
      onCancel={onClose}
      destroyOnClose
      onOk={() =>
        post(`/access-grants/${row!.id}/approve`, { durationHours: hours ?? max })
          .then((r) => (onDone(r), onClose()))
          .catch((e: Error) => message.error(e.message))
      }
    >
      <Typography.Paragraph>
        {row?.targetLabel} · {row ? GRANT_RIGHT_LABELS[row.rights[row.rights.length - 1] ?? 'xem'] : ''}
      </Typography.Paragraph>
      <Form layout="vertical">
        <Form.Item label="Thời hạn" extra="Rút ngắn được, không kéo dài quá mức người xin chọn.">
          <Select value={hours ?? max} options={options} onChange={setHours} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ReasonModal(props: { title: string; label: string; open: boolean; onClose: () => void; onSubmit: (reason: string) => Promise<unknown> }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={props.open}
      title={props.title}
      okText={props.title}
      cancelText="Hủy"
      okButtonProps={{ disabled: reason.trim().length < 5 }}
      onCancel={props.onClose}
      destroyOnClose
      onOk={() => props.onSubmit(reason.trim()).catch((e: Error) => message.error(e.message))}
    >
      <Form layout="vertical">
        <Form.Item label={props.label} required extra="Ít nhất 5 ký tự.">
          <Input.TextArea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** Default range: today 08:00 – 18:00 (MH-PQ-07 #6). */
const defaultRange = (): [Dayjs, Dayjs] => {
  const d = dayjs();
  return [d.hour(8).minute(0).second(0), d.hour(18).minute(0).second(0)];
};

function CoverModal({ leave, onClose, onDone }: { leave?: AccessGrantRow; onClose: () => void; onDone: (r: GrantActionResult) => void }) {
  const [absent, setAbsent] = useState<string | undefined>(leave?.absentUserId);
  const [range, setRange] = useState<[Dayjs, Dayjs]>(leave?.from && leave.to ? [dayjs(leave.from), dayjs(leave.to)] : defaultRange());
  const [byNick, setByNick] = useState<Record<string, string>>({});
  const [backdate, setBackdate] = useState('');
  const opts = useQuery({
    queryKey: ['cover-options', absent ?? ''],
    queryFn: () => api<CoverOptions>('/access-grants/cover-options', { query: { absentUserId: absent } }),
  });
  const backdated = range[0].isBefore(dayjs().subtract(1, 'minute'));
  const nicks = opts.data?.nicks ?? [];
  const choice = (uid: string) => byNick[uid] ?? (leave?.proposedCoverId && opts.data?.candidates.some((c) => c.id === leave.proposedCoverId) ? leave.proposedCoverId : undefined);
  const ready = !!absent && nicks.length > 0 && nicks.every((n) => choice(n.uid)) && (!backdated || backdate.trim().length >= 10);
  return (
    <Modal
      open
      title={leave ? `Đồng ý đăng ký vắng của ${leave.userName}` : 'Tạo trực thay'}
      okText="Lưu"
      cancelText="Hủy"
      okButtonProps={{ disabled: !ready }}
      onCancel={onClose}
      onOk={() =>
        post('/access-grants/covers', {
          absentUserId: absent,
          covers: nicks.map((n) => ({ uid: n.uid, userId: choice(n.uid) })),
          from: range[0].toISOString(),
          to: range[1].toISOString(),
          ...(backdated ? { backdateReason: backdate.trim() } : {}),
          ...(leave ? { leaveRequestId: leave.id } : {}),
        })
          .then((r) => (onDone(r), onClose()))
          .catch((e: Error) => message.error(e.message))
      }
    >
      <Form layout="vertical">
        <Form.Item label="Người vắng" required>
          <Select
            showSearch
            optionFilterProp="label"
            disabled={!!leave}
            value={absent}
            onChange={(v) => (setAbsent(v), setByNick({}))}
            options={(opts.data?.absentees ?? (leave ? [{ id: leave.absentUserId!, name: leave.userName }] : [])).map((u) => ({ value: u.id, label: u.name }))}
          />
        </Form.Item>
        {absent && !opts.isLoading && !nicks.length && <Alert type="info" showIcon message="Người này không giữ nick nào; trực nhóm khách chưa có ở bản này." style={{ marginBottom: 12 }} />}
        {nicks.map((n) => (
          <Form.Item key={n.uid} label={`Trực nick ${n.label}`} required>
            <Select
              showSearch
              optionFilterProp="label"
              value={choice(n.uid)}
              onChange={(v) => setByNick((m) => ({ ...m, [n.uid]: v }))}
              options={(opts.data?.candidates ?? []).map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>
        ))}
        <Form.Item label="Từ – Đến" required extra="Tối đa 30 ngày. “Từ” lùi được tới đầu ngày hôm nay.">
          <DatePicker.RangePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" value={range} allowClear={false} onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])} />
        </Form.Item>
        {backdated && (
          <Form.Item label="Lý do hồi tố" required extra="Lượt hết hạn trong khoảng hồi tố sẽ ghi 'Không người chịu (nghỉ đột xuất)' trên báo cáo; quyền gửi và định tuyến chỉ đổi từ bây giờ.">
            <Input.TextArea rows={2} maxLength={300} value={backdate} onChange={(e) => setBackdate(e.target.value)} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

function LeaveModal({ onClose, onDone }: { onClose: () => void; onDone: (r: GrantActionResult) => void }) {
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => {
    const d = dayjs().add(1, 'day');
    return [d.hour(8).minute(0).second(0), d.hour(18).minute(0).second(0)];
  });
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [proposed, setProposed] = useState<string | undefined>();
  const team = useQuery({ queryKey: ['leave-candidates'], queryFn: () => api<{ id: string; name: string }[]>('/access-grants/leave-candidates').catch(() => []) });
  const options = useMemo(() => (team.data ?? []).map((u) => ({ value: u.id, label: u.name })), [team.data]);
  return (
    <Modal
      open
      title="Đăng ký vắng"
      okText="Gửi"
      cancelText="Hủy"
      okButtonProps={{ disabled: reason.trim().length < 5 }}
      onCancel={onClose}
      onOk={() =>
        post('/leave-requests', {
          from: range[0].toISOString(),
          to: range[1].toISOString(),
          reason: reason.trim(),
          ...(proposed ? { proposedCoverId: proposed } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        })
          .then((r) => (onDone(r), onClose()))
          .catch((e: Error) => message.error(e.message))
      }
    >
      <Form layout="vertical">
        <Form.Item label="Từ – Đến" required extra="Tối đa 30 ngày.">
          <DatePicker.RangePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" value={range} allowClear={false} onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])} />
        </Form.Item>
        <Form.Item label="Lý do" required extra="Ít nhất 5 ký tự.">
          <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
        </Form.Item>
        <Form.Item label="Đề xuất người trực nick (tùy chọn)">
          <Select allowClear showSearch optionFilterProp="label" value={proposed} onChange={setProposed} options={options} />
        </Form.Item>
        <Form.Item label="Ghi chú bàn giao">
          <Input.TextArea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function IdentityModal({ onClose, onDone }: { onClose: () => void; onDone: (r: GrantActionResult) => void }) {
  const [query, setQuery] = useState('');
  const [hours, setHours] = useState(24);
  const [right, setRight] = useState<'xem' | 'ghi_chu'>('xem');
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      title="Xin quyền theo SĐT / mã KH"
      okText="Gửi yêu cầu"
      cancelText="Hủy"
      okButtonProps={{ disabled: query.trim().length < 3 || reason.trim().length < 10 }}
      onCancel={onClose}
      onOk={() =>
        post('/access-grants/by-identity', { query: query.trim(), right, durationHours: hours, reason: reason.trim() })
          .then((r) => (onDone(r), onClose()))
          .catch((e: Error) => message.error(e.message))
      }
    >
      <Form layout="vertical">
        <Form.Item label="SĐT hoặc mã KH ERP" required>
          <Input value={query} maxLength={60} onChange={(e) => setQuery(e.target.value)} />
        </Form.Item>
        <Form.Item label="Loại quyền">
          <Select value={right} onChange={setRight} options={[{ value: 'xem', label: 'Xem' }, { value: 'ghi_chu', label: 'Xem + Ghi chú' }]} />
        </Form.Item>
        <Form.Item label="Thời hạn">
          <Select value={hours} onChange={setHours} options={GRANT_DURATION_HOURS.map((h) => ({ value: h, label: HOURS_LABEL[h] }))} />
        </Form.Item>
        <Form.Item label="Lý do" required extra="10–300 ký tự.">
          <Input.TextArea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
