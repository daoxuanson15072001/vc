import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useDebounced, useFetch } from '../hooks'
import { useSession } from '../session'
import { dateTime, duration, num } from '../format'
import { Empty, ErrorBox, Loading } from '../components/ui'
import { confirmDialog, promptDialog } from '../components/dialog'
import { Markdown } from '../components/markdown'
import { CardDrawer } from './Wiki'
import { SourceModal } from './Knowledge'
import { useSourcePeek } from '../components/sourcePeek'

// Trò chuyện với Claude: Claude đọc / ghi VCWIKI bằng quyền của người đang chat. Lịch sử lưu ở BE (chat_threads / chat_messages).
// Trang đầy đủ /chat (danh sách + luồng); cửa sổ Chat nhanh góc phải (components/QuickChat.jsx) dùng lại Thread / Composer.
const TOOL_LABEL = {
  search_cards: 'Tìm thẻ', get_card: 'Đọc thẻ', create_card: 'Tạo thẻ', update_card: 'Sửa thẻ',
  save_memory: 'Ghi nhớ', recall_memory: 'Nhớ lại', forget_memory: 'Xoá ghi nhớ',
  list_sources: 'Xem nguồn', get_source: 'Đọc nguồn', prioritize_source: 'Ưu tiên nguồn',
  list_documents: 'Xem tài liệu', get_document: 'Đọc tài liệu', mark_document: 'Đánh dấu tài liệu',
  tag_document: 'Gắn tag tài liệu', tag_video: 'Gắn tag video', list_tags: 'Xem tag', add_links: 'Nạp link',
  search_videos: 'Tìm video', get_video: 'Đọc video', list_channels: 'Xem kênh', stats: 'Thống kê',
  start_scan: 'Quét kênh', get_scan: 'Xem lượt quét', list_spaces: 'Xem kho', list_categories: 'Xem lĩnh vực',
  whoami: 'Tài khoản', read_guide: 'Đọc hướng dẫn', read_ba: 'Đọc BA', get_system_spec: 'Xem thông số',
}
export const SUGGEST = [
  'Tổng quan kho: có bao nhiêu thẻ, nguồn, video?',
  'Tìm các thẻ về quản trị dòng tiền và tóm tắt ý chính',
  'Hàng chờ tinh chế còn những tài liệu nào? Tinh chế giúp 3 tài liệu đầu',
  'Nạp link này vào Kho tư liệu: ',
]

export const LOCAL_SUGGEST = [
  'Hướng dẫn tôi cách tìm thẻ trong VCWIKI',
  'Làm thế nào để đề xuất sửa một thẻ đã duyệt?',
  'Tìm các thẻ về quản trị dòng tiền và tóm tắt ý chính',
]
export const LOCAL_LIMIT = 'AI local tra cứu dữ liệu theo quyền của bạn; chưa tạo, sửa hoặc xoá dữ liệu.'
export const usesLocal = (status) => !!(status?.available && !status.cli && status.fallback && status.local?.ready)

export function ChatAvailability({ status }) {
  if (!status) return null
  if (!status.available) {
    return <div className="notice" role="status">
      {!status.allowed ? 'Trò chuyện hiện chỉ mở cho quản trị viên.'
        : !status.fallback ? 'Claude CLI chưa sẵn sàng; dự phòng AI local đang tắt.'
          : <>Claude CLI và AI local chưa sẵn sàng. {status.local?.error || 'Hãy kiểm tra Ollama và model trên máy chủ.'} Bạn có thể gửi lại khi AI hoạt động.</>}
    </div>
  }
  return usesLocal(status) ? <div className="notice" role="status">
    <span data-testid="chat-engine">AI local · {status.local.model}</span> sẵn sàng khi Claude CLI không hoạt động. {LOCAL_LIMIT}
  </div> : null
}

