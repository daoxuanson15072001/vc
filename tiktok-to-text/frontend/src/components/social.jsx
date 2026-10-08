import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { useFetch } from '../hooks'
import { useSession } from '../session'
import { dateTime } from '../format'
import { ErrorBox } from './ui'
import { confirmDialog } from './dialog'

// Thụt lề tối đa — trả lời sâu hơn vẫn nối tiếp nhưng không lùi vào thêm
const MAX_DEPTH = 4

// Dòng tóm tắt trên thẻ trong danh sách: ★ 4.5 (3) · 💬 2
export function SocialLine({ social }) {
  if (!social) return null
  return (
    <span className="social-line">
      <span className={social.voters ? 'star-on' : ''} title={`${social.stars} sao từ ${social.voters} người`}
        aria-label={social.voters ? `Trung bình ${social.avg} sao từ ${social.voters} người` : 'Chưa ai chấm sao'}>
        ★ {social.avg ?? '—'}{social.voters > 0 && <span className="muted"> ({social.voters})</span>}
      </span>
      <span title="Bình luận" aria-label={`${social.comments} bình luận`}>💬 {social.comments}</span>
    </span>
  )
}

// Chọn 1–5 sao; bấm lại đúng số sao đang chọn để gỡ
function StarPicker({ social = {}, own, label, small, onVote }) {
  const [hover, setHover] = useState(0)
  const [error, setError] = useState(null)
  const shown = hover || social.mine || 0

  const vote = async (n) => {
    setError(null)
    try {
      await onVote(n === social.mine ? 0 : n)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <div className={`vote-row ${small ? 'vote-sm' : ''}`}>
        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- mỗi sao là nút riêng, có tiêu điểm */}
        <div className="stars" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label={label}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={`star ${n <= shown ? 'on' : ''}`} disabled={own}
              aria-label={`${n} sao`} aria-checked={social.mine === n} role="radio"
              onMouseEnter={() => !own && setHover(n)} onClick={() => vote(n)}>★</button>
          ))}
        </div>
        <span className="small muted">
          {social.voters ? <>TB <b>{social.avg}</b> · {social.stars} sao từ {social.voters} người</> : 'Chưa ai chấm'}
          {own ? ' · của bạn' : social.mine ? ` · bạn chấm ${social.mine} sao` : ''}
        </span>
      </div>
      <ErrorBox>{error}</ErrorBox>
    </>
  )
}

// Chấm sao cho thẻ
export function CardVote({ card, onVoted, small }) {
  const { user } = useSession()
  return (
    <div className="vote-box">
      <StarPicker small={small} social={card.social} own={card.created_by === user.id} label="Chấm sao cho thẻ"
        onVote={async (n) => onVoted(await api.voteCard(card.id, n))} />
    </div>
  )
}

