import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { App, Button, Input, Popconfirm, Tooltip } from 'antd';
import { CheckCircleFilled, CloseOutlined, RollbackOutlined, SendOutlined, WarningFilled } from '@ant-design/icons';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { CHANNEL_INFO, OUTBOX_MAX_TEXT, filterQuickReplies, matchShortcut, renderQuickReply, type Channel, type QuickReply } from '@vclinks/shared';
import { COMPOSER_INSERT_EVENT } from './composerBus';
import { mentionsInText } from './commands';
import { useQuickReplies } from './quick-replies';
import { loadDraft, saveDraft } from '../../utils/drafts';

const CONFIRMED_KEY = 'vclinks.composer.confirmed';
/** Same limit as the API (00 MH-UI-08 #6, 03 D42). */
const MAX_LEN = OUTBOX_MAX_TEXT;
/** The counter shows from this length on. */
const COUNTER_FROM = 1800;

function wasConfirmed(): boolean {
  try {
    return localStorage.getItem(CONFIRMED_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberConfirmed(): void {
  try {
    localStorage.setItem(CONFIRMED_KEY, '1');
  } catch {
    // Storage unavailable: the confirm will just show again next time.
  }
}

/** What the tool row can put into the composer at the cursor. */
export interface ComposerInsert {
  mention: (m: { name: string; uid: string }) => void;
  text: (s: string) => void;
}

interface Props {
  /** Resolves when the outbox accepted the text; rejects with an Error otherwise. */
  onSend: (text: string, mentions?: { name: string; uid?: string }[]) => Promise<unknown>;
  /** Tool row (sticker, photos, file, card, poll, @, quick replies); gets callbacks that insert at the cursor. */
  renderTools?: (insert: ComposerInsert) => ReactNode;
  sending: boolean;
  /** When set, sending is disabled and this reason is shown instead of the input. */
  disabledReason?: string | null;
  accountLabel: string;
  placeholderName: string;
  channel: Channel;
  /** Overrides how the message leaves (tooltip of the send button), e.g. a nick on the máy Zalo. */
  sendRoute?: string;
  /** Message being replied to (shown above the input); null for a plain message. */
  replyTo?: { senderName: string; text: string } | null;
  onCancelReply?: () => void;
  /**
   * Sending on someone else's nick (QT-SZ-10, MH-SZ-05 #0b): yellow strip + an always-shown confirmation
   * for "trả lời thay"; green strip for an active "trực thay".
   */
  onBehalf?: { mode: 'truc_thay' | 'tra_loi_thay'; holderName: string; nickLabel: string; until?: string | null } | null;
  /** {ten_nv} = the real sender (signed-in user), {ten_nguoi_giu_nick} = the nick holder. */
  vars?: { ten_nv?: string | null; ten_nguoi_giu_nick?: string | null };
  /** Puts `text` in the box (replacing it) each time `key` changes, e.g. "Gửi không trích dẫn". */
  prefill?: { text: string; key: number } | null;
  /** Keeps the box text as a per-conversation draft in this browser (03 D15). */
  draftKey?: string;
  /** "Nháp AI" button for the tool bar and the AI strip shown above the input (see useAiDraft). */
  aiButton?: ReactNode;
  aiPanel?: ReactNode;
}

/** `dd/MM HH:mm` (strip of an active cover). */
const shortTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** How an approved message leaves VClinks, per channel (shown under the input). */
const SEND_ROUTE: Record<Channel, string> = {
  zalo: 'qua tiện ích VClinks trên tab Zalo Web đang mở',
  fb_personal: 'qua tiện ích VClinks trên tab Messenger đang mở',
  zalo_oa: 'qua API chính thức của Zalo OA',
  fb_page: 'qua API chính thức của Fanpage (Messenger)',
};

/**
 * Zalo-like composer. The user typing and pressing send is the approval
 * (approvedBy/approvedAt are recorded by the API); the first send ever asks
 * for an explicit confirmation.
 */
export default function Composer({
  onSend,
  sending,
  disabledReason,
  accountLabel,
  placeholderName,
  channel,
  sendRoute,
  renderTools,
  replyTo,
  onCancelReply,
  onBehalf,
  vars,
  prefill,
  draftKey,
  aiButton,
  aiPanel,
}: Props) {
  const onBehalfReply = onBehalf?.mode === 'tra_loi_thay';
  const route = sendRoute ?? SEND_ROUTE[channel];
  const splitsLines = CHANNEL_INFO[channel].sendMode === 'extension';
  const { message } = App.useApp();
  const [text, setText] = useState(() => (draftKey ? loadDraft(draftKey) : ''));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [picked, setPicked] = useState<{ name: string; uid: string }[]>([]);
  const inputRef = useRef<TextAreaRef>(null);
  // `/shortcut` being typed: the token's start and the highlighted suggestion.
  const [slash, setSlash] = useState<{ start: number; query: string } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const replies = useQuickReplies(slash !== null);
  const suggestions = slash ? filterQuickReplies(replies.data ?? [], slash.query) : [];

  /** Replaces [from, to) of the text with `token`, keeps the caret after it. */
  const splice = (from: number, to: number, token: string) => {
    const el = inputRef.current?.resizableTextArea?.textArea;
    setText((t) => t.slice(0, from) + token + t.slice(to));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(from + token.length, from + token.length);
    });
  };

  const insertAtCursor = (token: string) => {
    const el = inputRef.current?.resizableTextArea?.textArea;
    const at = el?.selectionStart ?? text.length;
    splice(at, el?.selectionEnd ?? at, token);
  };

  const insertMention = (m: { name: string; uid: string }) => {
    insertAtCursor(`@${m.name} `);
    setPicked((p) => (p.some((x) => x.name === m.name) ? p : [...p, m]));
  };

  const insert: ComposerInsert = { mention: insertMention, text: insertAtCursor };

  /** Template variables: {ten_khach} = who the chat is with, {ten_nv} = the sending account. */
  const applyReply = (r: QuickReply) => {
    if (!slash) return;
    const el = inputRef.current?.resizableTextArea?.textArea;
    const caret = el?.selectionStart ?? text.length;
    setSlash(null);
    splice(
      slash.start,
      caret,
      renderQuickReply(r.text, { ten_khach: placeholderName, ten_nv: vars?.ten_nv ?? accountLabel, ten_nguoi_giu_nick: vars?.ten_nguoi_giu_nick ?? vars?.ten_nv ?? accountLabel }),
    );
  };

  const onChange = (value: string, caret: number) => {
    setText(value);
    const m = matchShortcut(value, caret);
    setSlash(m);
    if (m && (!slash || m.start !== slash.start)) setSlashIndex(0);
  };

  // Draft per conversation: saved shortly after typing stops; an empty box (after a send) removes it.
  useEffect(() => {
    if (!draftKey) return;
    const t = window.setTimeout(() => saveDraft(draftKey, text), 400);
    return () => window.clearTimeout(t);
  }, [draftKey, text]);
  // Switching conversation unmounts the box: flush what was typed in the last moments.
  const latest = useRef({ draftKey, text });
  latest.current = { draftKey, text };
  useEffect(() => () => {
    if (latest.current.draftKey) saveDraft(latest.current.draftKey, latest.current.text);
  }, []);

  // A prefill (e.g. "Gửi không trích dẫn") replaces the box and puts the cursor at the end.
  useEffect(() => {
    if (!prefill) return;
    setText(prefill.text);
    requestAnimationFrame(() => {
      const el = inputRef.current?.resizableTextArea?.textArea;
      el?.focus();
      el?.setSelectionRange(prefill.text.length, prefill.text.length);
    });
  }, [prefill?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Text pushed by a side panel ("Chèn vào tin" of Tra hàng): fills the box at the cursor, never sends.
  const insertRef = useRef(insertAtCursor);
  insertRef.current = insertAtCursor;
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<string>).detail;
      if (typeof t === 'string' && t) insertRef.current(t);
    };
    window.addEventListener(COMPOSER_INSERT_EVENT, on);
    return () => window.removeEventListener(COMPOSER_INSERT_EVENT, on);
  }, []);

  // Choosing "Trả lời" on a message puts the cursor in the box, like Zalo.
  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const trimmed = text.trim();
  const multiLine = trimmed.includes('\n');

  const doSend = async () => {
    if (!trimmed || sending) return;
    try {
      const mentions = mentionsInText(trimmed, picked);
      await onSend(trimmed, mentions.length ? mentions : undefined);
      setText('');
      setPicked([]);
      inputRef.current?.focus();
    } catch (e) {
      // `silent`: the caller already said why (e.g. the user cancelled a confirmation).
      if (!(e as { silent?: boolean }).silent) message.error((e as Error).message || 'Không gửi được tin');
    }
  };

  const submit = () => {
    if (!trimmed || sending) return;
    // Trả lời thay: always confirm, showing the exact text (QT-SZ-10 #2); never "do not ask again".
    if (onBehalfReply || !wasConfirmed()) {
      setConfirmOpen(true);
      return;
    }
    void doSend();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slash && suggestions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
        return;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        applyReply(suggestions[Math.min(slashIndex, suggestions.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }
    // Ignore Enter while an IME (Vietnamese Telex/VNI) is composing.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape' && replyTo) {
      e.preventDefault();
      onCancelReply?.();
    }
  };

  if (disabledReason) {
    return (
      <div className="composer">
        <div className="composer__disabled">{disabledReason}</div>
      </div>
    );
  }

  return (
    <div className={`composer${onBehalfReply ? ' composer--behalf' : ''}`}>
      {onBehalf && (
        // Context strip attached to the box: who the customer will see as the sender.
        <div className={`composer__context composer__context--${onBehalfReply ? 'warn' : 'ok'}`} role="note">
          {onBehalfReply ? (
            <>
              <WarningFilled aria-hidden />
              <span>
                Bạn đang <b>trả lời thay {onBehalf.holderName}</b> trên nick {onBehalf.nickLabel}. Khách thấy tin từ nick này.{' '}
                <a href="/admin/access-requests?tab=cover">Tạo trực thay cho {onBehalf.holderName}…</a>
              </span>
            </>
          ) : (
            <>
              <CheckCircleFilled aria-hidden />
              <span>{`Bạn đang trực thay ${onBehalf.holderName}${onBehalf.until ? ` tới ${shortTime(onBehalf.until)}` : ''}.`}</span>
            </>
          )}
        </div>
      )}
      {aiPanel}
      {replyTo && (
        <div className="composer__reply">
          <RollbackOutlined className="composer__reply-icon" />
          <div className="composer__reply-body">
            <div className="composer__reply-title">
              Trả lời <b>{replyTo.senderName}</b>
            </div>
            <div className="composer__reply-text">{replyTo.text}</div>
          </div>
          <Tooltip title="Hủy trả lời (Esc)">
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={onCancelReply} aria-label="Hủy trả lời" />
          </Tooltip>
        </div>
      )}
      <div className="composer__row">
        {slash && suggestions.length > 0 && (
          <div className="composer__slash" role="listbox" aria-label="Mẫu câu">
            {suggestions.map((r, i) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={i === slashIndex}
                className={`composer__slash-item${i === slashIndex ? ' active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyReply(r)}
              >
                <span className="composer__slash-key">/{r.shortcut}</span>
                <span className="composer__slash-title">{r.title}</span>
                <span className="composer__slash-text">{r.text}</span>
              </button>
            ))}
          </div>
        )}
        <Input.TextArea
          ref={inputRef}
          value={text}
          onChange={(e) => onChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onBlur={() => setSlash(null)}
          onKeyDown={onKeyDown}
          autoSize={{ minRows: 2, maxRows: 8 }}
          maxLength={MAX_LEN}
          placeholder={`Nhập tin nhắn tới ${placeholderName}`}
          aria-label="Nội dung tin nhắn"
        />
      </div>
      <div className="composer__bar">
        {renderTools?.(insert)}
        {aiButton}
        <span className="composer__note">
          Enter gửi · Shift+Enter xuống dòng · / mẫu câu
          {multiLine && splitsLines && (
            <> · Mỗi dòng thành một tin riêng{replyTo ? ', chỉ dòng đầu kèm trích dẫn' : ''}</>
          )}
          {text.length >= COUNTER_FROM && (
            <span className={`composer__counter${text.length >= MAX_LEN ? ' composer__counter--full' : ''}`}>
              {' '}
              · {text.length.toLocaleString('vi-VN')}/{MAX_LEN.toLocaleString('vi-VN')}
            </span>
          )}
        </span>
        <Popconfirm
          open={confirmOpen}
          onOpenChange={(o) => !o && setConfirmOpen(false)}
          title={onBehalfReply ? `Trả lời thay ${onBehalf!.holderName}?` : `Gửi tin qua ${CHANNEL_INFO[channel].label}?`}
          description={
            onBehalfReply ? (
              <div style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{trimmed}</div>
            ) : (
              <div style={{ maxWidth: 280 }}>
                Tin sẽ được gửi từ tài khoản <b>{accountLabel}</b>. Bấm gửi nghĩa là bạn đã duyệt nội
                dung này. Lần sau sẽ không hỏi lại.
              </div>
            )
          }
          okText={onBehalfReply ? 'Trả lời thay' : 'Gửi'}
          cancelText="Hủy"
          placement="topRight"
          onConfirm={() => {
            if (!onBehalfReply) rememberConfirmed();
            setConfirmOpen(false);
            void doSend();
          }}
          onCancel={() => setConfirmOpen(false)}
        >
          {/* Hidden while the confirmation is open: it would cover its buttons. */}
          <Tooltip title={`Gửi (Enter) · tin sẽ được gửi ${route}`} open={confirmOpen ? false : undefined}>
            {/* The button names the channel (plan §3 rule 4): the user always sees where the message goes. */}
            <Button type="primary" icon={<SendOutlined />} loading={sending} disabled={!trimmed} onClick={submit} className="composer__send">
              {onBehalfReply ? 'Trả lời thay' : `Gửi qua ${CHANNEL_INFO[channel].shortLabel}`}
            </Button>
          </Tooltip>
        </Popconfirm>
      </div>
    </div>
  );
}
