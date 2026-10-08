import { App, Button, Popconfirm, Switch, Table } from 'antd';
import { QrcodeOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zaloSlotStateLabel, type ZaloSlotState, type ZaloSlotView } from '@vclinks/shared';
import { api } from '../../api';
import ZaloQrDialog, { type ZaloQrTarget } from '../../components/channels/ZaloQrDialog';
import { useZaloFarm } from '../../components/channels/zaloFarm';

const TONE: Partial<Record<ZaloSlotState, string>> = {
  da_ket_noi: 'soft-chip--ok',
  mat_phien: 'soft-chip--danger',
  quet_nham: 'soft-chip--danger',
  loi: 'soft-chip--danger',
  cho_quet: 'soft-chip--warn',
  da_quet: 'soft-chip--warn',
};

/**
 * "Máy Zalo" on the Kênh page: nicks connected by scanning a QR (one Chrome profile each on the server).
 * Admins connect and disconnect any nick; a holder sees his own nicks, scans again when the session drops and may
 * disconnect them (dev002, 07/10/2026).
 */
export default function ZaloFarmSection({ onOpen }: { onOpen: (t: ZaloQrTarget) => void }) {
  const { farm, slots } = useZaloFarm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const disconnect = useMutation({
    mutationFn: (id: string) => api(`/zalo/slots/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      message.success('Đã ngắt kết nối và xóa phiên Zalo trên máy chủ. Lịch sử tin vẫn giữ trong VClinks.');
      void qc.invalidateQueries({ queryKey: ['zalo-slots'] });
      void qc.invalidateQueries({ queryKey: ['zalo-farm'] });
    },
    onError: (e) => message.error((e as Error).message),
  });
  // Plan P4: move a nick between Zalo Web and the direct mode (Admin).
  const move = useMutation({
    mutationFn: (v: { id: string; to: 'direct' | 'browser' }) =>
      api<ZaloSlotView>(`/zalo/slots/${encodeURIComponent(v.id)}/${v.to === 'direct' ? 'handover' : 'rollback'}`, { method: 'POST', body: {} }),
    onSuccess: (_, v) => {
      message.success(v.to === 'direct' ? 'Đã chuyển nick sang kết nối trực tiếp.' : 'Đã đưa nick về Zalo Web. Nếu Zalo đòi, quét lại QR.');
      void qc.invalidateQueries({ queryKey: ['zalo-slots'] });
      void qc.invalidateQueries({ queryKey: ['health'] });
    },
    onError: (e) => message.error((e as Error).message),
  });
  const setUnread = useMutation({
    mutationFn: (v: { id: string; openUnread: boolean }) => api(`/zalo/slots/${encodeURIComponent(v.id)}`, { method: 'PATCH', body: { openUnread: v.openUnread } }),
    onSuccess: (_, v) => {
      message.success(v.openUnread ? 'Đã bật: nick này tự mở cả hội thoại chưa đọc để lấy nội dung.' : 'Đã tắt: nick này không mở hội thoại chưa đọc nữa.');
      void qc.invalidateQueries({ queryKey: ['zalo-slots'] });
    },
    onError: (e) => message.error((e as Error).message),
  });
  const f = farm.data;
  if (!f?.installed) return null;
  const rows = slots.data ?? [];
  if (!rows.length && !f.canManage) return null;

  return (
    <section className="surface map-section" aria-labelledby="zalo-farm">
      <div className="map-section__head">
        <h2 id="zalo-farm" className="surface__title">
          Máy Zalo
        </h2>
        <span className="map-section__note">
          nick Zalo cá nhân kết nối bằng mã QR, chạy 24/7 trên máy chủ · {f.slots}/{f.max} nick
        </span>
        {f.canManage && (
          <Button type="primary" icon={<QrcodeOutlined />} className="map-toolbar__action" onClick={() => onOpen({ mode: 'create' })} disabled={f.slots >= f.max}>
            Kết nối bằng mã QR
          </Button>
        )}
      </div>
      <Table<ZaloSlotView>
        rowKey="id"
        size="middle"
        pagination={false}
        loading={slots.isLoading}
        dataSource={rows}
        scroll={{ x: 720 }}
        locale={{ emptyText: 'Chưa có nick nào trên máy Zalo. Bấm "Kết nối bằng mã QR" để thêm.' }}
        columns={[
          {
            title: 'Nick',
            key: 'nick',
            render: (_, r) => (
              <div>
                <div className="map-channel__name">{r.label}</div>
                <div className="map-channel__sub">{r.divisionName ?? '—'}</div>
              </div>
            ),
          },
          { title: 'Người giữ', key: 'holder', render: (_, r) => r.holderName ?? '—' },
          {
            title: 'Cách kết nối',
            key: 'mode',
            render: (_, r) =>
              r.mode === 'direct' ? (
                <span className="soft-chip soft-chip--warn" title="Nói chuyện thẳng với Zalo: tin mới về Hộp thư ngay, có nội dung. Thử nghiệm: có rủi ro Zalo hạn chế nick.">
                  Trực tiếp (thử nghiệm)
                </span>
              ) : r.handoverAt ? (
                <span className="map-channel__sub" title="Đang lấy tin cũ qua Zalo Web, sau đó tự chuyển sang kết nối trực tiếp">
                  Zalo Web → trực tiếp lúc {new Date(r.handoverAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : (
                <span className="map-channel__sub">Zalo Web</span>
              ),
          },
          {
            title: 'Trạng thái',
            key: 'state',
            render: (_, r) => <span className={`soft-chip ${TONE[r.state] ?? ''}`}>{zaloSlotStateLabel(r.state, r.mode)}</span>,
          },
          {
            title: 'Lấy nội dung tin chưa đọc',
            key: 'openUnread',
            render: (_, r) => {
              if (r.mode === 'direct') return <span className="map-channel__sub">Không cần</span>;
              if (!f.canManage) return <span className="map-channel__sub">{r.openUnread ? 'Bật' : 'Tắt'}</span>;
              const control = (
                <Switch
                  size="small"
                  checked={r.openUnread}
                  loading={setUnread.isPending && setUnread.variables?.id === r.id}
                  aria-label={`Lấy nội dung cả hội thoại chưa đọc của nick ${r.label}`}
                />
              );
              return r.openUnread ? (
                <Popconfirm title="Tắt lấy nội dung tin chưa đọc?" okText="Tắt" cancelText="Hủy" onConfirm={() => setUnread.mutate({ id: r.id, openUnread: false })}>
                  {control}
                </Popconfirm>
              ) : (
                <Popconfirm
                  title={`Bật cho nick ${r.label}?`}
                  description={'Nội dung tin hiện sau vài giây thay vì chờ người giữ nick đọc trên điện thoại. Đổi lại, người gửi sẽ thấy “Đã xem” ngay khi máy Zalo mở hội thoại, và người giữ nick mất số tin chưa đọc trên điện thoại. Chỉ bật cho nick chấp nhận điều đó (ví dụ nick thử).'}
                  okText="Bật"
                  cancelText="Hủy"
                  overlayStyle={{ maxWidth: 360 }}
                  onConfirm={() => setUnread.mutate({ id: r.id, openUnread: true })}
                >
                  {control}
                </Popconfirm>
              );
            },
          },
          {
            title: '',
            key: 'actions',
            align: 'right',
            render: (_, r) => (
              <div className="map-actions">
                {r.state !== 'da_ket_noi' ? (
                  <Button size="small" type={r.state === 'mat_phien' ? 'primary' : 'default'} onClick={() => onOpen({ mode: 'slot', id: r.id })}>
                    {r.uid ? 'Quét lại QR' : 'Mở mã QR'}
                  </Button>
                ) : (
                  <Button size="small" onClick={() => onOpen({ mode: 'slot', id: r.id })}>
                    Xem
                  </Button>
                )}
                {f.canManage && r.mode !== 'direct' && r.state === 'da_ket_noi' && (
                  <Popconfirm
                    title={`Chuyển nick ${r.label} sang kết nối trực tiếp?`}
                    description="Phiên Zalo Web của nick chuyển sang kết nối thẳng với Zalo: tin mới về ngay, gửi không cần Chrome. Tin cũ chưa lấy được nội dung sẽ ghi rõ là chưa lấy. Trong 7 ngày có thể quay về Zalo Web."
                    okText="Chuyển"
                    cancelText="Hủy"
                    overlayStyle={{ maxWidth: 360 }}
                    onConfirm={() => move.mutate({ id: r.id, to: 'direct' })}
                  >
                    <Button size="small" loading={move.isPending && move.variables?.id === r.id}>
                      Chuyển sang trực tiếp
                    </Button>
                  </Popconfirm>
                )}
                {f.canManage && r.mode === 'direct' && r.chromeKept && (
                  <Popconfirm
                    title={`Đưa nick ${r.label} về Zalo Web?`}
                    description="Kết nối trực tiếp dừng, máy Zalo mở lại Zalo Web của nick. Nếu Zalo đòi đăng nhập lại thì quét QR."
                    okText="Quay về"
                    cancelText="Hủy"
                    overlayStyle={{ maxWidth: 360 }}
                    onConfirm={() => move.mutate({ id: r.id, to: 'browser' })}
                  >
                    <Button size="small" loading={move.isPending && move.variables?.id === r.id}>
                      Quay về Zalo Web
                    </Button>
                  </Popconfirm>
                )}
                {(f.canManage || r.canDisconnect) && (
                  <Popconfirm
                    title={`Ngắt kết nối nick ${r.label}?`}
                    description={`Máy Zalo tắt và xóa phiên đăng nhập của nick này. Tin đã lưu vẫn giữ. Nên đăng xuất phiên máy tính trong app Zalo của nick.${f.canManage ? '' : ' Muốn kết nối lại, nhờ Admin tạo chỗ mới.'}`}
                    okText="Ngắt kết nối"
                    okButtonProps={{ danger: true }}
                    cancelText="Hủy"
                    overlayStyle={{ maxWidth: 360 }}
                    onConfirm={() => disconnect.mutate(r.id)}
                  >
                    <Button size="small" danger loading={disconnect.isPending && disconnect.variables === r.id}>
                      Ngắt
                    </Button>
                  </Popconfirm>
                )}
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}

export { ZaloQrDialog, useZaloFarm };
