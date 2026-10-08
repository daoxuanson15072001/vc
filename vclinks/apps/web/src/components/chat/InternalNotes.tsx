import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, Mentions, Popconfirm, Space, Tooltip } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { conversationEventText, NOTE_MAX_LEN, type ConversationNote, type ConversationPerson } from '@vclinks/shared';
import { bubbleTime } from '../../utils/time';
import { mentionParts } from '../../utils/notes';
import { useNoteActions } from './conversationWorkApi';

/**
 * Internal note box (00 MH-UI-08 "InternalNoteBox"): a box of its own above the composer, never a mode of it, so
 * the text typed for the customer stays. Alt+G opens it, Ctrl+Enter saves, Esc closes and keeps the draft.
 * Notes never go through the outbox: the customer never sees them and they do not end "Chưa trả lời".
 */
export function InternalNoteBox({ conversationId, open, onClose, people }: { conversationId: string; open: boolean; onClose: () => void; people: ConversationPerson[] }) {
  const { message } = App.useApp();
  const actions = useNoteActions(conversationId);
  const [text, setText] = useState('');
  const picked = useRef(new Map<string, string>());
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => box.current?.querySelector('textarea')?.focus(), 0);
  }, [open]);
  const save = () => {
    const t = text.trim();
    if (!t) return;
    const mentions = [...picked.current].filter(([, name]) => t.includes(`@${name}`)).map(([id]) => id);
    actions.add.mutate(
      { text: t, mentions },
      {
        onSuccess: () => {
          message.success('Đã lưu ghi chú nội bộ');
          setText('');
          picked.current.clear();
          onClose();
        },
        onError: (e) => message.error((e as Error).message),
      },
    );
  };
  return (
    <div className="note-box" ref={box} style={{ display: open ? undefined : 'none' }} role="region" aria-label="Ghi chú nội bộ">
      <div className="note-box__strip">
        <LockOutlined /> GHI CHÚ NỘI BỘ — KHÁCH KHÔNG THẤY
      </div>
      <Mentions
        value={text}
        onChange={setText}
        onSelect={(o) => {
          const p = people.find((x) => x.name === o.value);
          if (p) picked.current.set(p.id, p.name);
        }}
        options={people.map((p) => ({ value: p.name, label: p.handler ? `${p.name} (đang xử lý)` : p.name, key: p.id }))}
        autoSize={{ minRows: 2, maxRows: 6 }}
        maxLength={NOTE_MAX_LEN}
        placeholder="Ghi chú nội bộ, khách không thấy. Gõ @ để nhắc đồng nghiệp"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save();
          }
          if (e.key === 'Escape') onClose();
        }}
      />
      <div className="note-box__bar">
        <span className="composer__note">Ctrl+Enter lưu · Esc đóng</span>
        <Space>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="primary" icon={<LockOutlined />} disabled={!text.trim()} loading={actions.add.isPending} onClick={save} className="note-box__save">
            Lưu ghi chú
          </Button>
        </Space>
      </div>
    </div>
  );
}

/** One note (yellow block) or event line of the thread. */
export function NoteBlock({ conversationId, note, highlighted }: { conversationId: string; note: ConversationNote; highlighted?: boolean }) {
  const { message } = App.useApp();
  const actions = useNoteActions(conversationId);
  const [editing, setEditing] = useState<string | null>(null);
  if (note.kind === 'event') {
    return (
      <div className="note-event" id={`note-${note.id}`}>
        <span>
          {conversationEventText(note)} · {bubbleTime(note.createdAt)}
        </span>
      </div>
    );
  }
  return (
    <div className={`note-block${highlighted ? ' note-block--flash' : ''}`} id={`note-${note.id}`}>
      <div className="note-block__head">
        <LockOutlined /> Ghi chú nội bộ · {note.authorName} · {bubbleTime(note.createdAt)}
        {note.editedAt && <span className="note-block__edited"> · Đã sửa</span>}
        {note.canEdit && editing === null && (
          <span className="note-block__actions">
            <Button type="link" size="small" onClick={() => setEditing(note.text ?? '')}>
              Sửa
            </Button>
            <Popconfirm
              title="Xóa ghi chú này?"
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => actions.remove.mutate(note.id, { onSuccess: () => message.success('Đã xóa ghi chú'), onError: (e) => message.error((e as Error).message) })}
            >
              <Button type="link" size="small" danger>
                Xóa
              </Button>
            </Popconfirm>
          </span>
        )}
      </div>
      {editing !== null ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.TextArea value={editing} onChange={(e) => setEditing(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={NOTE_MAX_LEN} />
          <Space>
            <Button size="small" onClick={() => setEditing(null)}>
              Hủy
            </Button>
            <Button
              size="small"
              type="primary"
              disabled={!editing.trim()}
              loading={actions.edit.isPending}
              onClick={() =>
                actions.edit.mutate({ noteId: note.id, text: editing.trim() }, { onSuccess: () => setEditing(null), onError: (e) => message.error((e as Error).message) })
              }
            >
              Lưu
            </Button>
          </Space>
        </Space>
      ) : (
        <div className="note-block__text">
          {mentionParts(note.text ?? '', note.mentions.map((m) => m.name)).map((p, i) =>
            p.mention ? (
              <Tooltip key={i} title="Được nhắc trong ghi chú">
                <span className="note-block__mention">{p.text}</span>
              </Tooltip>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </div>
      )}
    </div>
  );
}
