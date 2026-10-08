import { useState } from 'react';
import { Drawer } from 'antd';
import OutboxList from './OutboxList';

interface Props {
  open: boolean;
  onClose: () => void;
  thread: { uid: string; threadId: string; name?: string };
}

/** MH-SZ-13 as a right drawer (520 px) opened from the chat header, pre-filtered on that conversation. */
export default function OutboxDrawer({ open, onClose, thread }: Props) {
  const [filtered, setFiltered] = useState(true);
  return (
    <Drawer title="Lệnh gửi" width={520} open={open} onClose={onClose} destroyOnClose afterOpenChange={(o) => o && setFiltered(true)}>
      <OutboxList thread={filtered ? thread : undefined} onClearThread={() => setFiltered(false)} />
    </Drawer>
  );
}