export default function Chat() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useSession()
  const [showAll, setShowAll] = useState(false)
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const { data: status, error: statusError } = useFetch(api.chatStatus, [])
  const [err, setErr] = useState(null)
  const { data: list, reload: reloadList } = useFetch(() => api.chatThreads({ all: showAll || '', q: dq }), [showAll, dq])
  const from = params.get('from')   // trang người dùng đang xem khi bấm "Hỏi Claude"

  const newThread = async () => {
    setErr(null)
    try {
      const t = await api.createChatThread({})
      reloadList()
      navigate(`/chat/${t.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`)
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="chat-layout">
      <aside className="chat-side card" aria-label="Các cuộc trò chuyện">
        <button className="btn btn-primary chat-new" data-testid="chat-thread-new" onClick={newThread}>+ Cuộc trò chuyện mới</button>
        <input type="search" placeholder="Tìm cuộc trò chuyện…" aria-label="Tìm cuộc trò chuyện" value={q} onChange={(e) => setQ(e.target.value)} />
        {user.role === 'admin' && (
          <label className="small muted chat-all">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Của mọi người
          </label>
        )}
        <ul className="chat-threads">
          {(list?.items || []).map((t) => (
            <li key={t.id} data-id={t.id}>
              <Link to={`/chat/${t.id}`} className={t.id === id ? 'active' : ''} aria-current={t.id === id ? 'page' : undefined}>
                <span className="clamp-1">{t.title}</span>
                <span className="muted small">
                  {showAll && t.user_name ? `${t.user_name} · ` : ''}{dateTime(t.updated_at)} · {num(t.message_count / 2)} lượt
                </span>
              </Link>
            </li>
          ))}
          {list && !list.items.length && <li className="muted small chat-none">Chưa có cuộc trò chuyện nào</li>}
        </ul>
      </aside>

      <section className="chat-main card" aria-label="Cuộc trò chuyện">
        {statusError && (
          <div className="error-box">
            Máy chủ chưa có chức năng trò chuyện ({statusError}). Nếu vừa cập nhật phần mềm, hãy khởi động lại máy chủ
            (<code>bash start_web.sh</code>) rồi tải lại trang.
          </div>
        )}
        <ErrorBox>{err}</ErrorBox>
        <ChatAvailability status={status} />
        {id
          ? <Thread key={id} id={id} from={from} onChange={reloadList} />
          : <Welcome from={from} local={usesLocal(status)} disabled={!!(status && !status.available)} onStart={async (text) => {
              setErr(null)
              try {
                const t = await api.createChatThread({})
                reloadList()
                navigate(`/chat/${t.id}`, { state: { send: text, from } })
              } catch (e) {
                setErr(`Không gửi được: ${e.message}`)
              }
            }} />}
      </section>
    </div>
  )
}

function Welcome({ onStart, from, local, disabled }) {
  return (
    <div className="chat-welcome">
      <h1>Trò chuyện với Claude</h1>
      <p className="muted">
        {local ? 'Hỏi cách dùng ứng dụng, tra cứu VCWIKI, Kho tư liệu, video và học tập theo quyền của bạn. Cuộc trò chuyện và các lần tra cứu được lưu lại.'
          : 'Ra lệnh bằng lời — Claude tra cứu và ghi thẳng vào VCWIKI bằng quyền của bạn: tìm thẻ, tinh chế tài liệu, nạp link, gắn tag, ghi nhớ… Mọi cuộc trò chuyện và việc Claude đã làm được lưu lại.'}
      </p>
      {from && <p className="small muted">Đang hỏi từ trang <code>{from}</code></p>}
      <Composer onSend={onStart} autoFocus busy={disabled} placeholder={local ? 'Hỏi AI local… (Enter để gửi, Shift+Enter xuống dòng)' : undefined} />
      <div className="chat-suggest">
        {(local ? LOCAL_SUGGEST : SUGGEST).map((s) => <button key={s} className="btn btn-ghost" disabled={disabled} onClick={() => onStart(s)}>{s}</button>)}
      </div>
    </div>
  )
}

