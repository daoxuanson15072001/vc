import { App, Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, ClockCircleOutlined, ExclamationCircleOutlined, LoadingOutlined, StopOutlined, WarningOutlined } from '@ant-design/icons';
import { OUTBOX_HOLD_REASON_LABELS, OUTBOX_STALE_SENDING_MS, OUTBOX_STATUS_LABELS, onBehalfLabel } from '@vclinks/shared';
import { usePermissions } from '../../state/permissions';
import { useNavigate } from 'react-router-dom';
import type { OutboxItem } from '../../types';
import { describeSendError } from '../../utils/send-errors';
import { dayjs, TZ } from '../../utils/time';
import { useAccountHealth } from '../AccountHealth';
import { isFriendCommand } from '../contacts/friend-requests';
import { BUSY_TOOLTIP, CANCELLED_TOAST, COPIED_TOAST, RETRIED_TOAST, copyText, hangingMinutes, useOutboxActions } from './queue';

const ICON: Record<string, React.ReactNode> = {
  approved: <ClockCircleOutlined />,
  sending: <LoadingOutlined />,
  sent: <CheckOutlined />,
  failed: <ExclamationCircleOutlined />,
  expired: <StopOutlined />,
  awaiting_confirm: <WarningOutlined />,
  needs_reapproval: <WarningOutlined />,
};

const hm = (iso: string, withSec = false) => dayjs(iso).tz(TZ).format(withSec ? 'HH:mm:ss' : 'HH:mm');

interface Props {
  item: OutboxItem;
  /** Signed-in user id (token name without a user): only the approver sees "Gửi ngay" (SZ-28 e). */
  me?: string;
  nickLabel?: string;
  /** Hide "Mở hội thoại" (drawer opened from that conversation). */
  inThread?: boolean;
}

