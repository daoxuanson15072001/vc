import { useEffect, useState } from 'react';
import { Alert, App, Button, Checkbox, Form, Input, Modal, Radio, Result, Select, Spin } from 'antd';
import { CheckCircleFilled, LoadingOutlined, WarningFilled } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zaloSlotStateLabel, type AdminUser, type OrgUnit, type ZaloSlotView, type ZaloSyncHistoryResult } from '@vclinks/shared';
import { api } from '../../api';

/*
 * "Kết nối nick Zalo bằng mã QR" (máy Zalo, docs/01-quan-ly-du-an/ke-hoach-zalo-ca-nhan-quet-qr.md §3.5).
 * create: the Admin names the nick, its division and holder, confirms it is a company nick → QR.
 * slot / rescan: the QR of an existing slot (polled every 2 s while the dialog is open; the image is never kept).
 */
export type ZaloQrTarget = { mode: 'create' } | { mode: 'slot'; id: string } | { mode: 'rescan'; uid: string };

/**
 * "Trực tiếp, lấy cả tin cũ" (plan P4: Zalo Web first, then the agent moves the session to zca-js) stays off until the
 * live handover test P4.0 on the test nick passes (after the 48-hour watch, 08/10/2026).
 */
const HISTORY_FIRST_READY = false;

/** Roles that may hold a personal nick (channel-access LEVELS_OF_ROLE). */
const HOLDER_ROLES = new Set(['nvkd', 'giam_sat_bh', 'nv_thi_truong']);
const POLL_MS = 2000;

