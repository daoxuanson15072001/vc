import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { compact, duration } from '../format'
import { Badge, Empty, ErrorBox } from '../components/ui'
import { SpaceSelect } from '../components/pickers'

const PLATFORMS = [['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['google', 'Google']]
const PLATFORM_TONE = { TikTok: 'info', YouTube: 'bad', Google: 'good' }

// Nhập nội dung -> AI tách từ khoá -> tìm trên TikTok / YouTube / Google -> chọn video -> nạp vào Kho tư liệu
export default function Discover() {
  const { data: status } = useFetch(api.kbStatus, [])
  const { data: spaces } = useFetch(api.spaces, [])
  const [query, setQuery] = useState('')
  const [keywords, setKeywords] = useState([])
  const [newKw, setNewKw] = useState('')
  const [engine, setEngine] = useState(undefined)
  const [topic, setTopic] = useState('')
  const [maxVideos, setMaxVideos] = useState(0)
  const [platforms, setPlatforms] = useState(PLATFORMS.map(([k]) => k))
  const [perKeyword, setPerKeyword] = useState(5)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [found, setFound] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [filter, setFilter] = useState('')
  const [asking, setAsking] = useState(false)
  const [result, setResult] = useState(null)

  const analyze = async (e) => {
    e?.preventDefault()
    setBusy('keywords')
    setError(null)
    try {
      const r = await api.discoverKeywords({ query: query.trim(), count: 6 })
      setKeywords(r.keywords)
      setEngine(r.engine)
      setTopic(r.topic)
      setMaxVideos(r.max_videos)
      if (r.platforms.length) setPlatforms(r.platforms)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const addKw = (e) => {
    e.preventDefault()
    const k = newKw.trim()
    if (k && !keywords.includes(k)) setKeywords([...keywords, k])
    setNewKw('')
  }

  const search = async () => {
    setBusy('search')
    setError(null)
    setResult(null)
    try {
      const r = await api.discoverSearch({ topic, keywords, platforms, per_keyword: Number(perKeyword) || 5 })
      setFound(r)
      // Người dùng nói "lấy N video" -> chọn sẵn N video liên quan nhất; không thì chọn mọi video khá liên quan
      const fresh = r.items.filter((i) => !i.in_kb && (i.relevance == null || i.relevance >= 7))
      setSelected(new Set((maxVideos ? fresh.slice(0, maxVideos) : fresh).map((i) => i.url)))
      setFilter('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const shown = useMemo(() => (found?.items || []).filter((i) => !filter || i.platform === filter), [found, filter])
  const toggle = (url) => setSelected((s) => {
    const n = new Set(s)
    if (n.has(url)) n.delete(url)
    else n.add(url)
    return n
  })
  const allShown = shown.length > 0 && shown.every((i) => selected.has(i.url))
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    shown.forEach((i) => (allShown ? n.delete(i.url) : n.add(i.url)))
    return n
  })
  const picked = (found?.items || []).filter((i) => selected.has(i.url))
  const counts = (found?.items || []).reduce((m, i) => ({ ...m, [i.platform]: (m[i.platform] || 0) + 1 }), {})

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Tìm video theo chủ đề</h1>
          <p className="muted">
            Gõ nội dung cần tìm. AI tách thành các từ khoá, rồi tìm trên TikTok, YouTube và Google. Chọn video muốn lấy,
            hệ thống tải về và chuyển thành chữ trong <Link to="/kb" className="link">Kho tư liệu</Link>.
          </p>
        </div>
      </header>

      <section className="card stack">
        <form onSubmit={analyze} className="row row-wrap discover-query" role="search" aria-label="Tìm video theo chủ đề">
          <label className="field grow2">
            <span>Nội dung cần tìm</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={500}
              placeholder="vd: kinh nghiệm bảo dưỡng hộp số tự động cho xe cũ" />
          </label>
          <button className="btn btn-primary" disabled={busy || query.trim().length < 2} data-testid="discover-keywords-analyze">
            {busy === 'keywords' ? 'AI đang phân tích…' : '✦ Phân tích từ khoá'}
          </button>
        </form>

        {keywords.length > 0 && (
          <>
            <label className="field">
              <span>Chủ đề <em>(AI dùng để chấm video nào đúng ý)</em></span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={500} aria-label="Chủ đề" />
            </label>
            <div>
              <div className="strong">Từ khoá sẽ tìm <span className="muted small">
                {engine === null ? '— chưa có AI, dùng nguyên câu bạn gõ; thêm từ khoá tay bên dưới' : engine ? `— ${engine}` : ''}
              </span></div>
              <div className="chips" role="group" aria-label="Từ khoá sẽ tìm">
                {keywords.map((k) => (
                  <span key={k} className="chip">
                    {k}
                    <button type="button" aria-label={`Bỏ từ khoá ${k}`} title="Bỏ từ khoá" onClick={() => setKeywords(keywords.filter((x) => x !== k))}>✕</button>
                  </span>
                ))}
                <form onSubmit={addKw}>
                  <input className="tag-input" value={newKw} onChange={(e) => setNewKw(e.target.value)} placeholder="+ thêm từ khoá" aria-label="Thêm từ khoá" />
                </form>
              </div>
            </div>
            <div className="row row-wrap discover-options">
              <div className="field" role="group" aria-labelledby="discover-platforms">
                <span id="discover-platforms">Tìm trên</span>
                <span className="inline">
                  {PLATFORMS.map(([k, label]) => (
                    <label key={k} className="check">
                      <input type="checkbox" checked={platforms.includes(k)}
                        onChange={(e) => setPlatforms(e.target.checked ? [...platforms, k] : platforms.filter((p) => p !== k))} /> {label}
                    </label>
                  ))}
                </span>
              </div>
              <label className="field field-sm">
                <span>Chọn sẵn</span>
                <input type="number" min="0" max="50" value={maxVideos} onChange={(e) => setMaxVideos(Number(e.target.value) || 0)} />
                <small>video đầu · 0 = mọi video khớp</small>
              </label>
              <label className="field field-sm">
                <span>Video / từ khoá</span>
                <input type="number" min="1" max="20" value={perKeyword} onChange={(e) => setPerKeyword(e.target.value)} />
                <small>mỗi nền tảng</small>
              </label>
              <button className="btn btn-primary" disabled={busy || !platforms.length} onClick={search} data-testid="discover-videos-search">
                {busy === 'search' ? 'Đang tìm…' : `⌕ Tìm video (${keywords.length} từ khoá)`}
              </button>
            </div>
          </>
        )}
        <ErrorBox>{error}</ErrorBox>
        {busy === 'search' && <div className="current" role="status" aria-busy="true"><span className="pulse" />Đang tìm trên {platforms.length} nền tảng — thường mất 10–40 giây.</div>}
      </section>

      {found && (
        <section className="card table-wrap discover-results" aria-label="Kết quả tìm video">
          <div className="toolbar discover-toolbar">
            <div className="tabs" role="group" aria-label="Lọc kết quả theo nền tảng">
              <button className={!filter ? 'active' : ''} aria-pressed={!filter} onClick={() => setFilter('')}>Tất cả ({found.items.length})</button>
              {Object.entries(counts).map(([p, n]) => (
                <button key={p} className={filter === p ? 'active' : ''} aria-pressed={filter === p} onClick={() => setFilter(p)}>{p} ({n})</button>
              ))}
            </div>
            <span className="muted small">
              {found.ranked_by ? `Xếp theo độ liên quan (${found.ranked_by})` : 'Xếp theo số từ khoá khớp'}
              {platforms.includes('google') && ` · Google tìm qua ${found.google_via}`}
            </span>
          </div>
          {Object.entries(found.errors).map(([p, msg]) => (
            <div key={p} className="notice">{PLATFORMS.find(([k]) => k === p)?.[1]}: {msg}</div>
          ))}
          {shown.length === 0 ? <Empty>Không tìm thấy video nào — thử từ khoá khác.</Empty> : (
            <table className="table table-static" data-testid="discover-results">
              <caption className="sr-only">Video tìm được — đánh dấu video muốn tải về rồi bấm “Tải về & chuyển chữ”</caption>
              <thead>
                <tr>
                  <th scope="col"><input type="checkbox" aria-label="Chọn tất cả" checked={allShown} onChange={toggleAll} /></th>
                  {found.ranked_by && <th scope="col" className="num" title="AI chấm tiêu đề so với chủ đề, 0–10">Liên quan</th>}
                  <th scope="col">Video</th>
                  <th scope="col">Kênh</th>
                  <th scope="col" className="num">Xem</th>
                  <th scope="col" className="num">Dài</th>
                  <th scope="col">Khớp từ khoá</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.url} className={selected.has(i.url) ? 'active' : ''} data-testid="discover-result-row" data-id={i.url}
                    data-kind={i.platform} data-status={i.in_kb || 'new'}>
                    <td><input type="checkbox" aria-label={`Chọn để nạp: ${i.title || i.url}`} data-testid="discover-result-pick" checked={selected.has(i.url)} onChange={() => toggle(i.url)} /></td>
                    {found.ranked_by && <td className="num"><Badge tone={i.relevance >= 7 ? 'good' : i.relevance >= 4 ? 'warn' : 'muted'}>{i.relevance ?? '—'}</Badge></td>}
                    <td>
                      <div className="discover-video">
                        {i.thumbnail ? <img src={i.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="discover-thumb" />}
                        <div className="grow">
                          <a className="link clamp-2" href={i.url} target="_blank" rel="noreferrer" title="Mở video (tab mới)">{i.title || i.url}</a>
                          <div className="small">
                            <Badge tone={PLATFORM_TONE[i.platform] || 'muted'}>{i.platform}</Badge>
                            {i.found_on.filter((f) => f !== i.platform).map((f) => <span key={f} className="muted"> · qua {f}</span>)}
                            {i.in_kb === 'done' && <> <Badge tone="good">Đã chuyển chữ</Badge></>}
                            {i.in_kb === 'added' && <> <Badge tone="muted">Đã nạp</Badge></>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="small">
                      {i.channel_url ? <a className="link" href={i.channel_url} target="_blank" rel="noreferrer">{i.channel || i.channel_url.split('/').pop()}</a> : (i.channel || '—')}
                      {i.channel_in_kb && <div><Badge tone="muted">Kênh đã nạp</Badge></div>}
                    </td>
                    <td className="num">{i.views != null ? compact(i.views) : '—'}</td>
                    <td className="num">{i.duration ? duration(i.duration) : '—'}</td>
                    <td className="small muted">{i.keywords.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="table-foot">
            <span className="muted small" role="status">Đã chọn {picked.length} video</span>
            <button className="btn btn-primary" disabled={!picked.length} onClick={() => setAsking(true)} data-testid="discover-videos-intake"
              aria-label={`Tải về & chuyển chữ ${picked.length} video đã chọn`}>⤓ Tải về & chuyển chữ…</button>
          </div>
          {result && <IntakeResult r={result} />}
        </section>
      )}

      {asking && status && spaces && (
        <IntakeDialog picked={picked} query={query} status={status} spaces={spaces} maxLinks={found.max_links}
          onClose={() => setAsking(false)}
          onDone={(r) => { setAsking(false); setResult(r); setSelected(new Set()) }} />
      )}
    </>
  )
}

// Hỏi trước khi nạp: chỉ các video đã chọn, hay crawl luôn cả kênh chứa video
function IntakeDialog({ picked, query, status, spaces, maxLinks, onClose, onDone }) {
  const personal = spaces.find((s) => s.type === 'personal' && s.my_role === 'owner')
  const channels = useMemo(() => {
    const m = new Map()
    picked.forEach((i) => i.channel_url && !m.has(i.channel_url) && m.set(i.channel_url, { url: i.channel_url, name: i.channel, platform: i.platform, known: i.channel_in_kb }))
    return [...m.values()]
  }, [picked])
  const [crawl, setCrawl] = useState('videos')
  const [chosen, setChosen] = useState(() => new Set(channels.map((c) => c.url)))
  const [limit, setLimit] = useState(20)
  const [spaceId, setSpaceId] = useState(personal?.id || '')
  const [language, setLanguage] = useState('auto')
  const [buildWiki, setBuildWiki] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const noChannel = picked.length - picked.filter((i) => i.channel_url).length
  const titleId = useId()

  const send = async (urls, options) => {
    const total = { created: [], duplicates: [], requeued: [] }
    for (let i = 0; i < urls.length; i += maxLinks) {
      const r = await api.addLinks({ space_id: spaceId, urls: urls.slice(i, i + maxLinks), tags: [], categories: [], note: `Tìm theo chủ đề: “${query.trim()}”`, options })
      Object.keys(total).forEach((k) => total[k].push(...(r[k] || [])))
    }
    return total
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const base = { language, build_wiki: buildWiki }
      const r = { videos: await send(picked.map((i) => i.url), { ...base, limit: 1 }), channels: null }
      if (crawl === 'channels' && chosen.size) r.channels = await send([...chosen], { ...base, limit: Number(limit) || 0 })
      onDone(r)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <>
      <div className="overlay" onClick={busy ? undefined : onClose} aria-hidden="true" />
      <div className="card modal discover-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy}
        data-testid="discover-intake-dialog">
        <div className="card-head">
          <h2 id={titleId}>Tải {picked.length} video về kho</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={`Đóng: tải ${picked.length} video về kho`} title="Đóng" disabled={busy}>✕</button>
        </div>
        {busy && <p className="small muted" role="status">Đang nạp, không thể đóng — chờ xong.</p>}

        <fieldset className="field">
          <span>Có crawl cả kênh chứa video không?</span>
          <label className="check"><input type="radio" name="crawl" checked={crawl === 'videos'} onChange={() => setCrawl('videos')} /> Không — chỉ tải {picked.length} video đã chọn</label>
          <label className="check">
            <input type="radio" name="crawl" checked={crawl === 'channels'} disabled={!channels.length} onChange={() => setCrawl('channels')} />
            {' '}Có — tải thêm video khác trong {channels.length} kênh chứa các video này
          </label>
          {noChannel > 0 && <small>{noChannel} video không rõ kênh, chỉ tải video đó.</small>}
        </fieldset>

        {crawl === 'channels' && (
          <>
            <label className="field field-sm">
              <span>Video tối đa / kênh</span>
              <input type="number" min="0" max="5000" value={limit} onChange={(e) => setLimit(e.target.value)} />
              <small>mới nhất trước · 0 = tất cả (có thể rất lâu)</small>
            </label>
            <ul className="list discover-channels" aria-label="Kênh sẽ crawl">
              {channels.map((c) => (
                <li key={c.url} className="list-row">
                  <input type="checkbox" aria-label={`Crawl kênh ${c.name || c.url}`} checked={chosen.has(c.url)}
                    onChange={() => setChosen((s) => { const n = new Set(s); if (n.has(c.url)) n.delete(c.url); else n.add(c.url); return n })} />
                  <Badge tone={PLATFORM_TONE[c.platform] || 'muted'}>{c.platform}</Badge>
                  <a className="link grow ellipsis" href={c.url} target="_blank" rel="noreferrer">{c.name || c.url}</a>
                  {c.known && <span className="small muted">đã nạp — quét video mới</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="row row-wrap">
          <label className="field">
            <span>Lưu vào kho</span>
            <SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly />
          </label>
          <label className="field field-sm">
            <span>Ngôn ngữ lời nói</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Ngôn ngữ lời nói">
              {status.languages.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
        </div>
        <label className="check"><input type="checkbox" checked={buildWiki} onChange={(e) => setBuildWiki(e.target.checked)} /> Dựng thẻ VCWIKI sau khi chuyển chữ</label>

        <ErrorBox>{error}</ErrorBox>
        <div className="form-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Huỷ</button>
          <button className="btn btn-primary" disabled={busy || !spaceId || (crawl === 'channels' && !chosen.size)} onClick={submit}
            data-testid="discover-intake-submit">
            {busy ? 'Đang nạp…' : crawl === 'channels' ? `Tải video + ${chosen.size} kênh` : `Tải ${picked.length} video`}
          </button>
        </div>
      </div>
    </>
  )
}

function IntakeResult({ r }) {
  const line = (x, what) => x && (
    <div>
      {x.created.length > 0 && <span className="tone-good">✓ Đã nạp {x.created.length} {what}. </span>}
      {x.requeued.length > 0 && <span className="tone-good">⟳ Quét lại {x.requeued.length} {what} đã có. </span>}
      {x.duplicates.length > 0 && <span className="muted">{x.duplicates.length} {what} đã có trong kho, bỏ qua. </span>}
    </div>
  )
  return (
    <div className="result small discover-result" role="status">
      {line(r.videos, 'video')}
      {line(r.channels, 'kênh')}
      <Link className="link" to="/kb">Xem tiến độ trong Kho tư liệu ›</Link>
    </div>
  )
}
