import { Alert, Button, Modal, Typography } from 'antd';
import { TOKEN_TEXT } from '@vclinks/shared';

/** The one time a token string is on screen (MH-PQ-08 #10). Closing it loses the string for good. */
export default function ShowTokenModal({ secret, onClose }: { secret: string | null; onClose: () => void }) {
  return (
    <Modal
      open={!!secret}
      title="Token vừa tạo"
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={<Button type="primary" onClick={onClose}>Đã sao chép, đóng</Button>}
    >
      <Alert type="warning" showIcon message={TOKEN_TEXT.showOnce} style={{ marginBottom: 12 }} />
      <Typography.Text code copyable style={{ wordBreak: 'break-all' }}>{secret}</Typography.Text>
    </Modal>
  );
}