export default function ZaloQrDialog({ target, onClose }: { target: ZaloQrTarget | null; onClose: () => void }) {
  const [slotId, setSlotId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { message } = App.useApp();

  // Rescan: the API finds the slot of the nick and wakes its Chrome; then poll that slot.
  const rescan = useMutation({
    mutationFn: (uid: string) => api<ZaloSlotView>(`/zalo/rescan/${encodeURIComponent(uid)}`, { method: 'POST', body: {} }),
    onSuccess: (v) => setSlotId(v.id),
  });
  useEffect(() => {
    setSlotId(target?.mode === 'slot' ? target.id : null);
    if (target?.mode === 'rescan') rescan.mutate(target.uid);
    // Only when the dialog target changes (rescan.mutate is stable in practice).
  }, [target]);

  const close = () => {
    void qc.invalidateQueries({ queryKey: ['zalo-slots'] });
    void qc.invalidateQueries({ queryKey: ['zalo-farm'] });
    setSlotId(null);
    onClose();
  };

  let body;
  if (!target) body = null;
  else if (target.mode === 'rescan' && rescan.isError) body = <Alert type="warning" showIcon message={(rescan.error as Error).message} />;
  else if (slotId) body = <QrPanel slotId={slotId} />;
  else if (target.mode === 'create') body = <CreateForm onCreated={(v) => { setSlotId(v.id); message.success('Đã tạo chỗ cho nick, đang mở Zalo Web…'); }} />;
  else body = <Spin style={{ display: 'block', margin: '40px auto' }} />;

  return (
    <Modal open={!!target} onCancel={close} footer={null} width={720} title="Kết nối nick Zalo bằng mã QR" destroyOnClose>
      {body}
    </Modal>
  );
}

function CreateForm({ onCreated }: { onCreated: (v: ZaloSlotView) => void }) {
  const [form] = Form.useForm<{ label: string; divisionId: string; holderUserId: string; companyNick: boolean; how: 'direct_history' | 'direct' | 'browser' }>();
  const units = useQuery({ queryKey: ['admin', 'units'], queryFn: () => api<OrgUnit[]>('/admin/org-units') });
  const users = useQuery({ queryKey: ['admin', 'users', 'all'], queryFn: () => api<{ items: AdminUser[] }>('/admin/users', { query: { pageSize: 200 } }) });
  const create = useMutation({
    mutationFn: (v: { label: string; divisionId: string; holderUserId: string; mode: 'direct' | 'browser'; history?: boolean }) =>
      api<ZaloSlotView>('/zalo/slots', { method: 'POST', body: { ...v, companyNick: true } }),
    onSuccess: onCreated,
  });
  const divisions = (units.data ?? []).filter((u) => u.type === 'division' && u.active);
  const holders = (users.data?.items ?? []).filter((u) => u.status === 'hoat_dong' && !u.isSelf && u.assignments.some((a) => HOLDER_ROLES.has(a.roleKey)));
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ how: HISTORY_FIRST_READY ? 'direct_history' : 'direct' }}
      onFinish={(v) =>
        create.mutate({
          label: v.label,
          divisionId: v.divisionId,
          holderUserId: v.holderUserId,
          mode: v.how === 'browser' ? 'browser' : 'direct',
          ...(v.how === 'direct_history' ? { history: true } : {}),
        })
      }
      requiredMark={false}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Nick sẽ chạy trên máy Zalo của công ty, 24/7."
        description="Sau khi kết nối, không đăng nhập nick này trên chat.zalo.me ở máy khác: Zalo chỉ giữ một phiên web, đăng nhập chỗ khác sẽ làm rớt kết nối. Không quét bằng nick đang chạy trên Chrome driver."
      />
      <Form.Item name="label" label="Tên nick" rules={[{ required: true, min: 2, message: 'Đặt tên nick (ít nhất 2 ký tự)' }]}>
        <Input placeholder="Ví dụ: Tú VCparts" maxLength={60} />
      </Form.Item>
      <Form.Item name="divisionId" label="Division" rules={[{ required: true, message: 'Chọn division' }]}>
        <Select loading={units.isLoading} options={divisions.map((d) => ({ value: d.id, label: d.name }))} placeholder="Chọn division" />
      </Form.Item>
      <Form.Item name="holderUserId" label="Người giữ nick (người cầm điện thoại của nick)" rules={[{ required: true, message: 'Chọn người giữ nick' }]}>
        <Select
          showSearch
          optionFilterProp="label"
          loading={users.isLoading}
          placeholder="Chọn người giữ nick"
          options={holders.map((u) => ({ value: u.id, label: `${u.fullName} · ${u.assignments.map((a) => a.orgUnitName).join(', ')}` }))}
        />
      </Form.Item>
      <Form.Item name="how" label="Cách kết nối">
        <Radio.Group className="qr-mode">
          <Radio value="direct_history" disabled={!HISTORY_FIRST_READY}>
            <b>Trực tiếp, lấy cả tin cũ {HISTORY_FIRST_READY ? '(khuyên dùng)' : '(mở sau phép thử ngày 08/10)'}</b>
            <div className="qr-mode__hint">
              Quét QR một lần. 30 phút đầu máy Zalo mở Zalo Web để lấy tin cũ và nội dung gần đây, rồi tự chuyển sang kết nối thẳng với Zalo: tin mới về ngay, gửi không cần Chrome. Thử nghiệm: có rủi ro Zalo hạn chế nick.
            </div>
          </Radio>
          <Radio value="direct">
            <b>Trực tiếp, không lấy tin cũ</b>
            <div className="qr-mode__hint">Nói chuyện thẳng với Zalo ngay từ đầu: tin mới về Hộp thư ngay, có nội dung. Tin trước lúc quét QR không có.</div>
          </Radio>
          <Radio value="browser">
            <b>Qua Zalo Web</b>
            <div className="qr-mode__hint">Chrome và tiện ích VClinks chạy trên máy Zalo (cách đang dùng).</div>
          </Radio>
        </Radio.Group>
      </Form.Item>
      <Form.Item name="companyNick" valuePropName="checked" rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('Chỉ kết nối nick công ty'))) }]}>
        <Checkbox>Tôi xác nhận đây là nick công ty (SIM và tài khoản thuộc công ty), không phải nick riêng của nhân viên.</Checkbox>
      </Form.Item>
      {create.isError && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={(create.error as Error).message} />}
      <Button type="primary" htmlType="submit" loading={create.isPending}>
        Tạo mã QR
      </Button>
    </Form>
  );
}

