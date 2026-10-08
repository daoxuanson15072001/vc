import MaskedText from '../contacts/MaskedText';
import type { ReactNode } from 'react';
import { Button, Collapse, Popover, Tooltip } from 'antd';
import { MobileOutlined, RollbackOutlined, SmileOutlined } from '@ant-design/icons';
import { RECALL_PLACEHOLDER_TEXT, type QuoteView, REACTION_EMOJI, ZALO_MSG_STATUS_TEXT } from '@vclinks/shared';
import type { ChatMessage } from '../../types';
import { splitLinks } from '../../utils/chat';
import { bubbleTime, fullTime } from '../../utils/time';
import ChatAvatar from './ChatAvatar';
import { usePermissions } from '../../state/permissions';
import { CallView, LocationView, ReminderView } from './L5Views';
import { useQueryClient } from '@tanstack/react-query';
import { VOICE_TEXT_PREFIX } from '@vclinks/shared';
import { ContactCard, FileCards, ImageGrid, LinkList, MediaImageGrid, StoredImageGrid, VideoView, VoiceView, fileMediaKind } from './MediaViews';

const KIND_LABEL: Record<string, string> = {
  sticker: 'Sticker',
  gif: 'Ảnh GIF',
  image: 'Hình ảnh',
  photo: 'Hình ảnh',
  video: 'Video',
  voice: 'Ghi âm',
  audio: 'Ghi âm',
  file: 'Tệp',
  link: 'Liên kết',
  card: 'Danh thiếp',
  reminder: 'Nhắc hẹn',
  contact: 'Danh thiếp',
  location: 'Vị trí',
  poll: 'Bình chọn',
  call: 'Cuộc gọi',
  recall: 'Tin nhắn đã thu hồi',
  undo: 'Tin nhắn đã thu hồi',
  system: 'Thông báo',
};

function preview(v: unknown): string {
  try {
    const s = JSON.stringify(v, null, 2) ?? String(v);
    return s.length > 4000 ? `${s.slice(0, 4000)}\n…` : s;
  } catch {
    return String(v);
  }
}

