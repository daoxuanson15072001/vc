import { Button, Space } from 'antd';
import { WORKITEM_MAX_MESSAGES } from '@vclinks/shared';

/** Thanh dưới của chế độ chọn tin (QT-SZ-13 bước 1): `Đã chọn {n}/10 tin · Tiếp tục · Hủy`. */
export default function SelectionBar({ count, onNext, onCancel }: { count: number; onNext: () => void; onCancel: () => void }) {
  return (
    <div className="chat-readonly wi-selectbar" role="toolbar">
      <Space>
        <span>{`Đã chọn ${count}/${WORKITEM_MAX_MESSAGES} tin`}</span>
        <Button type="primary" disabled={!count} onClick={onNext}>
          Tiếp tục
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </Space>
    </div>
  );
}