function QrPanel({ slotId }: { slotId: string }) {
  const { message } = App.useApp();
  const slot = useQuery({
    queryKey: ['zalo-slot', slotId],
    queryFn: () => api<ZaloSlotView>(`/zalo/slots/${encodeURIComponent(slotId)}`, { query: { qr: 1 } }),
    refetchInterval: (q) => (q.state.data?.state === 'da_ket_noi' || q.state.data?.state === 'da_ngat' ? false : POLL_MS),
    // The image is relayed live; nothing is kept once the dialog closes.
    gcTime: 0,
    retry: false,
  });
  const sync = useMutation({
    mutationFn: () => api<ZaloSyncHistoryResult>(`/zalo/slots/${encodeURIComponent(slotId)}/sync-history`, { method: 'POST', body: {} }),
    onSuccess: (r) => (r.requested ? message.success(r.message, 8) : message.warning(r.message, 8)),
    onError: (e) => message.error((e as Error).message),
  });
  const v = slot.data;
  if (slot.isError) return <Alert type="error" showIcon message={(slot.error as Error).message} />;
  if (!v) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

  if (v.state === 'da_ket_noi' && v.mode === 'direct') {
    return (
      <Result
        status="success"
        title={`Đã kết nối trực tiếp nick ${v.label}`}
        subTitle={`${v.divisionName ?? ''} · người giữ: ${v.holderName ?? '—'}`}
        extra={
          <div className="qr-done">
            <Alert
              type="info"
              showIcon
              style={{ textAlign: 'left' }}
              message="Tin mới của nick (cả nhóm) về Hộp thư ngay khi đến, tin gửi trên Dashboard đi ngay qua nick này. Tin trước lúc quét QR chưa có."
            />
            <Alert
              type="warning"
              showIcon
              style={{ textAlign: 'left' }}
              message="Đừng mở chat.zalo.me của nick này ở nơi khác: Zalo chỉ giữ một phiên web, kết nối trực tiếp sẽ bị ngắt."
            />
          </div>
        }
      />
    );
  }
  if (v.state === 'da_ket_noi') {
    return (
      <Result
        status="success"
        title={`Đã kết nối nick ${v.label}`}
        subTitle={`${v.divisionName ?? ''} · người giữ: ${v.holderName ?? '—'}. VClinks bắt đầu nhận tin mới; danh sách hội thoại hiện dần trong vài phút.`}
        extra={
          <div className="qr-done">
            {v.handoverAt && (
              <Alert
                type="info"
                showIcon
                style={{ textAlign: 'left' }}
                message={`Đang lấy tin cũ qua Zalo Web. Lúc ${new Date(v.handoverAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} nick tự chuyển sang kết nối trực tiếp.`}
              />
            )}
            {v.message && <Alert type="info" showIcon message={v.message} style={{ textAlign: 'left' }} />}
            <Alert
              type="warning"
              showIcon
              style={{ textAlign: 'left' }}
              message="Đừng đăng nhập nick này trên chat.zalo.me ở máy khác: Zalo chỉ giữ một phiên web, nick sẽ bị rớt khỏi VClinks."
            />
            <div className="qr-done__sync">
              <div>
                <b>Lấy tin nhắn cũ từ điện thoại</b>
                <div className="qr-done__hint">Không làm bước này thì VClinks chỉ có tin từ lúc kết nối. Bấm nút, rồi trên điện thoại bấm "Đồng bộ ngay" và chờ xong.</div>
              </div>
              <Button onClick={() => sync.mutate()} loading={sync.isPending}>
                Đồng bộ tin nhắn cũ
              </Button>
            </div>
          </div>
        }
      />
    );
  }
  if (v.state === 'da_ngat') return <Result status="info" title="Nick này đã ngắt kết nối." />;

  const waiting = v.state === 'dang_bat' || v.state === 'dang_ket_noi';
  return (
    <div className="qr-panel">
      <div className="qr-panel__code" aria-live="polite">
        {v.qr ? (
          <img src={v.qr.png} alt={`Mã QR đăng nhập Zalo cho nick ${v.label}`} width={232} height={232} className={v.qr.expired ? 'is-expired' : undefined} />
        ) : v.state === 'da_quet' ? (
          <CheckCircleFilled className="qr-panel__icon qr-panel__icon--ok" />
        ) : v.state === 'quet_nham' || v.state === 'loi' ? (
          <WarningFilled className="qr-panel__icon qr-panel__icon--warn" />
        ) : (
          <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />
        )}
      </div>
      <div className="qr-panel__steps">
        <div className="qr-panel__nick">
          Nick <b>{v.label}</b> · {v.divisionName ?? ''} · người giữ: {v.holderName ?? '—'}
        </div>
        <ol>
          <li>Mở app Zalo trên điện thoại của nick này.</li>
          <li>Bấm biểu tượng quét mã QR và quét mã bên trái.</li>
          <li>
            Bấm <b>Đăng nhập</b> trên điện thoại (có thể phải chờ khoảng 5 giây nút mới bấm được).
          </li>
        </ol>
        <div className={`qr-panel__state qr-panel__state--${v.state}`}>
          {waiting && <LoadingOutlined />} {zaloSlotStateLabel(v.state, v.mode)}
        </div>
        {v.message && <Alert type={v.state === 'quet_nham' || v.state === 'loi' ? 'warning' : 'info'} showIcon message={v.message} />}
        <div className="qr-panel__note">Chỉ quét bằng điện thoại của nick này. Quét nhầm tài khoản khác, máy Zalo sẽ tự đăng xuất.</div>
      </div>
    </div>
  );
}