/** Message text with http(s) URLs as links (see splitLinks). */
function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((p, i) =>
        p.url ? (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer nofollow">
            {p.text}
          </a>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

function hasMedia(m: ChatMessage): boolean {
  return !!(
    m.images?.length ||
    m.mediaImages?.length ||
    m.links?.length ||
    m.files?.length ||
    m.voice ||
    m.video ||
    m.card ||
    m.location ||
    m.call ||
    m.reminder
  );
}

/** Quoted message shown at the top of a reply (like Zalo). Clicking jumps to it. */
export function QuoteBlock({ quote, onClick }: { quote: Pick<QuoteView, 'senderName' | 'text'>; onClick?: () => void }) {
  return (
    <div
      className={`bubble__quote${onClick ? ' clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      title={onClick ? 'Xem tin được trả lời' : undefined}
    >
      <div className="bubble__quote-name">{quote.senderName || 'Tin nhắn'}</div>
      <div className="bubble__quote-text">{quote.text || '[Nội dung chưa có]'}</div>
    </div>
  );
}

/** Zalo's picker order: 👍 ❤️ 😆 😮 😢 😡 (icon ids). */
const REACTION_ORDER = ['3', '0', '5', '32', '2', '20'];

/**
 * Zalo's own-message delivery texts, by `message.status`. In IndexedDB the newest
 * own message carries 1 and older ones move to 2 and then 3 as members receive
 * and open them (observed 29/09/2026 in the test group), i.e. 1 = gửi, 2 = nhận,
 * 3 = xem. Shown under the newest own message only, like Zalo Web.
 */
const STATUS_TEXT = ZALO_MSG_STATUS_TEXT;

/** Group system events (`message.act`) → the line Zalo shows between bubbles. */
const SYSTEM_EVENT_TEXT: Record<string, string> = {
  join: 'đã tham gia nhóm',
  add: 'đã được thêm vào nhóm',
  add_member: 'đã được thêm vào nhóm',
  leave: 'đã rời nhóm',
  remove: 'đã bị mời khỏi nhóm',
  remove_member: 'đã bị mời khỏi nhóm',
  update_name: 'đã đổi tên nhóm',
  rename: 'đã đổi tên nhóm',
  update_avatar: 'đã đổi ảnh nhóm',
  update_desc: 'đã đổi mô tả nhóm',
  new_link: 'đã tạo link tham gia nhóm',
  pin: 'đã ghim tin nhắn',
  unpin: 'đã bỏ ghim tin nhắn',
  add_admin: 'đã được bổ nhiệm làm phó nhóm',
  remove_admin: 'không còn là phó nhóm',
};

function systemEventText(ev: NonNullable<ChatMessage['systemEvent']>, actor: string): string {
  const what = SYSTEM_EVENT_TEXT[ev.act] ?? SYSTEM_EVENT_TEXT[ev.act.toLowerCase()];
  if (what) return `${actor} ${what}${ev.memberIds?.length ? ` (${ev.memberIds.length} thành viên)` : ''}`;
  return `Thông báo nhóm: ${ev.act}`;
}

function ttlText(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} phút`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ`;
  return `${Math.round(s / 86400)} ngày`;
}

/** Text with Zalo @mentions highlighted (offsets from `message.mentions`; a slice that is not an "@…" is left alone). */
function MentionedText({ text, mentions }: { text: string; mentions: NonNullable<ChatMessage['mentions']> }) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const m of [...mentions].sort((a, b) => a.pos - b.pos)) {
    if (m.pos < at || m.pos + m.len > text.length) continue;
    const slice = text.slice(m.pos, m.pos + m.len);
    if (!slice.startsWith('@')) continue;
    if (m.pos > at) parts.push(<LinkedText key={`t${at}`} text={text.slice(at, m.pos)} />);
    parts.push(
      <span key={`m${m.pos}`} className="mention" data-uid={m.uid}>
        {slice}
      </span>,
    );
    at = m.pos + m.len;
  }
  if (at < text.length) parts.push(<LinkedText key={`t${at}`} text={text.slice(at)} />);
  return <>{parts}</>;
}

interface Props {
  m: ChatMessage;
  own: boolean;
  isGroup: boolean;
  firstInRun: boolean;
  lastInRun: boolean;
  /** Avatar for 1-1 threads (the other party); groups fall back to sender initials. */
  peerAvatar?: string | null;
  peerName?: string | null;
  /** Shows the hover "Trả lời" action. */
  onReply?: (m: ChatMessage) => void;
  /** Newest own message: show Zalo's delivery state ("Đã gửi") under it, like Zalo Web. */
  showStatus?: boolean;
  /** Shows the hover reaction picker (Zalo's six icons); `icon` is Zalo's icon id. */
  onReact?: (m: ChatMessage, icon: string) => void;
  /** Makes the sender name/avatar open the sender's details. */
  onSenderClick?: (m: ChatMessage, name: string) => void;
  onQuoteClick?: (m: ChatMessage) => void;
}

export default function MessageBubble({
  m,
  own,
  isGroup,
  firstInRun,
  lastInRun,
  peerAvatar,
  peerName,
  onReply,
  onSenderClick,
  onQuoteClick,
  showStatus,
  onReact,
}: Props) {
  // "Xem nội dung gốc" is a technical view: not for a sales rep (03 §8 D17).
  const { technical } = usePermissions();
  const qc = useQueryClient();
  const onTranscriptRetried = () => void qc.invalidateQueries({ queryKey: ['messages'] });
  // Group system event: a centred line instead of a bubble.
  if (m.systemEvent) {
    const actor = m.systemEvent.actorId === '0' || m.systemEvent.actorId === m.fromUid && own ? 'Bạn' : m.senderName || peerName || m.systemEvent.actorId || 'Một thành viên';
    return (
      <div className="msg-system" data-msgid={m.msgId} title={fullTime(m.sentAt)}>
        {systemEventText(m.systemEvent, actor)}
      </div>
    );
  }
  const hasText = typeof m.text === 'string' && m.text.length > 0;
  // Stored photos replace the expiring Zalo links; a transcribed voice note shows its text in the player box.
  const storedImages = (m.attachments ?? []).filter((a) => a.kind === 'image' && a.status === 'stored' && a.id.includes('#image:') && !a.id.includes('#image:m'));
  const voiceTextInPlayer = !!m.voice && !!m.attachments?.some((a) => a.kind === 'audio' && a.status === 'stored') && hasText && (m.text as string).startsWith(VOICE_TEXT_PREFIX);
  const media = hasMedia(m);
  const waiting = !hasText && !media && (m.encrypted || m.contentStatus === 'pending');
  // Photos and videos without words sit almost edge to edge in the bubble, like Zalo and Messenger show them.
  // A sticker shows as itself, without a bubble around it (like Zalo).
  const sticker = !hasText && !waiting && (m.kind === 'sticker' || m.msgType === 'chat.sticker') && (!!m.images?.length || !!m.mediaImages?.length);
  const mediaOnly =
    !hasText &&
    !waiting &&
    !m.quote &&
    (!!m.images?.length ||
      !!m.mediaImages?.length ||
      !!m.video ||
      (!!m.files?.length && m.files.every((f) => ['image', 'video'].includes(fileMediaKind(f)))));
  const senderName = m.senderName || (isGroup ? m.fromUid : peerName) || m.fromUid;
  // Content captured before the recall is kept (owner decision 2026-09-28) and flagged.
  const keptAfterRecall = !!m.recalled && (media || (hasText && m.text !== RECALL_PLACEHOLDER_TEXT));

  let body: ReactNode;
  if (waiting) {
    body = m.contentGone ? (
      <div className="bubble__text" style={{ color: 'var(--muted)', fontStyle: 'italic' }} title="Nick đã chuyển sang kết nối trực tiếp trước khi Zalo Web đọc được nội dung tin này">
        Nội dung cũ, chưa lấy được trước khi chuyển sang kết nối trực tiếp
      </div>
    ) : (
      <div className="bubble__text">Đang chờ nội dung từ Zalo</div>
    );
  } else if (hasText || media) {
    body = (
      <>
        {m.images?.length ? (
          storedImages.length === m.images.length ? <StoredImageGrid ids={storedImages.map((a) => a.id)} /> : <ImageGrid images={m.images} />
        ) : null}
        {m.mediaImages?.length ? <MediaImageGrid ids={m.mediaImages} /> : null}
        {m.video ? <VideoView video={m.video} attachment={m.attachments?.find((a) => a.kind === 'video')} /> : null}
        {m.voice ? <VoiceView voice={m.voice} attachment={m.attachments?.find((a) => a.kind === 'audio')} onRetried={onTranscriptRetried} /> : null}
        {m.files?.length ? <FileCards files={m.files} attachments={m.attachments} /> : null}
        {m.card ? <ContactCard card={m.card} /> : null}
        {m.location ? <LocationView location={m.location} /> : null}
        {m.call ? <CallView call={m.call} /> : null}
        {m.reminder ? <ReminderView reminder={m.reminder} /> : null}
        {hasText && !voiceTextInPlayer && (
          <div className="bubble__text">
            {m.textMasked ? (
              <MaskedText text={m.text as string} count={m.textMasked} messageId={m.id} revealable={!!m.textRevealable} where="chat" />
            ) : m.mentions?.length ? <MentionedText text={m.text as string} mentions={m.mentions} /> : <LinkedText text={m.text as string} />}
          </div>
        )}
        {m.links?.length ? <LinkList links={m.links} /> : null}
      </>
    );
  } else {
    const kind = m.kind || m.msgType || '';
    const label = KIND_LABEL[kind.toLowerCase()] ?? KIND_LABEL[kind.replace(/^chat\./, '').toLowerCase()];
    body = (
      <>
        <div className="bubble__text" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
          [{label ?? (kind || 'Tin nhắn không rõ loại')}]
        </div>
        {technical && m.content !== undefined && m.content !== null && (
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: 'c',
                label: 'Xem nội dung gốc',
                children: (
                  <pre style={{ margin: 0, fontSize: 11, maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                    {preview(m.content)}
                  </pre>
                ),
              },
            ]}
          />
        )}
      </>
    );
  }

  const time = bubbleTime(m.sentAt);
  const statusText = own && showStatus && typeof m.status === 'number' ? (STATUS_TEXT[m.status] ?? (m.status > 3 ? 'Đã xem' : undefined)) : undefined;
  const bubble = (
    <div className={`bubble${own ? ' own' : ''}${waiting ? ' pending' : ''}${sticker ? ' bubble--sticker' : mediaOnly ? ' bubble--media' : ''}`}>
      {m.forwarded && <div className="bubble__hint bubble__forwarded">Đã chuyển tiếp</div>}
      {m.quote && <QuoteBlock quote={m.quote} onClick={onQuoteClick ? () => onQuoteClick(m) : undefined} />}
      {body}
      {m.contentStatus === 'partial' && !waiting && <div className="bubble__hint">Nội dung có thể chưa đầy đủ</div>}
      {keptAfterRecall && <div className="bubble__hint">Đã thu hồi trên Zalo · VClinks giữ bản đã lưu</div>}
      {m.ttl ? <div className="bubble__hint">Tin nhắn tự xóa sau {ttlText(m.ttl)}</div> : null}
      {(lastInRun || statusText) && (
        <div className="bubble__meta">
          {time}
          {statusText && <span className="bubble__status">· {statusText}</span>}
          {own && m.fromPhone && (
            <Tooltip title="Tin gửi từ app trên điện thoại hoặc máy khác của nick, đã đồng bộ về VClinks">
              <span className="bubble__status bubble__from-phone">
                · <MobileOutlined /> Gửi từ điện thoại
              </span>
            </Tooltip>
          )}
        </div>
      )}
      {m.reactions?.total ? (
        <div className={`bubble__reactions${m.reactions.mine ? ' mine' : ''}`} title={`${m.reactions.total} cảm xúc`}>
          {m.reactions.icons.slice(0, 3).map((r) => (
            <span key={r.icon} className="bubble__reaction">
              {r.emoji}
            </span>
          ))}
          <span className="bubble__reaction-count">{m.reactions.total}</span>
        </div>
      ) : null}
    </div>
  );

  const openSender = !own && onSenderClick ? () => onSenderClick(m, senderName) : undefined;
  const avatar = firstInRun && (
    <ChatAvatar
      size={36}
      name={isGroup ? senderName : peerName ?? senderName}
      src={isGroup ? null : peerAvatar}
      colorKey={m.fromUid}
    />
  );

  return (
    <div className={`msg-row${own ? ' own' : ''}${firstInRun ? ' first' : ''}`} data-msgid={m.msgId}>
      {!own && (
        <div className="msg-avatar-slot">
          {avatar && openSender ? (
            <button type="button" className="msg-sender-btn" onClick={openSender} aria-label={`Thông tin ${senderName}`}>
              {avatar}
            </button>
          ) : (
            avatar
          )}
        </div>
      )}
      <div className="msg-col">
        {!own && isGroup && firstInRun &&
          (openSender ? (
            <button type="button" className="msg-sender msg-sender-btn link" onClick={openSender} title="Xem thông tin người gửi">
              {senderName}
            </button>
          ) : (
            <div className="msg-sender">{senderName}</div>
          ))}
        <div className="msg-line">
          {lastInRun ? (
            bubble
          ) : (
            <Tooltip title={fullTime(m.sentAt)} placement={own ? 'left' : 'right'} mouseEnterDelay={0.6}>
              {bubble}
            </Tooltip>
          )}
          {(onReply || onReact) && (
            <div className="msg-actions">
              {onReact && (
                <Popover
                  trigger="hover"
                  placement="top"
                  content={
                    <div className="reaction-picker" role="menu" aria-label="Thả cảm xúc">
                      {REACTION_ORDER.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          className={`reaction-picker__icon${m.reactions?.mine === icon ? ' mine' : ''}`}
                          onClick={() => onReact(m, icon)}
                          aria-label={`Thả ${REACTION_EMOJI[icon]}`}
                        >
                          {REACTION_EMOJI[icon]}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <Button size="small" shape="circle" icon={<SmileOutlined />} aria-label="Thả cảm xúc" />
                </Popover>
              )}
              {onReply && (
                <Tooltip title="Trả lời">
                  <Button size="small" shape="circle" icon={<RollbackOutlined />} onClick={() => onReply(m)} aria-label="Trả lời tin này" />
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
