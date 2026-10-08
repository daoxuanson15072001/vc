import { Button } from 'antd';
import { InfoCircleFilled, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { channelOfUid, type Channel, type Customer360 } from '@vclinks/shared';
import ChannelBadge from '../ChannelBadge';
import { nickName } from '../../utils/nick';

/*
 * One customer, several conversations (plan B2, BR-M3): the chat shows which other nicks / channels the
 * customer uses and jumps between them. Nothing is merged: each conversation keeps its own nick, history
 * and send path. Data: the Customer 360 of the open identity (same query as the customer panel).
 */

const open = (id: string) => `/conversations/${encodeURIComponent(id)}`;

/** "Kênh của khách" strip under the chat header; only when the customer has two conversations or more. */
export function CustomerChannelStrip({ data, currentId }: { data: Customer360; currentId: string }) {
  const navigate = useNavigate();
  // "Khách đang hoạt động" lists conversations with an inbound message in 7 days; the open one is always a tab.
  const rows: { conversationId: string; channel: Channel; nickLabel: string | null; nickOwnerName: string | null; unanswered: number; locked: boolean }[] = [...data.activity];
  if (!rows.some((a) => a.conversationId === currentId)) {
    const uid = currentId.slice(0, currentId.indexOf(':'));
    const ch = data.channels.find((c) => c.uid === uid);
    rows.unshift({ conversationId: currentId, channel: ch?.channel ?? channelOfUid(uid), nickLabel: ch?.nickLabel ?? null, nickOwnerName: ch?.nickOwnerName ?? null, unanswered: 0, locked: false });
  }
  if (rows.length < 2) return null;
  return (
    <div className="chan-strip" role="tablist" aria-label="Kênh của khách">
      {rows.map((a) => {
        const current = a.conversationId === currentId;
        return (
          <button
            key={a.conversationId}
            type="button"
            role="tab"
            aria-selected={current}
            className="chan-strip__tab"
            disabled={a.locked && !current}
            title={a.locked ? `Hội thoại của ${a.nickOwnerName ?? 'người khác'}: bạn không mở được` : undefined}
            onClick={() => !current && !a.locked && navigate(open(a.conversationId))}
          >
            <ChannelBadge channel={a.channel} compact />
            <span className="chan-strip__name">{nickName(a.nickLabel, a.nickOwnerName)}</span>
            {a.unanswered > 0 && !current && <span className="chan-strip__count">{a.unanswered}</span>}
            {a.locked && <LockOutlined aria-label="Không có quyền mở" />}
          </button>
        );
      })}
      {data.viewer.timeline && (
        <Link className="chan-strip__all" to={`/customers/${encodeURIComponent(data.customer.id)}?tab=timeline`}>
          Dòng thời gian chung
        </Link>
      )}
    </div>
  );
}

/** "Khách vừa nhắn qua kênh khác" (UAT-DK-73): other conversations of the customer still waiting, last 24 hours. */
export function CrossChannelBanner({ data }: { data: Customer360 }) {
  const navigate = useNavigate();
  if (!data.crossNick.length) return null;
  const first = data.crossNick.find((x) => !x.locked);
  return (
    <div className="cross-banner" role="status">
      <InfoCircleFilled className="cross-banner__icon" aria-hidden />
      <span className="cross-banner__text">
        Khách vừa nhắn qua kênh khác:{' '}
        {data.crossNick.map((x, i) => (
          <span key={x.conversationId}>
            {i > 0 && ', '}
            <b>{nickName(x.nickLabel, x.nickOwnerName)}</b> ({x.unanswered} tin chưa trả lời{x.locked ? ', bạn không mở được' : ''})
          </span>
        ))}
        . Trả lời ở đúng kênh khách vừa nhắn.
      </span>
      {first && (
        <Button size="small" type="link" onClick={() => navigate(open(first.conversationId))}>
          Mở hội thoại đó
        </Button>
      )}
    </div>
  );
}
