// Ghi chép theo nguồn / từng tài liệu (WK-45 — DESIGN Phần II mục 12, SCR-03): ô thêm ghi chép, một mục ghi chép
// (sửa / xoá tại chỗ), danh sách. Dùng ở chi tiết nguồn (Kho tư liệu) và màn /kb/notes.
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { num } from '../format'
import { NOTE_TEXT_MAX, noteHref, noteTime, relativeTime } from '../notes'
import { markTime } from '../contentSearch'
import { Badge } from './ui'
import { confirmDialog } from './dialog'
import { toast } from './toast'

// Ô thêm ghi chép. sourceId + docId (null = cả nguồn); sync: cầu nối player (createSync) của video tài liệu đang
// phát -> hiện ô "Gắn mốc thời gian hiện tại" (lấy giây player báo gần nhất).
// watch (SCR-03.2, xem + ghi song song): ô mốc bật sẵn, mốc chốt lúc bắt đầu gõ (video vẫn chạy trong lúc gõ),
// Ctrl / ⌘ + Enter lưu, lưu xong giữ con trỏ trong ô để ghi tiếp.
export function NoteForm({ sourceId, docId = null, sync = null, onSaved, label = 'Ghi chép mới', autoFocus = false,
  watch = false }) {
  const id = useId()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [stamp, setStamp] = useState(watch)
  const now = useRef(null)
  const [shown, setShown] = useState(null)
  const [held, setHeld] = useState(null)   // watch: giây chốt lúc bắt đầu gõ
  const box = useRef(null)
  useEffect(() => sync?.on((t) => { now.current = t; setShown(Math.floor(t)) }), [sync])
  const change = (v) => {
    if (watch) setHeld(!v.trim() ? null : (h) => h ?? (now.current != null ? Math.floor(now.current) : null))
    setText(v)
  }
  const at = watch && held != null ? held : now.current != null ? Math.floor(now.current) : null
  const save = async (e) => {
    e?.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const t = stamp && at != null ? at : null
      await api.addKbNote({ source_id: sourceId, doc_id: docId, text, t })
      setText('')
      setHeld(null)
      toast('Đã lưu ghi chép')
      onSaved?.()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
      if (watch) setTimeout(() => box.current?.focus(), 0)
    }
  }
  const keyDown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(e) }
  const mark = watch && held != null ? held : shown
  return (
    <form className={`note-form${watch ? ' note-form-watch' : ''}`} onSubmit={save} data-testid="kb-note-add">
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea id={id} ref={box} rows={watch ? 3 : 2} value={text} maxLength={NOTE_TEXT_MAX} disabled={busy}
          autoFocus={autoFocus} aria-describedby={`${id}-count`} onChange={(e) => change(e.target.value)}
          onKeyDown={keyDown}
          placeholder={watch ? 'Vừa xem vừa ghi: đoạn hay, ý muốn áp dụng… (Ctrl / ⌘ + Enter để lưu)'
            : 'Điều muốn nhớ, đoạn hay, vì sao lưu… AI dùng làm gợi ý phân loại, không chép vào thẻ'} />
        <small id={`${id}-count`} className="note-count" aria-live="polite">{num(text.length)}/{num(NOTE_TEXT_MAX)} ký tự</small>
      </div>
      <div className="row note-form-actions">
        {sync && (
          <label className="nowrap small">
            <input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} data-testid="kb-note-stamp" />
            {' '}{watch ? 'Gắn mốc thời gian' : 'Gắn mốc thời gian hiện tại'}
            {stamp ? (mark != null ? ` (${markTime(mark)}${watch && held != null ? ' — lúc bắt đầu gõ' : ''})` : ' (bấm phát video trước)') : ''}
          </label>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy || !text.trim()} data-testid="kb-note-save">
          {busy ? 'Đang lưu…' : 'Lưu ghi chép'}
        </button>
      </div>
    </form>
  )
}

