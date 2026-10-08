// Hướng dẫn sử dụng VCWIKI (/guide) — nội dung ở pages/guide/content.js. Lọc theo vai trò, tìm trong hướng dẫn
// (không phân biệt dấu), mục lục bấm để nhảy, link neo /guide#<id> gửi được cho đồng nghiệp.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { usePageTitle } from '../hooks'
import { useSession } from '../session'
import { Badge, Empty } from '../components/ui'
import { toast } from '../components/toast'
import { Markdown } from '../components/markdown'
import { AUDIENCE, SECTIONS } from './guide/content'
import './guide/guide.css'

const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Vai trò gợi ý theo tài khoản: chỉ để đánh dấu "dành cho bạn", không ẩn mục nào
function mine(user) {
  const out = new Set(['all', 'editor', 'learn'])
  if (user?.can_design || user?.can_grade || user?.role === 'admin') out.add('reviewer')
  if (user?.role === 'admin') out.add('admin')
  return out
}

// Đoạn chữ sao chép được (lời nhắn dán cho Claude): khung <pre> + nút Sao chép; không có clipboard (http, trình
// duyệt cũ) thì bôi đen sẵn để người dùng Ctrl/⌘+C. Kết quả báo bằng toast dùng chung (vùng aria-live).
function Snippet({ title, text }) {
  const ref = useRef(null)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast(`Đã sao chép: ${title}`)
    } catch {
      const r = document.createRange()
      r.selectNodeContents(ref.current)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(r)
      toast('Đã bôi đen — bấm Ctrl/⌘+C để sao chép', { tone: 'info' })
    }
  }
  return (
    <div className="guide-snippet" data-testid="guide-snippet">
      <div className="guide-snippet-head">
        <span className="strong small">{title}</span>
        <span className="row">
          <button type="button" className="btn btn-ghost" onClick={copy} aria-label={`Sao chép: ${title}`} data-testid="guide-snippet-copy">Sao chép</button>
        </span>
      </div>
      <pre ref={ref} tabIndex={0} aria-label={title}>{text}</pre>
    </div>
  )
}

export default function Guide() {
  usePageTitle('Hướng dẫn sử dụng')
  const { user } = useSession()
  const { hash } = useLocation()
  const [q, setQ] = useState('')
  const [aud, setAud] = useState('')
  const forMe = useMemo(() => mine(user), [user])

  const shown = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean)
    return SECTIONS.filter((s) => (!aud || s.audience.includes(aud))
      && words.every((w) => fold(`${s.title}\n${s.body}`).includes(w)))
  }, [q, aud])

  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (el) el.scrollIntoView({ block: 'start' })
  }, [hash])

  const jump = (id) => (e) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${id}`)
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Hướng dẫn sử dụng VCWIKI</h1>
          <p className="muted">
            Cách tìm, đọc, nạp tư liệu, tạo và duyệt thẻ tri thức, học tập và hỏi Claude. Chọn vai trò để lọc, hoặc gõ điều bạn cần tìm.
            {' '}Bản thuần văn bản cho AI / đọc bằng lệnh: <a className="link" href="/guide.md" target="_blank" rel="noreferrer" data-testid="guide-md-all">/guide.md</a>
            {' '}(từng mục: <code>/guide/&lt;id&gt;.md</code>, mục lục JSON <code>/api/guide</code>).
          </p>
        </div>
      </header>

      <div className="guide-tools" role="search" aria-label="Tìm và lọc hướng dẫn">
        <input type="search" className="guide-search" aria-label="Tìm trong hướng dẫn" value={q}
          placeholder="Tìm trong hướng dẫn — gõ không dấu cũng được" onChange={(e) => setQ(e.target.value)} />
        <div className="guide-chips" role="group" aria-label="Lọc theo vai trò">
          <button type="button" className={`guide-chip ${aud === '' ? 'active' : ''}`} aria-pressed={aud === ''} onClick={() => setAud('')}>Tất cả</button>
          {Object.entries(AUDIENCE).map(([k, v]) => (
            <button type="button" key={k} className={`guide-chip ${aud === k ? 'active' : ''}`} aria-pressed={aud === k} data-testid={`guide-aud-${k}`} onClick={() => setAud(aud === k ? '' : k)}>{v}</button>
          ))}
        </div>
      </div>

      <div className="guide-layout">
        <nav className="guide-toc" aria-label="Mục lục">
          <div className="small strong muted">Mục lục</div>
          <ol>
            {shown.map((s) => <li key={s.id}><a href={`#${s.id}`} onClick={jump(s.id)} data-testid={`guide-toc-${s.id}`}>{s.title}</a></li>)}
          </ol>
        </nav>

        <div className="guide-body">
          <div className="sr-only" role="status" data-testid="guide-count">{q || aud ? `${shown.length} mục khớp` : ''}</div>
          {shown.length === 0 && <Empty>Không có mục nào khớp “{q}”. Thử từ khác, hoặc bỏ lọc vai trò.</Empty>}
          {shown.map((s) => (
            <section key={s.id} id={s.id} className="card guide-section" data-testid="guide-section" data-id={s.id} aria-labelledby={`${s.id}-title`}>
              <div className="guide-section-head">
                <h2 id={`${s.id}-title`}>{s.title}</h2>
                <a className="guide-anchor" href={`#${s.id}`} onClick={jump(s.id)} aria-label={`Link tới mục ${s.title}`}>#</a>
                <a className="guide-anchor small" href={`/guide/${s.id}.md`} target="_blank" rel="noreferrer" title="Bản thuần văn bản (Markdown) của mục này — cho AI đọc bằng HTTP" aria-label={`Bản Markdown của mục ${s.title}`}>.md</a>
              </div>
              <div className="meta">
                {s.audience.map((a) => <Badge key={a} tone={forMe.has(a) && a !== 'all' ? 'info' : 'muted'}>{AUDIENCE[a]}</Badge>)}
              </div>
              <Markdown className="guide-md" text={s.body} />
              {s.snippets?.map((sn) => <Snippet key={sn.title} {...sn} />)}
              {s.links?.length > 0 && (
                <div className="actions">
                  {s.links.map((l) => <Link key={l.to} className="btn" to={l.to}>{l.label} →</Link>)}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
