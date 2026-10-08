import { Modal, Radio } from 'antd';
import { useState } from 'react';
import { REVOKE_REASONS, REVOKE_REASON_LABELS, type RevokeReason } from '@vclinks/shared';

/** Revoking asks for a reason (MH-PQ-08 #11). */
export default function RevokeModal({ name, open, loading, onOk, onCancel }: { name: string; open: boolean; loading?: boolean; onOk: (r: RevokeReason) => void; onCancel: () => void }) {
  const [reason, setReason] = useState<RevokeReason>('het_dung');
  return (
    <Modal open={open} title={`Thu hồi ${name}?`} okText="Thu hồi" cancelText="Hủy" okButtonProps={{ danger: true, loading }} onOk={() => onOk(reason)} onCancel={onCancel}>
      <p>Mọi AI / thiết bị dùng token này sẽ mất truy cập trong vòng 1 phút.</p>
      <Radio.Group value={reason} onChange={(e) => setReason(e.target.value as RevokeReason)}>
        {REVOKE_REASONS.map((r) => (
          <Radio key={r} value={r}>{REVOKE_REASON_LABELS[r]}</Radio>
        ))}
      </Radio.Group>
    </Modal>
  );
}
