import { Badge, Tooltip, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { CustomerActivityRow } from '@vclinks/shared';
import { relativeListTime } from '../../utils/time';
import ChannelChip from './ChannelChip';

const ago = (iso: string | null) => {
  const t = relativeListTime(iso);
  return /^\d+ (phút|giờ)$/.test(t) ? `${t} trước` : t;
};

/**
 * "Khách đang hoạt động" (02 MH-DK-02 #6, DK-43): the customer's conversations with an inbound message in the last 7
 * days, newest first. Green dot ≤ 30 minutes. A conversation the viewer may not read keeps chip, person and time but
 * has no link and no content, with the tooltip of 00 MH-UI-09 #8b (DK-40, UAT-DK-18). `limit` = the short list
 * "Liên lạc gần đây" of the chat panel (3 rows).
 */
export default function ActivityList({ rows, currentId, limit }: { rows: CustomerActivityRow[]; currentId?: string; limit?: number }) {
  const navigate = useNavigate();
  const shown = limit ? rows.slice(0, limit) : rows;
  if (!shown.length) return <Typography.Text type="secondary">Khách chưa nhắn kênh nào trong 7 ngày.</Typography.Text>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {shown.map((a) => {
        const who = a.handlerName ?? a.nickOwnerName;
        const line = (
          <div
            key={a.conversationId}
            role={a.locked ? undefined : 'button'}
            tabIndex={a.locked ? undefined : 0}
            onClick={() => !a.locked && a.conversationId !== currentId && navigate(`/conversations/${encodeURIComponent(a.conversationId)}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', cursor: a.locked || a.conversationId === currentId ? 'default' : 'pointer', opacity: a.locked ? 0.7 : 1 }}
          >
            <Badge status={a.active ? 'success' : 'default'} />
            <ChannelChip channel={a.channel} nickLabel={a.nickLabel} ownerName={a.nickOwnerName} />
            {a.locked && <LockOutlined aria-label="Không có quyền xem" />}
            <span>{who ?? ''}</span>
            <Typography.Text type="secondary">{ago(a.lastInboundAt)}</Typography.Text>
            {a.conversationId === currentId && <Typography.Text type="secondary">(đang mở)</Typography.Text>}
            {a.unanswered > 0 && <span style={{ color: 'var(--warn-ink)' }}>{a.unanswered} tin chưa trả lời</span>}
          </div>
        );
        return a.locked ? (
          <Tooltip key={a.conversationId} title={`Hội thoại của ${who ?? 'người khác'} — bạn không xem được.`}>
            {line}
          </Tooltip>
        ) : (
          line
        );
      })}
    </div>
  );
}
