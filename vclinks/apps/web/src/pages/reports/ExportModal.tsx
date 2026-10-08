import { App, Modal, Radio, Typography } from 'antd';
import { useState } from 'react';
import { downloadReport, type ReportFilters } from './reportsApi';

/** "Xuất Excel" (BC-19, UI-TP-09): aggregate figures by default; the detail file adds the turn sheet (no text, no phone). */
export default function ExportModal(p: { open: boolean; onClose: () => void; filters: ReportFilters; canDetail: boolean }) {
  const { message } = App.useApp();
  const [detail, setDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await downloadReport(p.filters, detail && p.canDetail);
      message.success('Đã xuất file.');
      p.onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={p.open} title="Xuất Excel" okText="Tải về" cancelText="Đóng" confirmLoading={busy} onOk={run} onCancel={p.onClose}>
      <Radio.Group value={detail && p.canDetail ? 'detail' : 'sum'} onChange={(e) => setDetail(e.target.value === 'detail')}>
        <Radio value="sum" style={{ display: 'block', marginBottom: 8 }}>Chỉ số tổng hợp (không có dòng theo khách)</Radio>
        {p.canDetail ? <Radio value="detail" style={{ display: 'block' }}>Kèm danh sách chi tiết các lượt chờ (tên hiển thị khách, tối đa 500 dòng, kỳ tối đa 31 ngày)</Radio> : null}
      </Radio.Group>
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
        File không có nội dung tin nhắn và không có số điện thoại. Mỗi lần xuất được ghi vào nhật ký.
      </Typography.Paragraph>
    </Modal>
  );
}
