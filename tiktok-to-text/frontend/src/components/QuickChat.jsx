// Chat nhanh: cửa sổ trò chuyện với Claude nổi ở góc dưới bên phải mọi trang — không rời trang đang xem.
// Dùng lại Thread / Composer của trang /chat; mỗi câu gửi kèm trang đang mở (đường dẫn + tiêu đề) làm bối cảnh.
// Trạng thái mở / thu nhỏ và cuộc trò chuyện đang theo dõi nhớ trong localStorage của trình duyệt.
// Trên trang /chat (bản đầy đủ) thì ẩn.
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import { APP_NAME, useDebounced, useFetch } from '../hooks'
import { dateTime, num } from '../format'
import { buildChatContext } from '../chatContext'
import { ErrorBox } from './ui'
import { Icon } from './icons'
import { ChatAvailability, Composer, LOCAL_SUGGEST, SUGGEST, Thread, usesLocal } from '../pages/Chat'

const KEY_OPEN = 'qchat.open'
const KEY_THREAD = 'qchat.thread'
const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* chế độ riêng tư */ } },
}

export default function QuickChat() {
  const { pathname, search } = useLocation()
  const [open, setOpen] = useState(() => store.get(KEY_OPEN) === '1')
  const [threadId, setThreadId] = useState(() => store.get(KEY_THREAD) || null)
  const [view, setView] = useState('thread')          // thread | list
  const [focus, setFocus] = useState(false)           // chỉ tự đặt con trỏ khi người dùng vừa bấm mở
  const [err, setErr] = useState(null)
  const [tick, setTick] = useState(0)                 // luồng đổi (tên, số lượt) -> danh sách tải lại
  const pending = useRef(null)                        // câu hỏi gõ ở màn chào, gửi khi luồng mới tải xong
  const { data: status, error: statusError } = useFetch(() => (open ? api.chatStatus() : Promise.resolve(null)), [open])

  useEffect(() => store.set(KEY_OPEN, open ? '1' : null), [open])
  useEffect(() => store.set(KEY_THREAD, threadId), [threadId])

  if (pathname.startsWith('/chat')) return null

  if (!open) {
    return (
      <button type="button" className="ask-claude" title="Chat nhanh với Claude về trang này"
        onClick={() => { setOpen(true); setFocus(true) }}>
        <Icon name="sparkles" size={16} /> Hỏi Claude
      </button>
    )
  }

  // trang đang mở (AIX-12): đường dẫn + tham số, tiêu đề tab (bỏ tên app), h1, bộ lọc đang bật, đối tượng đang mở —
  // BE thêm mục hướng dẫn liên quan theo đường dẫn
  const getContext = () => {
    const title = document.title.replace(` · ${APP_NAME}`, '')
    const h1 = document.querySelector('main h1')?.textContent.trim() || ''
    return buildChatContext({ pathname, search, title: title && title !== APP_NAME ? title : '', h1 })
  }
  const pick = (id) => { pending.current = null; setThreadId(id); setView('thread'); setErr(null) }
  const start = async (text) => {
    setErr(null)
    try {
      const t = await api.createChatThread({})
      pending.current = text
      setThreadId(t.id)
      setTick((n) => n + 1)
    } catch (e) {
      setErr(`Không gửi được: ${e.message}`)
    }
  }
  const unavailable = status && !status.available

  return (
    <aside className="qchat" data-testid="qchat" aria-label="Chat nhanh">
      <header className="qchat-head">
        <span className="qchat-title"><Icon name="sparkles" size={16} /> Chat nhanh</span>
        <div className="actions">
          <button type="button" title="Các cuộc trò chuyện" aria-label="Các cuộc trò chuyện" aria-pressed={view === 'list'}
            onClick={() => setView((v) => (v === 'list' ? 'thread' : 'list'))}><Icon name="message" size={16} /></button>
          <button type="button" title="Cuộc trò chuyện mới" aria-label="Cuộc trò chuyện mới" onClick={() => pick(null)}><Icon name="plus" size={16} /></button>
          <Link to={threadId ? `/chat/${threadId}` : '/chat'} title="Mở rộng thành trang" aria-label="Mở rộng"><Icon name="maximize" size={16} /></Link>
          <button type="button" title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => setOpen(false)}><Icon name="minimize" size={16} /></button>
        </div>
      </header>
      {statusError && <div className="error-box">Máy chủ chưa có chức năng trò chuyện ({statusError}).</div>}
      <ChatAvailability status={status} />
      <ErrorBox>{err}</ErrorBox>
      <div className="qchat-body">
        {view === 'list'
          ? <ThreadList current={threadId} tick={tick} onPick={pick} />
          : threadId
            ? <Thread key={threadId} id={threadId} compact getContext={getContext} initialSend={pending.current}
                onChange={() => setTick((n) => n + 1)} onDeleted={() => pick(null)} />
            : <Welcome onStart={start} autoFocus={focus} disabled={!!unavailable} local={usesLocal(status)} />}
      </div>
    </aside>
  )
}

function Welcome({ onStart, autoFocus, disabled, local }) {
  return (
    <>
      <div className="qchat-welcome">
        <p className="muted small">
          {local ? 'AI local đọc hướng dẫn, VCWIKI, Kho tư liệu và video theo quyền của bạn. Hãy hỏi "trang này dùng thế nào"…'
            : 'Claude tra VCWIKI, Kho tư liệu và Hướng dẫn sử dụng bằng quyền của bạn, và biết bạn đang mở trang nào — cứ hỏi "trang này dùng thế nào", "tóm tắt thẻ này"…'}
        </p>
        <div className="chat-suggest">
          {['Trang này dùng thế nào?', ...(local ? LOCAL_SUGGEST : SUGGEST.slice(0, 3))].map((s) => (
            <button key={s} type="button" className="btn btn-ghost" disabled={disabled} onClick={() => onStart(s)}>{s}</button>
          ))}
        </div>
      </div>
      <Composer onSend={onStart} autoFocus={autoFocus} busy={disabled} placeholder={local ? 'Hỏi AI local về trang này… (Enter để gửi)' : 'Hỏi Claude về trang này… (Enter để gửi)'} />
    </>
  )
}

function ThreadList({ current, tick, onPick }) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const { data } = useFetch(() => api.chatThreads({ q: dq }), [dq, tick])
  return (
    <div className="qchat-list">
      <input type="search" placeholder="Tìm cuộc trò chuyện…" aria-label="Tìm cuộc trò chuyện" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="chat-threads">
        {(data?.items || []).map((t) => (
          <li key={t.id}>
            <a href={`/chat/${t.id}`} className={t.id === current ? 'active' : ''} onClick={(e) => { e.preventDefault(); onPick(t.id) }}>
              <span className="clamp-1">{t.title}</span>
              <span className="muted small">{dateTime(t.updated_at)} · {num(t.message_count / 2)} lượt</span>
            </a>
          </li>
        ))}
        {data && !data.items.length && <li className="muted small chat-none">Chưa có cuộc trò chuyện nào</li>}
      </ul>
    </div>
  )
}