/** One command of MH-SZ-13 (#4–#8a). */
export default function OutboxCard({ item, me, nickLabel, inThread }: Props) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const actions = useOutboxActions();
  const health = useAccountHealth(item.uid);
  const nickDown = health?.level === 'red' || health?.level === 'unsafe';
  const err = describeSendError(item.error);
  const attention = item.status === 'failed' || item.status === 'expired' || item.status === 'awaiting_confirm' || item.status === 'needs_reapproval';
  // "Duyệt lại" / "Bỏ lệnh" of a `Cần duyệt lại` item: nick holder or active cover only (PQ-51).
  const perms = usePermissions();
  const holdsNick = !!perms.me?.legacy || !!perms.me?.heldChannels.includes(item.uid);
  const staleSending = item.status === 'sending' && Date.now() - Date.parse(item.statusAt ?? item.createdAt) > OUTBOX_STALE_SENDING_MS;
  const canRetry = (item.status === 'failed' && err.canRetry) || item.status === 'expired' || staleSending;
  const canCancel = ['approved', 'failed', 'expired', 'awaiting_confirm'].includes(item.status) || (item.status === 'needs_reapproval' && holdsNick);
  const fail = (what: string) => (e: unknown) => message.error(`${what}: ${(e as Error).message}`);

  const onCopy = async () => {
    if (!(await copyText(item.text))) return message.error('Trình duyệt không cho sao chép; hãy chép tay nội dung rồi Bỏ lệnh');
    actions.cancel.mutate({ id: item.id, copied: true }, { onSuccess: () => message.success(COPIED_TOAST), onError: fail('Không bỏ được lệnh') });
  };

  return (
    <div className={`outbox-card${attention ? ' outbox-card--attention' : ''}`}>
      <div className="outbox-card__head">
        <span className={`outbox-card__status outbox-card__status--${item.status}`}>
          {ICON[item.status]} {OUTBOX_STATUS_LABELS[item.status]}
          {item.status === 'needs_reapproval' && item.holdReason ? ` (${OUTBOX_HOLD_REASON_LABELS[item.holdReason]})` : ''}
        </span>
        <span>· {hm(item.createdAt)}</span>
        <span>· {item.name || item.threadId}</span>
        {nickLabel && <span>· {/^nick\b/i.test(nickLabel) ? nickLabel : `nick ${nickLabel}`}</span>}
        {item.status === 'approved' && nickDown && <Tag>chờ nick kết nối</Tag>}
      </div>
      <div className="outbox-card__text">{item.text}</div>
      {item.status === 'failed' && (
        <div className="outbox-card__error">
          {err.sentence}{' '}
          {err.detail && (
            <Tooltip title={err.detail}>
              <Typography.Link>Chi tiết ▸</Typography.Link>
            </Tooltip>
          )}
        </div>
      )}
      {item.status === 'awaiting_confirm' && item.phoneDuplicate && (
        <div className="outbox-card__dup">
          Có thể trùng với tin bạn đã gửi từ điện thoại lúc {hm(item.phoneDuplicate.at)}: “{item.phoneDuplicate.preview}”
        </div>
      )}
      <div className="outbox-card__meta">
        {item.sendSource && item.onBehalfOfName ? `${onBehalfLabel(item.sendSource, item.approvedByName ?? item.approvedBy, item.onBehalfOfName)} · ` : ''}
        Duyệt bởi {item.approvedByName ?? item.approvedBy} lúc {hm(item.approvedAt, true)}
        {item.attempts ? ` · thử ${item.attempts} lần` : ''}
        {attention ? ` · Treo ${hangingMinutes(item)} phút` : ''}
      </div>
      <Space size={6} wrap className="outbox-card__actions">
        {!inThread && !isFriendCommand(item.action) && (
          <Button size="small" onClick={() => navigate(`/conversations/${encodeURIComponent(`${item.uid}:${item.threadId}`)}`)}>
            Mở hội thoại
          </Button>
        )}
        {item.status === 'approved' && nickDown && (
          <Button size="small" onClick={() => void onCopy()} loading={actions.cancel.isPending}>
            Sao chép và bỏ lệnh
          </Button>
        )}
        {canCancel ? (
          <Popconfirm
            title="Bỏ lệnh này? Tin sẽ không được gửi."
            okText="Bỏ lệnh"
            cancelText="Không"
            okButtonProps={{ danger: true }}
            onConfirm={() => actions.cancel.mutate({ id: item.id }, { onSuccess: () => message.success(CANCELLED_TOAST), onError: fail('Không bỏ được lệnh') })}
          >
            <Button size="small" danger>
              Bỏ lệnh
            </Button>
          </Popconfirm>
        ) : (
          item.status === 'sending' && (
            <Tooltip title={BUSY_TOOLTIP}>
              <Button size="small" danger disabled>
                Bỏ lệnh
              </Button>
            </Tooltip>
          )
        )}
        {canRetry && (
          <Button
            size="small"
            type="primary"
            loading={actions.retry.isPending && actions.retry.variables === item.id}
            onClick={() => actions.retry.mutate(item.id, { onSuccess: () => message.success(RETRIED_TOAST), onError: fail('Không thử lại được') })}
          >
            Thử lại
          </Button>
        )}
        {item.status === 'needs_reapproval' && holdsNick && (
          <Popconfirm
            title="Duyệt lại lệnh này? Bạn là người duyệt mới, tin sẽ được gửi từ nick."
            okText="Duyệt lại"
            cancelText="Không"
            onConfirm={() => actions.reapprove.mutate(item.id, { onSuccess: () => message.success('Đã duyệt lại, lệnh vào hàng gửi.'), onError: fail('Không duyệt lại được') })}
          >
            <Button size="small" type="primary" loading={actions.reapprove.isPending && actions.reapprove.variables === item.id}>
              Duyệt lại
            </Button>
          </Popconfirm>
        )}
        {item.status === 'awaiting_confirm' && me === item.approvedBy && (
          <Button
            size="small"
            type="primary"
            loading={actions.confirm.isPending && actions.confirm.variables === item.id}
            onClick={() => actions.confirm.mutate(item.id, { onSuccess: () => message.success(RETRIED_TOAST), onError: fail('Không gửi được') })}
          >
            Gửi ngay
          </Button>
        )}
      </Space>
    </div>
  );
}