// compact: trong cửa sổ Chat nhanh — bối cảnh trang lấy từ getContext() mỗi lần gửi (người dùng chuyển trang trong lúc chat),
// xoá xong gọi onDeleted thay vì điều hướng; initialSend: câu hỏi gõ ở màn chào, gửi ngay khi luồng tải xong
export function Thread({ id, from, onChange, compact = false, getContext = null, onDeleted = null, initialSend = null }) {
  const navigate = useNavigate()
  const { data: thread, error, setData, reload } = useFetch(() => api.chatThread(id), [id])
  const [err, setErr] = useState(null)
  const bottom = useRef(null)
  const sources = useRef({})
  const [peek, setPeek] = useState(null)   // { card } hoặc { source } đang mở tại chỗ
  useEffect(() => setPeek(null), [id])
  // link ngoài (TikTok, web…) trùng tài liệu đã nạp -> modal nguồn; chỉ tra câu trả lời đã xong để không gọi API theo từng chữ
  const done = (thread?.messages || []).filter((m) => m.role === 'assistant' && !['queued', 'running'].includes(m.status))
  const linked = useSourcePeek(done.map((m) => m.content).join('\n'))
  // câu hỏi + trang gốc chuyển từ màn chào (router state) — đọc một lần lúc mở
  const pendingSend = useRef(initialSend || window.history.state?.usr?.send)
  const context = useRef(from || window.history.state?.usr?.from || null)

  const patchMsg = useCallback((mid, fn) => setData((t) => t && ({
    ...t, messages: t.messages.map((m) => (m.id === mid ? fn(m) : m)),
  })), [setData])

  // theo dõi một lượt đang chạy qua SSE
  const follow = useCallback((mid) => {
    if (sources.current[mid]) return
    const es = new EventSource(api.chatStreamUrl(mid))
    sources.current[mid] = es
    let replay = true   // BE phát lại từ đầu: xoá phần đã có để không lặp chữ
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data)
      if (replay) { patchMsg(mid, (m) => ({ ...m, content: '', tools: [], model: null, note: null, error: null })); replay = false }
      if (ev.t === 'text') patchMsg(mid, (m) => ({ ...m, content: m.content + ev.d, status: 'running' }))
      else if (ev.t === 'status') patchMsg(mid, (m) => ({ ...m, status: ev.status,
        ...(ev.model !== undefined ? { model: ev.model } : {}), ...(ev.note !== undefined ? { note: ev.note } : {}) }))
      else if (ev.t === 'reset') patchMsg(mid, (m) => ({ ...m, content: '', tools: [], error: null }))
      else if (ev.t === 'tool') patchMsg(mid, (m) => ({ ...m, tools: [...m.tools, ev.tool] }))
      else if (ev.t === 'tool_result') patchMsg(mid, (m) => ({ ...m, tools: m.tools.map((x) => (x.id === ev.tool.id ? ev.tool : x)) }))
      else if (ev.t === 'done') {
        patchMsg(mid, () => ev.message)
        es.close(); delete sources.current[mid]
        reload()      // tiêu đề, số lượt, chi phí của cuộc trò chuyện
        onChange()
      }
    }
    es.onerror = () => { /* EventSource tự nối lại; BE phát lại từ đầu */ replay = true }
  }, [patchMsg, onChange, reload])

  useEffect(() => () => Object.values(sources.current).forEach((es) => es.close()), [])

  // mở lại trang khi Claude đang trả lời dở → nối tiếp
  useEffect(() => {
    thread?.messages.filter((m) => ['queued', 'running'].includes(m.status)).forEach((m) => follow(m.id))
  }, [thread?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [thread?.messages.length, thread?.messages.at(-1)?.content.length])

  const send = async (text) => {
    setErr(null)
    // Trang đầy đủ: bối cảnh trang (?from=) chỉ gắn vào câu đầu tiên. Chat nhanh: gửi trang đang mở mỗi khi khác
    // lần trước, để Claude biết "trang này" / "thẻ này" là gì
    let ctx = context.current
    if (getContext) {
      const cur = getContext() || null
      const last = [...thread.messages].reverse().find((m) => m.role === 'user' && m.context)?.context
      ctx = cur && cur !== last ? cur : null
    }
    try {
      const r = await api.sendChat(id, { text, context: ctx })
      context.current = null
      setData((t) => ({ ...t, title: t.title === 'Cuộc trò chuyện mới' ? text.split('\n')[0].slice(0, 80) : t.title,
        message_count: t.message_count + 2, messages: [...t.messages, r.user_message, r.assistant_message] }))
      follow(r.assistant_message.id)
      onChange()
    } catch (e) {
      setErr(e.message)
    }
  }

  // câu hỏi gõ ở màn chào: gửi ngay khi luồng đã tải
  useEffect(() => {
    if (thread && pendingSend.current) {
      const text = pendingSend.current
      pendingSend.current = null
      window.history.replaceState({ ...window.history.state, usr: {} }, '')
      send(text)
    }
  }, [thread]) // eslint-disable-line react-hooks/exhaustive-deps

  const rename = async () => {
    const title = await promptDialog({ title: 'Đổi tên cuộc trò chuyện', label: 'Tên cuộc trò chuyện', defaultValue: thread.title, okLabel: 'Đổi tên' })
    if (title == null) return
    await api.patchChatThread(id, { title })
    setData((t) => ({ ...t, title })); onChange()
  }
  const remove = async () => {
    if (!(await confirmDialog({ title: 'Xoá cuộc trò chuyện này?', body: 'Dữ liệu Claude đã ghi vào VCWIKI vẫn giữ nguyên.', okLabel: 'Xoá cuộc trò chuyện', danger: true }))) return
    try { await api.deleteChatThread(id); onChange(); onDeleted ? onDeleted() : navigate('/chat') } catch (e) { setErr(e.message) }
  }

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!thread) return <Loading />
  const Title = compact ? 'h2' : 'h1'    // trang /chat: tên cuộc trò chuyện là h1 duy nhất; trong Chat nhanh là h2
  const busy = thread.messages.some((m) => ['queued', 'running'].includes(m.status))
  const running = thread.messages.find((m) => m.role === 'assistant' && ['queued', 'running'].includes(m.status))

  return (
    <>
      <header className={`chat-head ${compact ? 'chat-head-compact' : ''}`}>
        <div className="grow">
          <Title className="clamp-1" title={thread.title} style={compact ? undefined : { margin: 0, fontSize: 16 }}>{thread.title}</Title>
          {!compact && (
            <div className="muted small">
              {!thread.can_write && `${thread.user_name} · chỉ xem · `}
              {num(thread.message_count / 2)} lượt{thread.cost_usd > 0 && ` · ước tính $${thread.cost_usd.toFixed(2)}`}
            </div>
          )}
        </div>
        {thread.can_write && (
          <div className="actions">
            <button className="btn btn-ghost" onClick={rename} title="Đổi tên cuộc trò chuyện" aria-label={compact ? `Đổi tên cuộc trò chuyện: ${thread.title}` : undefined} data-testid="chat-thread-rename">{compact ? '✎' : 'Đổi tên'}</button>
            <button className="btn btn-ghost" onClick={remove} title="Xoá cuộc trò chuyện" aria-label={compact ? `Xoá cuộc trò chuyện: ${thread.title}` : undefined} data-testid="chat-thread-delete">{compact ? '🗑' : 'Xoá'}</button>
          </div>
        )}
      </header>

      {/* onClick bắt click của <a> thật bên trong (uỷ quyền sự kiện), không phải vùng bấm */}
      <div className="chat-messages" role="log" aria-live="polite" aria-label="Tin nhắn" data-testid="chat-messages"
        onClick={(e) => { const p = appLink(e); if (p) { e.preventDefault(); setPeek(p) } else linked.onClick(e) }}>
        {thread.messages.length === 0 && <Empty>Hỏi hoặc giao việc cho Claude ở ô bên dưới.</Empty>}
        {thread.messages.map((m) => <Message key={m.id} m={m} />)}
        <div ref={bottom} />
      </div>

      <ErrorBox>{err}</ErrorBox>
      {thread.can_write && (
        <Composer onSend={send} busy={busy} autoFocus
          onStop={running ? () => api.cancelChat(running.id) : null} />
      )}
      {peek?.card && <ChatCardDrawer id={peek.card} onClose={() => setPeek(null)} />}
      {peek?.source && <SourceModal id={peek.source} onClose={() => setPeek(null)} />}
      {linked.modal}
    </>
  )
}

