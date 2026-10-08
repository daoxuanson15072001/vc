import { useState, type ReactNode } from 'react';
import { Alert, App, DatePicker, Dropdown, Input, Modal } from 'antd';
import { BellOutlined, CopyOutlined, FileTextOutlined, InfoCircleOutlined, ToolOutlined } from '@ant-design/icons';
import type { WorkitemKind } from '@vclinks/shared';
import dayjs, { type Dayjs } from 'dayjs';
import type { ChatMessage } from '../../types';
import { messageSummary } from '../../utils/chat';
import { addLocalReminder } from '../../utils/reminders';
import { copyText, useMe } from '../outbox/queue';

/**
 * Text "Sao chép" puts on the clipboard: exactly what the bubble shows, i.e. what the API served to this viewer.
 * It never reaches for any other copy, so a phone number masked by the API stays masked (01 §3, PQ-12).
 * Empty for system lines and for bubbles with no text.
 */
export function copyTextOf(m: ChatMessage): string {
  if (m.systemEvent) return '';
  const t = typeof m.text === 'string' ? m.text : '';
  return t.trim() ? t : '';
}

interface Props {
  m: ChatMessage;
  conversationId: string;
  /** Opens the conversation info panel (MH-SZ-07), when the page has one. */
  onOpenInfo?: () => void;
  /** "Chuyển hậu mãi cho CSKH" / "Chuyển CSKH soạn báo giá" (MH-SZ-04 #8, #8b): owner or nick holder only. */
  onTransfer?: (kind: WorkitemKind) => void;
  children: ReactNode;
}

/**
 * Right-click menu of a message (03 MH-SZ-04 #3-#5): Sao chép, Tạo nhắc việc từ tin này, Xem thông tin hội thoại.
 * Forward / recall are later phases and are not listed. The browser's own menu stays on selected text so the user can
 * still copy a selection.
 */
export default function MessageMenu({ m, conversationId, onOpenInfo, onTransfer, children }: Props) {
  const { message } = App.useApp();
  const [remindOpen, setRemindOpen] = useState(false);
  const text = copyTextOf(m);
  if (m.systemEvent) return <>{children}</>;
  return (
    <>
      <Dropdown
        trigger={['contextMenu']}
        menu={{
          items: [
            { key: 'copy', icon: <CopyOutlined />, label: 'Sao chép', disabled: !text },
            { key: 'remind', icon: <BellOutlined />, label: 'Tạo nhắc việc từ tin này' },
            ...(onOpenInfo ? [{ key: 'info', icon: <InfoCircleOutlined />, label: 'Xem thông tin hội thoại' }] : []),
            ...(onTransfer
              ? [
                  { type: 'divider' as const },
                  { key: 'wi:hau_mai', icon: <ToolOutlined />, label: 'Chuyển hậu mãi cho CSKH' },
                  { key: 'wi:bao_gia', icon: <FileTextOutlined />, label: 'Chuyển CSKH soạn báo giá' },
                ]
              : []),
          ],
          onClick: async ({ key }) => {
            if (key === 'copy') {
              if (await copyText(text)) message.success('Đã sao chép');
              else message.error('Không sao chép được. Hãy bôi đen chữ rồi nhấn Ctrl+C.');
            } else if (key === 'remind') setRemindOpen(true);
            else if (key === 'info') onOpenInfo?.();
            else if (key === 'wi:hau_mai' || key === 'wi:bao_gia') onTransfer?.(key.slice(3) as WorkitemKind);
          },
        }}
      >
        <div>{children}</div>
      </Dropdown>
      {remindOpen && <ReminderModal m={m} conversationId={conversationId} onClose={() => setRemindOpen(false)} />}
    </>
  );
}

/** Reminder dialog; kept in this browser until the task module (file 02) exists, and says so. */
function ReminderModal({ m, conversationId, onClose }: { m: ChatMessage; conversationId: string; onClose: () => void }) {
  const { message } = App.useApp();
  const me = useMe();
  const owner = me.data ? (me.data.userId ?? me.data.name) : undefined;
  const [at, setAt] = useState<Dayjs | null>(() => dayjs().add(1, 'day').hour(9).minute(0).second(0));
  const [note, setNote] = useState('');
  const save = () => {
    if (!at) return;
    const ok = addLocalReminder(owner, { conversationId, msgId: m.msgId, at: at.toISOString(), note: note || messageSummary(m) });
    if (ok) message.success('Đã tạo nhắc việc (lưu trên trình duyệt này)');
    else message.error('Không lưu được nhắc việc. Trình duyệt đang chặn lưu dữ liệu.');
    onClose();
  };
  return (
    <Modal open title="Tạo nhắc việc từ tin này" okText="Tạo nhắc việc" cancelText="Hủy" onOk={save} okButtonProps={{ disabled: !at }} onCancel={onClose} destroyOnClose>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Nhắc việc chỉ lưu trên trình duyệt này, chưa đồng bộ lên máy chủ và chưa báo chuông. Phần nhắc việc dùng chung sẽ có khi module Việc cần làm hoàn thành."
      />
      <div style={{ marginBottom: 8, color: 'var(--muted)' }}>Tin: {messageSummary(m)}</div>
      <DatePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" value={at} onChange={setAt} allowClear={false} style={{ width: '100%', marginBottom: 8 }} />
      <Input.TextArea rows={2} maxLength={500} placeholder="Ghi chú (bỏ trống thì dùng nội dung tin)" value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  );
}
