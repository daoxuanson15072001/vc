import { Tag, Tooltip } from 'antd';
import { WORKITEM_CHIP_LABELS, WORKITEM_KIND_LABELS, vnDate } from '@vclinks/shared';
import { STATUS_COLOR } from './WorkitemDrawer';
import { useWorkitems } from './workitemApi';

/** Chip phiếu trên tiêu đề khung chat (03 MH-SZ-15 #3): one tag per open item; click opens the panel. */
export default function WorkitemChips({ uid, threadId, onOpen, enabled }: { uid: string; threadId: string; onOpen: (id: string) => void; enabled: boolean }) {
  const list = useWorkitems('conversation', { uid, threadId, enabled });
  if (!list.data?.length) return null;
  return (
    <span className="wi-chips">
      {list.data.slice(0, 3).map((w) => (
        <Tooltip key={w.id} title={`${w.code} · ${w.assigneeName ?? 'chưa giao CSKH'}`}>
          <Tag color={STATUS_COLOR[w.status]} style={{ cursor: 'pointer' }} onClick={() => onOpen(w.id)}>
            {`Phiếu ${WORKITEM_KIND_LABELS[w.kind].toLowerCase()} ${w.code} · ${WORKITEM_CHIP_LABELS[w.status]}${w.status === 'cho_hang' && w.vendorDueAt ? ` · hẹn ${vnDate(w.vendorDueAt).slice(0, 5)}` : ''}`}
          </Tag>
        </Tooltip>
      ))}
    </span>
  );
}