// Link thẻ (/wiki?card=<id>) / nguồn (/kb?source=<id>) trong câu trả lời mở ngay tại chat thay vì tab mới;
// Ctrl/⌘/Shift-click hoặc chuột giữa vẫn mở tab mới như link thường
function appLink(e) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null
  const a = e.target.closest('a[href]')
  if (!a) return null
  const url = new URL(a.getAttribute('href'), window.location.origin)
  if (url.origin !== window.location.origin) return null
  const card = url.pathname === '/wiki' && url.searchParams.get('card')
  const source = url.pathname === '/kb' && url.searchParams.get('source')
  return card ? { card } : source ? { source } : null
}

function ChatCardDrawer({ id, onClose }) {
  const { data: cats } = useFetch(api.categories, [])
  const { data: spaces } = useFetch(api.spaces, [])
  if (!cats || !spaces) return null
  return <CardDrawer id={id} spaces={spaces} cats={cats} onClose={onClose} onChanged={() => {}} onCreated={() => {}} />
}

function Message({ m }) {
  if (m.role === 'user') {
    return (
      <article className="chat-msg chat-user" aria-label="Bạn" data-id={m.id} data-role="user">
        <div className="chat-bubble">{m.content}</div>
        {m.context && <div className="muted small">từ trang <code>{m.context}</code></div>}
      </article>
    )
  }
  const live = ['queued', 'running'].includes(m.status)
  const local = m.model?.startsWith('local:')
  const engine = local ? 'AI local' : 'Claude'
  return (
    <article className="chat-msg chat-ai" aria-label={engine} aria-busy={live || undefined} data-id={m.id} data-role="assistant" data-status={m.status}>
      <div className="chat-avatar" aria-hidden="true">✺</div>
      <div className="grow chat-ai-body">
        <div className="muted small" data-testid="chat-engine">{engine}{local && ` · ${m.model.slice(6)}`}</div>
        {local && <div className="muted small">{LOCAL_LIMIT}</div>}
        {live && m.note && <div className="muted small">{m.note}</div>}
        {m.tools.length > 0 && (
          <div className="chat-tools">{m.tools.map((t) => <ToolCall key={t.id} t={t} />)}</div>
        )}
        {m.content && <Markdown text={m.content} className="md chat-md" />}
        {live && (
          <div className="muted small chat-typing">
            <span className="live-dot live-info" /> {m.status === 'queued' ? 'Đang xếp hàng…' : m.tools.some((t) => t.status === 'running') ? 'Claude đang thao tác VCWIKI…' : `${engine} đang trả lời…`}
          </div>
        )}
        {m.error && <div className="tone-bad small">⚠ {m.error}</div>}
        {!live && m.duration_ms != null && (
          <div className="muted small chat-meta">{duration(m.duration_ms / 1000)}{m.tools.length > 0 && ` · ${m.tools.length} thao tác`}</div>
        )}
      </div>
    </article>
  )
}

