import { InboxOutlined } from '@ant-design/icons';
import type { ImportCommitResult, ImportPreview } from '@vclinks/shared';
import { Alert, Button, Modal, Space, Statistic, Table, Tag, Tooltip, Upload, message } from 'antd';
import { useState } from 'react';
import { adminApi, downloadFile, fileToBase64 } from './adminApi';

const OUTCOME: Record<string, { label: string; color: string }> = {
  them: { label: 'Thêm', color: 'green' },
  doi: { label: 'Đổi', color: 'blue' },
  khong_doi: { label: 'Không đổi', color: 'default' },
  loi: { label: 'Lỗi', color: 'red' },
  cho_duyet: { label: 'Chờ duyệt', color: 'gold' },
};

/** MH-PQ-15 / MH-PQ-01 #10: choose file, check (writes nothing), then import (locked while any row is wrong). */
export default function ImportModal({
  kind,
  open,
  onClose,
  onDone,
}: {
  kind: 'users' | 'org';
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<{ fileName: string; contentBase64: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const base = kind === 'users' ? '/admin/users/import' : '/admin/org-units/import';
  const stem = kind === 'users' ? 'nguoi-dung' : 'don-vi';

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setResult(null);
  };

  const check = async (f = file) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await adminApi.importPreview(kind, f));
    } catch (e) {
      setPreview(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await adminApi.importCommit(kind, file);
      setResult(r);
      message.success(r.summary);
      onDone();
    } catch (e) {
      setError(`Không nhập được. Chưa có thay đổi nào được ghi. (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
  };

  const bad = preview?.loi ?? 0;
  return (
    <Modal
      title={kind === 'users' ? 'Nhập người dùng từ file' : 'Nhập đơn vị từ file'}
      open={open}
      width={860}
      onCancel={() => {
        reset();
        onClose();
      }}
      footer={
        result ? (
          <Button type="primary" onClick={() => { reset(); onClose(); }}>Đóng</Button>
        ) : (
          <Space>
            <Button onClick={() => { reset(); onClose(); }}>Hủy</Button>
            <Tooltip title={bad ? `Sửa ${bad} dòng lỗi rồi kiểm tra lại. Chưa có gì được ghi.` : undefined}>
              <Button type="primary" disabled={!preview || bad > 0 || preview.total === 0} loading={busy} onClick={commit}>
                Nhập
              </Button>
            </Tooltip>
          </Space>
        )
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Space wrap>
          <Button onClick={() => downloadFile(`${base}/template?format=csv`, `${stem}-mau.csv`).catch((e) => message.error(e.message))}>Tải file mẫu (CSV)</Button>
          <Button onClick={() => downloadFile(`${base}/template?format=xlsx`, `${stem}-mau.xlsx`).catch((e) => message.error(e.message))}>Tải file mẫu (Excel)</Button>
          <Button onClick={() => downloadFile(`${base}/current?format=csv`, `${stem}-hien-trang.csv`).catch((e) => message.error(e.message))}>Tải hiện trạng</Button>
        </Space>
        <Upload.Dragger
          accept=".csv,.xlsx"
          maxCount={1}
          beforeUpload={async (f) => {
            const next = { fileName: f.name, contentBase64: await fileToBase64(f) };
            setFile(next);
            setResult(null);
            void check(next);
            return false;
          }}
          onRemove={reset}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>Chọn hoặc kéo file CSV / Excel vào đây (tối đa 2.000 dòng)</p>
        </Upload.Dragger>
        {error && <Alert type="error" showIcon message={error} />}
        {result && <Alert type="success" showIcon message={result.summary} />}
        {preview && !result && (
          <>
            <Space size={24}>
              <Statistic title="Dòng" value={preview.total} />
              <Statistic title="Thêm" value={preview.them} />
              <Statistic title="Đổi" value={preview.doi} />
              <Statistic title="Không đổi" value={preview.khongDoi} />
              <Statistic title="Lỗi" value={preview.loi} valueStyle={preview.loi ? { color: 'var(--danger)' } : undefined} />
              {kind === 'users' && <Statistic title="Chờ duyệt" value={preview.choDuyet} />}
            </Space>
            <Table
              size="small"
              rowKey={(r) => `${r.line}`}
              dataSource={preview.rows}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              columns={[
                { title: 'Dòng', dataIndex: 'line', width: 64 },
                { title: kind === 'users' ? 'Email' : 'Mã đơn vị', dataIndex: 'key' },
                {
                  title: 'Kết quả',
                  render: (_, r) => (
                    <Space direction="vertical" size={2}>
                      <span>
                        <Tag color={OUTCOME[r.outcome]?.color}>{OUTCOME[r.outcome]?.label}</Tag>
                        {r.message}
                      </span>
                      {r.warnings.map((w) => (
                        <span key={w} style={{ color: 'var(--warn-ink)' }}>{w}</span>
                      ))}
                    </Space>
                  ),
                },
              ]}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}
