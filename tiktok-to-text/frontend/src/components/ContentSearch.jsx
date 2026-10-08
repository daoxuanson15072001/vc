// Tìm theo nội dung trong tầng thô (WK-35): GET /kb/documents/semantic -> mỗi tài liệu một thẻ, tối đa 3 đoạn khớp.
// Tiêu đề và mốc ▶ mm:ss là link thật (SCR-03, AIX-03): `hrefOf(sourceId, docId, t)` trả "?source=&doc=&t=" — bấm mở
// ngăn kéo nguồn ở tài liệu đó (có giây thì bung video, phát từ giây đó); mở tab mới / sao chép link được.
// Câu tìm do trang cha giữ trong URL — component chỉ tìm khi `q` đổi.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { num, SOURCE_KIND } from '../format'
import { highlightParts, markTime, MATCH_LABEL } from '../contentSearch'
import { parseVideoUrl, watchUrl } from '../videoEmbed'
import { Badge, Empty, ErrorBox } from './ui'

const LIMIT = 20

export default function ContentSearch({ q, spaceId, hrefOf, onByName }) {
  const [state, setState] = useState({ phase: 'idle' })   // idle | loading | done | error

  useEffect(() => {
    if (!q) {
      setState({ phase: 'idle' })
      return undefined
    }
    let alive = true
    setState((s) => ({ ...s, phase: 'loading' }))
    api.semanticDocuments({ q, space_id: spaceId || '', limit: LIMIT })
      .then((res) => alive && setState({ phase: 'done', res }))
      .catch((e) => alive && setState({ phase: 'error', error: e.message }))
    return () => { alive = false }
  }, [q, spaceId])

  if (state.phase === 'idle') {
    return (
      <Empty>
        Gõ câu hỏi hoặc cụm từ rồi bấm <b>Tìm</b> (Enter) — tìm trong chữ của mọi tài liệu (lời nói video, bài viết, file),
        theo nghĩa lẫn từ khoá, kể cả tài liệu chưa tinh chế vào VCWIKI.
      </Empty>
    )
  }
  if (state.phase === 'error') return <ErrorBox>Tìm theo nội dung lỗi: {state.error}</ErrorBox>
  const res = state.res
  const loading = state.phase === 'loading'
  if (!res) return <div className="card muted cs-status" role="status">Đang tìm…</div>
  if (!res.available) {
    return (
      <div className="notice cs-status" role="status">
        <b>Tìm theo nội dung chưa sẵn sàng</b> — máy chủ chưa bật cơ sở dữ liệu vector hoặc AI local.
        {' '}Tạm thời hãy <button type="button" className="link" onClick={onByName}>tìm theo tên, link, tag</button>.
      </div>
    )
  }
  return (
    <section className={`cs-results${loading ? ' cs-loading' : ''}`} aria-busy={loading} aria-label="Kết quả tìm theo nội dung">
      <div className="muted small cs-count" role="status">
        {loading ? 'Đang tìm…' : res.items.length
          ? `${num(res.items.length)} tài liệu khớp “${q}”${res.items.length >= LIMIT ? ` (${LIMIT} tài liệu đầu)` : ''}`
          : null}
      </div>
      {!loading && res.items.length === 0 && (
        <Empty>
          Không thấy đoạn nào khớp “{q}”. Thử diễn đạt khác, bỏ bớt từ, hoặc chọn “Mọi kho”. Tài liệu mới nạp được đưa vào tìm
          theo nội dung trong đêm.
        </Empty>
      )}
      {res.items.map((d) => <Hit key={d.id} d={d} q={q} hrefOf={hrefOf} />)}
    </section>
  )
}

function Hit({ d, q, hrefOf }) {
  const m = MATCH_LABEL[d.match]
  const video = d.url ? parseVideoUrl(d.url, { key: d.key }) : null
  const where = [d.source_title && d.source_title !== d.title ? d.source_title : null, d.platform, d.space_name].filter(Boolean)
  return (
    <article className="card cs-hit" data-testid="kb-search-hit" data-id={d.id} data-kind={d.source_kind}>
      <div className="cs-hit-head">
        <Link className="cs-title strong" to={hrefOf(d.source_id, d.id)} title="Mở chi tiết nguồn, hiện chữ tài liệu này"
          data-testid="kb-search-hit-open">
          <span className="sr-only">{SOURCE_KIND[d.source_kind]?.label}: </span>
          {d.title || 'Tài liệu không tên'}
        </Link>
        {m && <Badge tone={m.tone} title={m.title}>{m.label}</Badge>}
      </div>
      {where.length > 0 && <div className="muted small ellipsis">{where.join(' · ')}</div>}
      <ul className="cs-passages" aria-label={`Đoạn khớp trong ${d.title || 'tài liệu'}`}>
        {(d.passages || []).slice(0, 3).map((p) => {
          const ext = p.time != null ? watchUrl(video, p.time) : null
          return (
            <li key={p.start} className="cs-passage">
              {p.time != null && (
                <span className="cs-time">
                  <Link className="cs-seek" to={hrefOf(d.source_id, d.id, p.time)}
                    title={video ? 'Mở video tại đoạn này' : 'Mở chữ tại mốc này'} aria-label={`Phát từ ${markTime(p.time)}: ${d.title}`}>
                    ▶ {markTime(p.time)}
                  </Link>
                  {ext && <a className="link small" href={ext} target="_blank" rel="noreferrer" title="Mở trên trang gốc tại giây này" aria-label={`Mở trên trang gốc tại ${markTime(p.time)}: ${d.title}`}>↗</a>}
                </span>
              )}
              <span className="cs-snip">
                {highlightParts(p.text, q).map((part, i) => (part.hit ? <mark key={i}>{part.text}</mark> : part.text))}
              </span>
            </li>
          )
        })}
      </ul>
    </article>
  )
}
