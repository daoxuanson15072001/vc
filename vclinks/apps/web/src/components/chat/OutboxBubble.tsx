import { Button, Popconfirm, Tooltip } from 'antd';
import { CheckOutlined, ClockCircleOutlined, ExclamationCircleOutlined, LoadingOutlined, StopOutlined, WarningOutlined } from '@ant-design/icons';
import { OUTBOX_HOLD_REASON_LABELS, onBehalfLabel } from '@vclinks/shared';
import type { OutboxItem } from '../../types';
import { bubbleTime, fullTime } from '../../utils/time';
import { QuoteBlock } from './MessageBubble';
import { describeSendError } from '../../utils/send-errors';

interface Props {
  item: OutboxItem;
  onRetry: (id: string) => void;
  retrying: boolean;
  /** "Hủy gửi" / "Bỏ lệnh" (same action, 00 MH-UI-07, MH-SZ-13 #7). */
  onCancel?: (id: string) => void;
  /** "Sao chép và bỏ lệnh", only offered while the nick is red (SZ-28 a). */
  onCopyCancel?: (item: OutboxItem) => void;
  /** "Gửi ngay": set only when the viewer is the approver (SZ-28 e). */
  onConfirm?: (id: string) => void;
  /** "Duyệt lại" of a `Cần duyệt lại` item: set only for the nick holder / cover (PQ-51). */
  onReapprove?: (id: string) => void;
  /** Nick label for the reconnect strip. */
  nickLabel?: string;
  conversationName?: string;
  /** Items of this thread waiting for confirmation, for "Còn {n} tin chờ gửi". */
  awaitingCount?: number;
  /** The replied-to message, when the item is a reply. */
  quote?: { senderName: string; text: string } | null;
  /** "Gửi không trích dẫn" for a reply whose quoted message Zalo Web could not reach (03 §8 D33). */
  onSendWithoutQuote?: (item: OutboxItem) => void;
}

const linkStyle = { padding: 0, height: 'auto', fontSize: 11 } as const;

/** Outgoing bubble for a message queued in the outbox, with its delivery status (03 MH-SZ-03 #38, #38b). */
export default function OutboxBubble({ item, onRetry, retrying, onCancel, onCopyCancel, onConfirm, onReapprove, nickLabel, conversationName, awaitingCount, quote, onSendWithoutQuote }: Props) {
  const failed = item.status === 'failed' || item.status === 'expired';
  const err = describeSendError(item.error);
  const cancelLink = onCancel && (
    <Popconfirm title="Bỏ lệnh này? Tin sẽ không được gửi." okText="Bỏ lệnh" cancelText="Không" okButtonProps={{ danger: true }} onConfirm={() => onCancel(item.id)}>
      <Button type="link" size="small" style={linkStyle}>
        {item.status === 'approved' ? 'Hủy gửi' : 'Bỏ lệnh'}
      </Button>
    </Popconfirm>
  );
  const retryLink = (
    <Button type="link" size="small" danger style={linkStyle} loading={retrying} onClick={() => onRetry(item.id)}>
      Thử lại
    </Button>
  );

  let status;
  switch (item.status) {
    case 'sending':
      status = (
        <>
          <LoadingOutlined /> Đang gửi
        </>
      );
      break;
    case 'sent':
      status = (
        <>
          <CheckOutlined /> Đã gửi
        </>
      );
      break;
    case 'failed':
      status = (
        <span className="bubble__status--failed">
          <Tooltip
            title={
              <>
                <div>{err.sentence}</div>
                <div>{err.hint}</div>
                {err.detail && <div style={{ opacity: 0.7, marginTop: 4 }}>Chi tiết: {err.detail}</div>}
              </>
            }
          >
            <ExclamationCircleOutlined /> Gửi lỗi
          </Tooltip>
          {err.canRetry && <> · {retryLink}</>}
          {err.sendWithoutQuote && onSendWithoutQuote && (
            <>
              {' · '}
              <Button type="link" size="small" danger style={linkStyle} onClick={() => onSendWithoutQuote(item)}>
                Gửi không trích dẫn
              </Button>
            </>
          )}
          {cancelLink && <> · {cancelLink}</>}
        </span>
      );
      break;
    case 'expired':
      status = (
        <span className="bubble__status--failed">
          <Tooltip title="Lệnh chờ quá 30 phút nên không tự gửi nữa, tránh gửi câu đã cũ. Bấm Thử lại để duyệt lại.">
            <StopOutlined /> Quá hạn — chưa gửi
          </Tooltip>
          {' · '}
          {retryLink}
          {cancelLink && <> · {cancelLink}</>}
        </span>
      );
      break;
    case 'needs_reapproval':
      // No "Thử lại" here (D40): only the nick holder / cover re-approves or drops it.
      status = (
        <span className="bubble__status--failed">
          <WarningOutlined /> Cần duyệt lại{item.holdReason ? ` (${OUTBOX_HOLD_REASON_LABELS[item.holdReason]})` : ''}
          {onReapprove && (
            <>
              {' · '}
              <Button type="link" size="small" style={linkStyle} onClick={() => onReapprove(item.id)}>
                Duyệt lại
              </Button>
              {cancelLink && <> · {cancelLink}</>}
            </>
          )}
        </span>
      );
      break;
    case 'awaiting_confirm':
      status = (
        <span className="bubble__status--failed">
          <WarningOutlined /> Chờ xác nhận gửi
        </span>
      );
      break;
    default:
      status = (
        <>
          <ClockCircleOutlined /> Đang chờ gửi
          {cancelLink && <> · {cancelLink}</>}
          {onCopyCancel && (
            <>
              {' · '}
              <Button type="link" size="small" style={linkStyle} onClick={() => onCopyCancel(item)}>
                Sao chép và bỏ lệnh
              </Button>
            </>
          )}
        </>
      );
  }

  return (
    <div className="msg-row own first">
      <div className="msg-col">
        <div className={`bubble own${failed ? ' failed' : ''}`}>
          {quote && <QuoteBlock quote={quote} />}
          {item.sendSource && item.onBehalfOfName && (
            <div className="bubble__onbehalf" style={{ fontSize: 11, opacity: 0.75 }}>
              {onBehalfLabel(item.sendSource, item.approvedByName ?? item.approvedBy, item.onBehalfOfName)}
            </div>
          )}
          <div className="bubble__text">{item.text}</div>
          <div className="bubble__meta" title={fullTime(item.sentAt ?? item.createdAt)}>
            <span>{bubbleTime(item.sentAt ?? item.createdAt)}</span>
            <span>·</span>
            {status}
          </div>
          {item.status === 'awaiting_confirm' && onConfirm && (
            <div className="bubble__confirm">
              <div>
                {/^nick\b/i.test(nickLabel ?? '') ? nickLabel : `Nick ${nickLabel || 'này'}`} đã kết nối lại. Còn {awaitingCount ?? 1} tin chờ gửi cho {conversationName || 'hội thoại này'}.
              </div>
              {item.phoneDuplicate && (
                <div className="bubble__dup">
                  Có thể trùng với tin bạn đã gửi từ điện thoại lúc {bubbleTime(item.phoneDuplicate.at)}: “{item.phoneDuplicate.preview}”
                </div>
              )}
              <div className="bubble__confirm-actions">
                <Button size="small" type="primary" onClick={() => onConfirm(item.id)}>
                  Gửi ngay
                </Button>
                {/* With a possible duplicate the safe choice is focused (SZ-28 d). */}
                <Button size="small" danger autoFocus={!!item.phoneDuplicate} onClick={() => onCancel?.(item.id)}>
                  Bỏ lệnh
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
