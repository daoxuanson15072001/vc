import { useState } from 'react';
import { Alert, App, Checkbox, DatePicker, Input, Modal, Select, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { AFTERSALES_TYPES, AFTERSALES_TYPE_LABELS, WORKITEM_NOTE_MAX, type AftersalesType, type WorkitemKind } from '@vclinks/shared';
import type { ChatMessage } from '../../types';
import { messageSummary } from '../../utils/chat';
import { useCreateWorkitem } from './workitemApi';

export const TRANSFER_LABELS: Record<WorkitemKind, string> = {
  bao_gia: 'Chuyển CSKH soạn báo giá',
  hau_mai: 'Chuyển hậu mãi cho CSKH',
};

interface Props {
  kind: WorkitemKind;
  uid: string;
  threadId: string;
  messages: ChatMessage[];
  onClose: () => void;
  onCreated: (id: string) => void;
}

/**
 * Hộp "Chuyển CSKH soạn báo giá" (QT-SZ-14 bước 2) / "Chuyển hậu mãi cho CSKH" (QT-SZ-13 bước 2).
 * Nothing goes to Zalo: the item lands in the CSKH queue and the chat gets its chip.
 */
export default function CreateWorkitemModal({ kind, uid, threadId, messages, onClose, onCreated }: Props) {
  const { message } = App.useApp();
  const create = useCreateWorkitem();
  const [note, setNote] = useState('');
  const [type, setType] = useState<AftersalesType | null>(null);
  const [aiExtract, setAiExtract] = useState(false);
  const [due, setDue] = useState<Dayjs | null>(() => (kind === 'bao_gia' ? dayjs().add(90, 'minute') : null));
  const ok = kind === 'bao_gia' || (!!type && note.trim().length >= 10);
  const submit = async () => {
    try {
      const r = await create.mutateAsync({
        uid,
        threadId,
        kind,
        messageIds: messages.map((m) => m.id),
        note: note.trim(),
        ...(type ? { aftersalesType: type } : {}),
        ...(due ? { dueAt: due.toDate() } : {}),
        aiExtract,
      });
      message.success(kind === 'bao_gia' ? `Đã tạo phiếu ${r.code} cho CSKH.` : `Đã tạo ticket ${r.code} cho CSKH.`);
      onCreated(r.id);
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  return (
    <Modal open title={TRANSFER_LABELS[kind]} okText={kind === 'bao_gia' ? 'Tạo phiếu' : 'Tạo ticket'} cancelText="Hủy" onOk={submit} okButtonProps={{ disabled: !ok, loading: create.isPending }} onCancel={onClose} destroyOnClose>
      <Typography.Text strong>Tin đã chọn ({messages.length})</Typography.Text>
      <div className="wi-sources" style={{ marginBottom: 12 }}>
        {messages.map((m) => (
          <div key={m.id} className="wi-source">
            {messageSummary(m)}
          </div>
        ))}
      </div>
      {kind === 'hau_mai' && (
        <Select style={{ width: '100%', marginBottom: 8 }} placeholder="Loại" value={type ?? undefined} onChange={setType} options={AFTERSALES_TYPES.map((t) => ({ value: t, label: AFTERSALES_TYPE_LABELS[t] }))} />
      )}
      <Input.TextArea
        rows={3}
        maxLength={WORKITEM_NOTE_MAX}
        showCount
        placeholder={kind === 'bao_gia' ? 'Ghi chú cho CSKH (ví dụ: khách quen, theo giá đại lý cấp 2)' : 'Mô tả ngắn (ít nhất 10 ký tự)'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {kind === 'bao_gia' && (
        <>
          <div style={{ marginTop: 8 }}>
            Hạn cần gửi khách:{' '}
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" value={due} onChange={setDue} />
          </div>
          <Checkbox checked={aiExtract} onChange={(e) => setAiExtract(e.target.checked)} style={{ marginTop: 8 }} disabled>
            Cho AI trích nhu cầu (chưa bật, chờ M1c-06 / E8)
          </Checkbox>
        </>
      )}
      <Alert style={{ marginTop: 12 }} type="info" showIcon message="Không gửi gì cho khách. CSKH soạn xong sẽ chuyển lại bạn duyệt và gửi qua nick." />
    </Modal>
  );
}