// Một ghi chép. n.kind = 'note' (kb_notes) hoặc 'intake' (ghi chú của người nạp, sửa qua PUT /kb/sources/{id}/note).
// showDoc: hiện tên tài liệu (link mở chi tiết nguồn đúng tài liệu / giây). onSeek(t): đang xem video của ghi chép
// này -> bấm mốc tua player tại chỗ thay vì mở lại chi tiết nguồn (link vẫn là href thật).
export function NoteItem({ n, onChanged, showDoc = true, onSeek = null }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(n.text)
  const [busy, setBusy] = useState(false)
  const editId = useId()
  const intake = n.kind === 'intake'
  const what = n.text.length > 40 ? `${n.text.slice(0, 40)}…` : n.text
  const run = async (fn, ok) => {
    setBusy(true)
    try {
      await fn()
      toast(ok)
      setEditing(false)
      onChanged?.()
    } catch (e) {
      toast(e.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const save = () => run(() => (intake ? api.setSourceNote(n.source_id, draft) : api.updateKbNote(n.id, { text: draft })),
    'Đã lưu ghi chép')
  const remove = async () => {
    if (!(await confirmDialog({ title: intake ? 'Xoá ghi chú của người nạp?' : 'Xoá ghi chép này?', body: what,
      okLabel: 'Xoá ghi chép', danger: true }))) return
    run(() => (intake ? api.setSourceNote(n.source_id, '') : api.deleteKbNote(n.id)), 'Đã xoá ghi chép')
  }
  return (
    <li className="note-item" data-testid="kb-note-item" data-id={n.id} data-kind={n.kind}>
      <div className="note-meta muted small">
        {intake && <Badge tone="info" title="Ghi chú nhập khi nạp nguồn (WK-44)">Khi nạp</Badge>}
        {showDoc && (n.doc_id
          ? <Link className="link" to={noteHref(n)}>{n.doc_title || 'Tài liệu'}</Link>
          : <span>Cả nguồn</span>)}
        {!showDoc && !n.doc_id && !intake && <span>Cả nguồn</span>}
        {n.t != null && (
          <Link className="link" to={noteHref(n)} aria-label={`${onSeek ? 'Tua tới' : 'Mở tại'} ${markTime(n.t)}`}
            onClick={onSeek ? (e) => { e.preventDefault(); onSeek(n.t) } : undefined}>{noteTime(n.t)}</Link>
        )}
        <span>· {n.author_name || '—'}</span>
        <time dateTime={n.created_at} title={n.created_at}>· {relativeTime(n.created_at)}</time>
      </div>
      {editing ? (
        <div className="field">
          <label htmlFor={editId} className="sr-only">Sửa ghi chép</label>
          <textarea id={editId} rows={3} value={draft} maxLength={NOTE_TEXT_MAX} disabled={busy} autoFocus
            onChange={(e) => setDraft(e.target.value)} data-testid="kb-note-edit" />
          <div className="row">
            <button className="btn btn-primary" disabled={busy || !draft.trim() || draft === n.text} onClick={save}
              data-testid="kb-note-edit-save">Lưu</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => { setDraft(n.text); setEditing(false) }}>Huỷ sửa</button>
          </div>
        </div>
      ) : <p className="pre-wrap note-text">{n.text}</p>}
      {n.can_edit && !editing && (
        <div className="row note-actions">
          <button className="link small" onClick={() => setEditing(true)} aria-label={`Sửa ghi chép: ${what}`}>Sửa</button>
          <button className="link small btn-danger-text" onClick={remove} disabled={busy} data-testid="kb-note-delete"
            aria-label={`Xoá ghi chép: ${what}`}>Xoá</button>
        </div>
      )}
    </li>
  )
}

export function NoteList({ items, onChanged, showDoc = true, empty = null, onSeek = null }) {
  if (!items?.length) return empty
  return (
    <ul className="note-list" data-testid="kb-note-list">
      {items.map((n) => <NoteItem key={n.id} n={n} onChanged={onChanged} showDoc={showDoc} onSeek={onSeek} />)}
    </ul>
  )
}