const WRITE_TOOLS = ['create_card', 'update_card', 'save_memory', 'forget_memory', 'mark_document', 'tag_document',
  'tag_video', 'add_links', 'start_scan', 'prioritize_source']

function ToolCall({ t }) {
  const [open, setOpen] = useState(false)
  const args = Object.entries(t.input || {}).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' · ')
  const icon = t.status === 'running' ? '…' : t.status === 'error' ? '✗' : '✓'
  return (
    <div className={`chat-tool chat-tool-${t.status} ${WRITE_TOOLS.includes(t.name) ? 'chat-tool-write' : ''}`}>
      <button type="button" onClick={() => setOpen(!open)} title="Xem chi tiết" aria-expanded={open}>
        <span className="chat-tool-icon">{icon}</span>
        <b>{TOOL_LABEL[t.name] || t.name}</b>
        {WRITE_TOOLS.includes(t.name) && <span className="chat-tool-tag">ghi</span>}
        <span className="muted ellipsis">{args}</span>
      </button>
      {open && (
        <div className="chat-tool-detail">
          <div className="small muted">{t.name}</div>
          <pre>{JSON.stringify(t.input, null, 2)}</pre>
          {t.result && <><div className="small muted">Kết quả</div><pre>{t.result}</pre></>}
        </div>
      )}
    </div>
  )
}

export function Composer({ onSend, busy, onStop, autoFocus, placeholder }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  const inputId = useId()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [text])
  const submit = (e) => {
    e?.preventDefault()
    const v = text.trim()
    if (!v || busy) return
    onSend(v)
    setText('')
  }
  return (
    <form className="chat-composer" onSubmit={submit} data-testid="chat-composer">
      <label htmlFor={inputId} className="sr-only">Hỏi Claude</label>
      <textarea id={inputId} ref={ref} rows={1} value={text} autoFocus={autoFocus}
        placeholder={placeholder || 'Hỏi hoặc ra lệnh cho Claude… (Enter để gửi, Shift+Enter xuống dòng)'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e) }} />
      {onStop
        ? <button type="button" className="btn" onClick={onStop} data-testid="chat-stop">■ Dừng</button>
        : <button type="submit" className="btn btn-primary" disabled={!text.trim() || busy} data-testid="chat-send">Gửi</button>}
    </form>
  )
}
