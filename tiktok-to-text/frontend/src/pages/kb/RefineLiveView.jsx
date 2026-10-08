// Tiến độ tinh chế › Trực tiếp (SCR-04, ?view=live; /refine/live mở sẵn): BE đẩy ảnh chụp qua SSE mỗi khi có thay đổi —
// bộ đếm, biểu đồ 60 phút, việc AI đang làm, nguồn đang chép chữ, nhật ký role="log", bảng «Vừa vào VCWIKI».
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { clock, duration, num, time } from '../../format'
import { Empty, ErrorBox, Loading } from '../../components/ui'
import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { statusInfo } from '../../statuses'

function useLiveProgress(spaceId) {
  const [snap, setSnap] = useState(null)
  const [conn, setConn] = useState('connecting')
  useEffect(() => {
    setConn('connecting')
    const es = new EventSource(api.refineStreamUrl({ space_id: spaceId }))
    es.onmessage = (e) => { setSnap(JSON.parse(e.data)); setConn('live') }
    es.onopen = () => setConn('live')
    es.onerror = () => setConn('lost')   // EventSource tự nối lại
    return () => es.close()
  }, [spaceId])
  return { snap, conn }
}

// đồng hồ chạy từng giây để đếm thời gian của việc đang làm giữa hai lần BE gửi
function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function RefineLiveView({ spaceId }) {
  const { snap, conn } = useLiveProgress(spaceId)
  const now = useNow()
  const c = statusInfo('refineConn', conn)
  return (
    <div className="kb-stack">
      <p className="small kb-updated" role="status" data-testid="refine-live-conn" data-status={conn}>
        <span className={`live-dot live-${c.tone}`} aria-hidden="true" /> {c.label}{snap && conn === 'live' && ` · cập nhật lúc ${time(snap.at)}`}
      </p>
      {snap && !snap.ai.ready && (
        <Notice tone="warn" title="AI chưa sẵn sàng:">{snap.ai.error}. Dựng thẻ và tổng hợp theo cụm tạm dừng; chuyển thành chữ vẫn chạy.</Notice>
      )}
      {!snap && conn !== 'lost' && <Loading />}
      {!snap && conn === 'lost' && <ErrorBox>Không kết nối được máy chủ — đang thử lại…</ErrorBox>}
      {snap && (
        <>
          <Counters snap={snap} />
          <PerMinute rows={snap.per_minute} />
          <div className="grid-2 live-grid">
            <div>
              <Working snap={snap} now={now} />
              <Extracting rows={snap.extracting} now={now} />
            </div>
            <Feed rows={snap.feed} />
          </div>
          <Recent rows={snap.recent} />
        </>
      )}
    </div>
  )
}

function Counters({ snap }) {
  const c = snap.counts
  const items = [
    { label: 'Chờ AI', value: c.pending, tone: 'warn' },
    { label: 'AI đang đọc', value: c.processing, tone: 'info' },
    { label: 'Đang tổng hợp', value: c.grouping, tone: 'info' },
    { label: 'Xong trong 60 phút', value: snap.done_last_hour, tone: 'good' },
    { label: 'Đã vào VCWIKI', value: c.done, tone: 'good' },
    { label: 'Lỗi AI', value: c.error, tone: c.error ? 'bad' : 'muted' },
  ]
  return (
    <section className="live-counters" aria-label="Bộ đếm tinh chế" aria-live="off">
      {items.map((i) => (
        <div key={i.label} className="live-counter" role="group" aria-label={`${i.label}: ${num(i.value)}`}>
          <Flash value={i.value} className={`live-counter-value tone-${i.tone}`}>{num(i.value)}</Flash>
          <div className="muted small">{i.label}</div>
        </div>
      ))}
    </section>
  )
}

// nháy nhẹ khi giá trị đổi
function Flash({ value, className, children }) {
  const prev = useRef(value)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (prev.current === value) return undefined
    prev.current = value
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 900)
    return () => clearTimeout(t)
  }, [value])
  return <div className={`${className} ${flash ? 'live-flash' : ''}`}>{children}</div>
}

const minuteKey = (ms) =>
  new Date(ms).toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).slice(0, 16).replace(' ', 'T')

