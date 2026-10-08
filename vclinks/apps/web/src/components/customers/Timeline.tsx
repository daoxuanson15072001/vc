import { useMemo, useState } from 'react';
import { Button, Collapse, Divider, Empty, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { TimelineEvent } from '@vclinks/shared';
import { afterText, bandRange, buildTimeline, type TimelineRow } from '../../utils/timeline';
import { bubbleTime, fullTime } from '../../utils/time';
import MaskedText from '../contacts/MaskedText';
import ChannelChip from './ChannelChip';

const OP_TEXT: Record<string, string> = {
  auto_merge: 'Hệ thống tự gộp danh tính vào hồ sơ này',
  merge: 'Gộp hồ sơ',
  undo: 'Hoàn tác một lần gộp',
  erp_link: 'Liên kết mã KH VCsales',
  import: 'Nạp từ danh mục VCsales',
};

/** Text of one message line: content, or what kind of message it is (media is shown as a label, not fetched here). */
function messageText(e: TimelineEvent): string {
  if (e.recalled) return 'Tin nhắn đã thu hồi';
  if (e.text) return e.text;
  const kind = e.msgType ?? '';
  if (/image|photo/i.test(kind)) return '[Ảnh]';
  if (/voice|audio/i.test(kind)) return '[Ghi âm]';
  if (/file/i.test(kind)) return '[Tệp]';
  return '[Tin không có chữ]';
}

function MessageLine({ e, onOpen }: { e: TimelineEvent; onOpen: (e: TimelineEvent) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <Tooltip title={fullTime(e.at)}>
        <Typography.Text type="secondary" style={{ minWidth: 40 }}>
          {bubbleTime(e.at)}
        </Typography.Text>
      </Tooltip>
      {e.channel && <ChannelChip channel={e.channel} nickLabel={e.nickLabel} ownerName={e.nickOwnerName} />}
      <Typography.Text strong>{e.direction === 'out' ? (e.senderName ?? 'Nhân viên') : (e.contactName ?? 'Khách')}</Typography.Text>
      <span style={{ cursor: e.conversationId ? 'pointer' : undefined, color: e.recalled ? 'var(--muted)' : undefined, fontStyle: e.recalled ? 'italic' : undefined }} onClick={() => onOpen(e)}>
        {e.direction === 'out' ? '→ ' : ''}
        {e.textMasked && e.text && !e.recalled ? <MaskedText text={e.text} count={e.textMasked} messageId={e.id} revealable={!!e.textRevealable} where="timeline" /> : messageText(e)}
      </span>
    </div>
  );
}

/**
 * Merged timeline (02 MH-DK-03): the rows come from `buildTimeline` (day headings, multi-channel bands, clusters of
 * ≤ 10 minutes, channel switches). Messages of conversations the viewer may not read arrive as `hidden` rows with a
 * count: "3 tin · bạn không có quyền xem nội dung" (DK-40). Clicking a message opens its conversation.
 */
export default function Timeline({ events, nextLabel }: { events: TimelineEvent[]; nextLabel?: string }) {
  const navigate = useNavigate();
  const rows = useMemo(() => buildTimeline(events), [events]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const openConv = (e: TimelineEvent) => e.conversationId && navigate(`/conversations/${encodeURIComponent(e.conversationId)}`);
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={nextLabel ?? 'Không có sự kiện nào khớp bộ lọc.'} />;

  const render = (r: TimelineRow) => {
    switch (r.type) {
      case 'day':
        return (
          <Divider key={r.key} orientation="left" style={{ margin: '12px 0 8px' }}>
            {r.label}
          </Divider>
        );
      case 'band':
        return (
          <div key={r.key} style={{ background: 'var(--ant-color-primary-bg, #f0f5ff)', padding: '4px 10px', borderRadius: 4, margin: '6px 0' }}>
            Khách dùng {r.channels} kênh trong 1 giờ ({bandRange(r)})
          </div>
        );
      case 'switch':
        return (
          <Divider key={r.key} dashed style={{ margin: '6px 0', fontSize: 12 }}>
            <Typography.Text type="secondary">
              Chuyển sang {r.to.channel ? <ChannelChip channel={r.to.channel} nickLabel={r.to.nickLabel} ownerName={r.to.nickOwnerName} /> : 'kênh khác'} · {afterText(r.afterMs)}
            </Typography.Text>
          </Divider>
        );
      case 'cluster': {
        const expanded = !!open[r.key];
        const list = expanded ? r.events : r.shown;
        return (
          <div key={r.key} style={{ padding: '4px 0', borderLeft: '2px solid var(--ant-color-border, #d9d9d9)', paddingLeft: 8 }}>
            {list.map((e) => (
              <MessageLine key={e.id} e={e} onOpen={openConv} />
            ))}
            {r.more > 0 && (
              <Collapse
                ghost
                size="small"
                activeKey={expanded ? ['x'] : []}
                onChange={() => setOpen((o) => ({ ...o, [r.key]: !o[r.key] }))}
                items={[{ key: 'x', label: <Typography.Text type="secondary">{expanded ? 'Thu gọn' : `Xem thêm ${r.more} tin`} (cụm {r.events.length} tin, {bubbleTime(r.from)}–{bubbleTime(r.to)})</Typography.Text>, children: null, showArrow: false }]}
              />
            )}
          </div>
        );
      }
      case 'event': {
        const e = r.event;
        if (e.kind === 'hidden') {
          return (
            <div key={r.key} style={{ padding: '4px 0', display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <Typography.Text type="secondary" style={{ minWidth: 40 }}>{bubbleTime(e.at)}</Typography.Text>
              {e.channel && <ChannelChip channel={e.channel} nickLabel={e.nickLabel} ownerName={e.nickOwnerName} />}
              <Typography.Text type="secondary">{e.hiddenCount} tin · bạn không có quyền xem nội dung</Typography.Text>
            </div>
          );
        }
        if (e.kind === 'quote') {
          return (
            <div key={r.key} style={{ padding: '4px 0', display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Typography.Text type="secondary" style={{ minWidth: 40 }}>{bubbleTime(e.at)}</Typography.Text>
              {e.channel && <ChannelChip channel={e.channel} nickLabel={e.nickLabel} ownerName={e.nickOwnerName} />}
              <Tag color="blue">Báo giá</Tag>
              <span>{e.text}{e.senderName ? ` · ${e.senderName}` : ''}</span>
            </div>
          );
        }
        if (e.kind === 'profile') {
          return (
            <div key={r.key} style={{ padding: '4px 0', display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <Typography.Text type="secondary" style={{ minWidth: 40 }}>{bubbleTime(e.at)}</Typography.Text>
              <Tag>Hồ sơ</Tag>
              <span>{OP_TEXT[e.op ?? ''] ?? 'Thay đổi hồ sơ'}</span>
            </div>
          );
        }
        return (
          <div key={r.key} style={{ padding: '4px 0' }}>
            <MessageLine e={e} onOpen={openConv} />
          </div>
        );
      }
    }
  };
  return <div>{rows.map(render)}</div>;
}

export function LoadMore({ hasMore, loading, onMore }: { hasMore: boolean; loading: boolean; onMore: () => void }) {
  if (!hasMore) return null;
  return (
    <div style={{ textAlign: 'center', marginTop: 12 }}>
      <Button loading={loading} onClick={onMore}>
        Tải thêm
      </Button>
    </div>
  );
}