// Thảo luận dưới thẻ: bình luận, trả lời nối tiếp, chấm sao từng bình luận
export function Discussion({ cardId, onChanged }) {
  const { data: items, error, setData } = useFetch(() => api.comments(cardId), [cardId])
  const [replyTo, setReplyTo] = useState(null)   // id bình luận đang trả lời
  const [editing, setEditing] = useState(null)   // { id, body }
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const children = useMemo(() => {
    const map = {}
    for (const c of items || []) (map[c.parent_id || 'root'] ||= []).push(c)
    return map
  }, [items])
  const live = (items || []).filter((c) => !c.deleted).length

  const run = async (fn, countChanged = false) => {
    setActionError(null)
    setBusy(true)
    try {
      setData(await fn())
      if (countChanged) onChanged?.()
      return true
    } catch (e) {
      setActionError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const ctx = {
    children, replyTo, setReplyTo, editing, setEditing, busy, run, cardId, setData,
    send: (body, parentId) => run(() => api.addComment(cardId, body, parentId), true),
  }

  return (
    <section className="discussion">
      <h3>Thảo luận {live > 0 && `(${live})`}</h3>
      <ErrorBox>{error}</ErrorBox>
      {items?.length === 0 && <p className="small muted">Chưa có bình luận. Mở đầu cuộc thảo luận nhé.</p>}
      <CommentList list={children.root} depth={0} ctx={ctx} />
      <CommentForm placeholder="Góp ý, bổ sung, đặt câu hỏi…" busy={busy} onSend={(body) => ctx.send(body)} />
      <ErrorBox>{actionError}</ErrorBox>
    </section>
  )
}

function CommentList({ list, depth, ctx }) {
  if (!list?.length) return null
  return (
    <ul className={`comments ${depth ? 'replies' : ''} ${depth >= MAX_DEPTH ? 'replies-flat' : ''}`}>
      {list.map((c) => <Comment key={c.id} c={c} depth={depth} ctx={ctx} />)}
    </ul>
  )
}

function Comment({ c, depth, ctx }) {
  const { children, replyTo, setReplyTo, editing, setEditing, busy, run, cardId, send, setData } = ctx
  const isEditing = editing?.id === c.id

  if (c.deleted) {
    return (
      <li className="comment-item">
        <div className="comment comment-deleted small muted">Bình luận đã bị xoá</div>
        <CommentList list={children[c.id]} depth={depth + 1} ctx={ctx} />
      </li>
    )
  }

  const saveEdit = async () => { if (await run(() => api.editComment(editing.id, editing.body))) setEditing(null) }
  const remove = async () => {
    if (!(await confirmDialog({ title: 'Xoá bình luận này?', body: c.body.slice(0, 200), okLabel: 'Xoá bình luận', danger: true }))) return
    run(async () => { await api.deleteComment(c.id); return api.comments(cardId) }, true)
  }

  return (
    <li className="comment-item">
      <div className="comment">
        <div className="comment-head">
          <span className="avatar avatar-sm">{(c.user_name || '?').slice(0, 1).toUpperCase()}</span>
          <span className="strong">{c.user_name}</span>
          <span className="muted small">{dateTime(c.created_at)}{c.updated_at && ' · đã sửa'}</span>
        </div>
        {isEditing ? (
          <div className="comment-edit">
            <textarea rows={3} aria-label="Sửa bình luận" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            <div className="actions">
              <button className="btn btn-primary" disabled={!editing.body.trim() || busy} onClick={saveEdit}>Lưu</button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Huỷ</button>
            </div>
          </div>
        ) : (
          <div className="comment-body">{c.body}</div>
        )}
        <div className="comment-foot">
          <StarPicker small social={c.social} own={c.is_mine} label={`Chấm sao bình luận của ${c.user_name}`}
            onVote={async (n) => setData(await api.voteComment(c.id, n))} />
          <div className="comment-actions">
            <button className="link small" aria-label={`Trả lời ${c.user_name}`} aria-expanded={replyTo === c.id}
              onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>Trả lời</button>
            {c.is_mine && !isEditing && <button className="link small" aria-label={`Sửa bình luận của ${c.user_name}`} onClick={() => setEditing({ id: c.id, body: c.body })}>Sửa</button>}
            {c.can_delete && <button className="link small btn-danger-text" aria-label={`Xoá bình luận của ${c.user_name}`} onClick={remove}>Xoá</button>}
          </div>
        </div>
      </div>
      {replyTo === c.id && (
        <CommentForm focusOnMount busy={busy} placeholder={`Trả lời ${c.user_name}…`} submitLabel="Trả lời"
          onCancel={() => setReplyTo(null)}
          onSend={async (body) => { const ok = await send(body, c.id); if (ok) setReplyTo(null); return ok }} />
      )}
      <CommentList list={children[c.id]} depth={depth + 1} ctx={ctx} />
    </li>
  )
}

function CommentForm({ placeholder, busy, onSend, onCancel, submitLabel = 'Gửi', focusOnMount }) {
  const [text, setText] = useState('')
  const box = useRef(null)
  useEffect(() => { if (focusOnMount) box.current?.focus() }, [focusOnMount])   // form trả lời mở ra thì đưa con trỏ vào ô nhập
  const submit = async (e) => {
    e.preventDefault()
    if (text.trim() && (await onSend(text))) setText('')
  }
  return (
    <form className="comment-form" onSubmit={submit}>
      <textarea rows={2} placeholder={placeholder} aria-label={placeholder} value={text} maxLength={4000} ref={box}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e) }} />
      <div className="comment-form-btns">
        <button className="btn btn-primary" disabled={!text.trim() || busy}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Huỷ</button>}
      </div>
    </form>
  )
}