function PerMinute({ rows }) {
  const by = Object.fromEntries(rows.map((r) => [r.minute, r]))
  const base = Date.now()
  const bars = Array.from({ length: 60 }, (_, i) => {
    const k = minuteKey(base - (59 - i) * 60000)
    return by[k] || { minute: k, docs: 0, cards: 0 }
  })
  const max = Math.max(1, ...bars.map((b) => b.docs))
  return (
    <section className="card live-minutes-card">
      <div className="card-head">
        <h2>60 phút qua</h2>
        <span className="muted small">tài liệu vào VCWIKI mỗi phút · {num(bars.reduce((a, b) => a + b.cards, 0))} thẻ</span>
      </div>
      <div className="live-minutes" role="img" aria-label={`Biểu đồ 60 phút qua: ${num(bars.reduce((a, b) => a + b.docs, 0))} tài liệu vào VCWIKI`}>
        {bars.map((b) => (
          <div key={b.minute} title={`${b.minute.slice(11)} — ${b.docs} tài liệu, ${b.cards} thẻ`}>
            <div style={{ height: `${(b.docs / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="live-minutes-axis muted small"><span>−60 phút</span><span>−30</span><span>bây giờ</span></div>
    </section>
  )
}

function Working({ snap, now }) {
  const empty = !snap.processing.length && !snap.synth_runs.length
  return (
    <section className="card">
      <div className="card-head"><h2>AI đang làm</h2></div>
      {empty && <Empty>Không có việc nào đang chạy.</Empty>}
      <ul className="list">
        {snap.processing.map((d) => (
          <li key={d.id} className="list-row">
            <span className="live-dot live-info" aria-hidden="true" />
            <div className="grow">
              <div className="strong clamp-1">{d.title}</div>
              <div className="muted small ellipsis">Dựng thẻ · {d.source_title} · {num(d.chars)} ký tự</div>
            </div>
            <span className="metric live-timer">{d.wiki_started_at ? clock((now - new Date(d.wiki_started_at)) / 1000) : '—'}</span>
          </li>
        ))}
        {snap.synth_runs.map((r) => <SynthRow key={r.id} r={r} />)}
      </ul>
    </section>
  )
}

function SynthRow({ r }) {
  const p = r.progress || {}
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
  const running = ['triaging', 'clustering', 'synthesizing'].includes(r.status)
  const step = { triaging: 'Sàng lọc', clustering: 'Gom cụm', synthesizing: 'Viết thẻ' }[r.status]
  return (
    <li className="live-synth" data-testid="refine-live-synth" data-id={r.id} data-status={r.status}>
      <Link to={`/wiki/synth/${r.id}`} className="list-row">
        <span className={`live-dot live-${running ? 'info' : 'muted'}`} aria-hidden="true" />
        <div className="grow">
          <div className="strong clamp-1">Tổng hợp: {r.source_title}</div>
          <div className="muted small">
            {num(r.doc_count)} tài liệu{r.kept_count > 0 && ` · giữ ${num(r.kept_count)}`}
            {r.cluster_count > 0 && ` · ${num(r.cluster_count)} cụm`}{r.card_count > 0 && ` · ${num(r.card_count)} thẻ`}
            {step && p.total > 0 && ` · ${step} ${num(p.done)}/${num(p.total)} (${pct}%)`}
            {r.status === 'synthesizing' && r.stage && ` · cụm “${r.stage}”`}
          </div>
          {running && p.total > 0 && (
            <div className="progress" role="progressbar" aria-label={`Tiến độ ${step || 'tổng hợp'}`} aria-valuemin={0} aria-valuemax={p.total}
              aria-valuenow={p.done} aria-valuetext={`${p.done}/${p.total}`}><div className="progress-bar progress-live" style={{ width: `${pct}%` }} /></div>
          )}
          {r.clusters.length > 0 && (
            <div className="live-clusters">
              {r.clusters.map((c, i) => <i key={i} title={`${c.title} — ${statusInfo('cluster', c.status).label}`} className="kb-cluster" data-k={c.status} />)}
            </div>
          )}
          {r.logs.length > 0 && <div className="muted small clamp-1">↳ {r.logs[r.logs.length - 1].msg}</div>}
        </div>
        <StatusBadge kind="synth" status={r.status} />
      </Link>
    </li>
  )
}

function Extracting({ rows, now }) {
  if (!rows.length) return null
  return (
    <section className="card">
      <div className="card-head"><h2>Chuyển thành chữ (tầng 1)</h2><span className="muted small">nguồn cho hàng chờ AI</span></div>
      <ul className="list">
        {rows.map((s) => {
          const p = s.progress || {}
          return (
            <li key={s.id} data-id={s.id} data-status={s.status}>
              <Link to={`/kb?source=${s.id}`} className="list-row">
                <div className="grow">
                  <div className="strong clamp-1">{s.title || s.file?.name || s.url}</div>
                  <div className="muted small">
                    {s.kind_label} · làn {s.lane === 'heavy' ? 'Whisper' : 'nhẹ'}
                    {s.status === 'extracting' && p.total > 0 && ` · ${num(p.processed)}/${num(p.total)}`}
                    {s.status === 'extracting' && s.started_at && ` · chạy ${duration((now - new Date(s.started_at)) / 1000)}`}
                  </div>
                  {s.status === 'extracting' && p.total > 0 && (
                    <div className="progress" role="progressbar" aria-label="Tiến độ trích xuất" aria-valuemin={0} aria-valuemax={p.total}
                      aria-valuenow={p.processed} aria-valuetext={`${p.processed}/${p.total}`}>
                      <div className="progress-bar progress-live" style={{ width: `${Math.round((p.processed / p.total) * 100)}%` }} />
                    </div>
                  )}
                </div>
                <StatusBadge kind="source" status={s.status} />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Feed({ rows }) {
  const seen = useRef(null)
  const keyOf = (f) => `${f.at}|${f.ref}|${f.msg}`
  // lần đầu: coi mọi dòng là cũ; sau đó dòng chưa thấy được tô sáng
  const fresh = seen.current ? new Set(rows.map(keyOf).filter((k) => !seen.current.has(k))) : new Set()
  useEffect(() => { seen.current = new Set(rows.map(keyOf)) })
  return (
    <section className="card live-feed-card">
      <div className="card-head"><h2>Nhật ký trực tiếp</h2><span className="muted small">6 giờ gần nhất</span></div>
      {rows.length === 0 && <Empty>Chưa có hoạt động.</Empty>}
      <ol className="live-feed" role="log" aria-live="polite" aria-label="Nhật ký trực tiếp" data-testid="refine-live-log">
        {rows.map((f) => (
          <li key={keyOf(f)} className={fresh.has(keyOf(f)) ? 'live-new' : ''}>
            <span className="live-feed-time">{time(f.at)}</span>
            <div className="grow">
              <div className={f.msg.startsWith('✗') ? 'tone-bad' : f.msg.startsWith('→') ? 'tone-good' : ''}>{f.msg}</div>
              <Link to={f.kind === 'synth' ? `/wiki/synth/${f.ref}` : `/kb?source=${f.ref}`} className="muted small ellipsis refine-src">
                {f.kind === 'synth' ? 'Tổng hợp · ' : ''}{f.title}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Recent({ rows }) {
  return (
    <section className="card table-wrap live-recent">
      <div className="card-head live-recent-head"><h2>Vừa vào VCWIKI</h2></div>
      {rows.length === 0 ? <Empty>Chưa có tài liệu nào.</Empty> : (
        <table className="table table-static" data-testid="refine-live-recent">
          <caption className="sr-only">Tài liệu vừa vào VCWIKI</caption>
          <thead>
            <tr><th scope="col">Tài liệu</th><th scope="col" className="num">Thẻ</th><th scope="col" className="num">Hữu ích</th><th scope="col" className="num">Thời gian AI</th><th scope="col" className="num">Token</th><th scope="col">Xong lúc</th></tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} data-id={d.id} data-status="done">
                <td className="cell-video">
                  <div className="strong clamp-1">{d.title}</div>
                  <Link to={`/kb?source=${d.source_id}`} className="muted small ellipsis refine-src">{d.source_title}</Link>
                </td>
                <td className="num">{num(d.card_count ?? 0)}</td>
                <td className="num">{d.relevance != null ? `${d.relevance}/10` : '—'}</td>
                <td className="num">{d.took_seconds != null ? duration(d.took_seconds) : '—'}</td>
                <td className="num small">{d.ai_usage ? num(d.ai_usage.input_tokens + d.ai_usage.output_tokens) : '—'}</td>
                <td className="small nowrap">{time(d.wiki_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

