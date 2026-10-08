import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { CARD_STATUS, CARD_TYPE, dateTime, num } from '../format'
import { unaccentLower } from '../text'
import { Badge, Empty, ErrorBox, Loading, SrOnly } from '../components/ui'
import { buildTree, SpaceSelect } from '../components/pickers'
import { ForceGraph, topicColor } from '../components/graph'
import { PageHeader } from '../components/PageHeader'
import { WikiTabs } from './wiki/WikiTabs'

const KEYS = ['space_id', 'category', 'status']
const LAYERS = [
  { key: 'category', label: 'Lĩnh vực', kinds: ['category', 'parent'] },
  { key: 'tag', label: 'Tag', kinds: ['tag'] },
  { key: 'source', label: 'Cùng nguồn', kinds: ['source'] },
  { key: 'topic', label: 'Chủ đề AI', kinds: ['topic'] },
  { key: 'ai', label: 'Liên kết AI', kinds: ['ai'] },
]
const NODE_LAYER = { category: 'category', tag: 'tag', topic: 'topic' }

export default function WikiGraph() {
  const [params, setParams] = useSearchParams()
  const f = Object.fromEntries(KEYS.map((k) => [k, params.get(k) || '']))
  const navigate = useNavigate()
  const [layers, setLayers] = useState({ category: true, tag: false, source: true, topic: true, ai: true })
  // nút đang chọn phản chiếu lên URL ?node= (gửi link / agent mở thẳng một nút)
  const selected = params.get('node') || null
  const setSelected = (id) => {
    const next = new URLSearchParams(params)
    if (id) next.set('node', id); else next.delete('node')
    setParams(next, { replace: true })
  }
  const [focus, setFocus] = useState(() => params.get('node'))
  const [listView, setListView] = useState(false)   // bảng tương đương đồ thị cho trình đọc màn hình / AI agent
  const [q, setQ] = useState('')
  const [runError, setRunError] = useState(null)

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    next.delete('node')
    setParams(next, { replace: true })
  }

  const { data: cats } = useFetch(api.categories, [])
  const { data: spaces } = useFetch(api.spaces, [])
  const { data, error, reload } = useFetch(() => api.wikiGraph(f), [JSON.stringify(f)])
  const running = data?.run?.status === 'running'
  useEffect(() => {  // AI đang chạy: hỏi lại, chỉ vẽ lại đồ thị khi xong (tránh xáo trộn bố cục mỗi lần hỏi)
    if (!running) return undefined
    const t = setInterval(async () => {
      const d = await api.wikiGraph(f).catch(() => null)
      if (d && d.run?.status !== 'running') reload()
    }, 3000)
    return () => clearInterval(t)
  }, [running, JSON.stringify(f)]) // eslint-disable-line react-hooks/exhaustive-deps

  const catOptions = useMemo(() => {
    const out = []
    const walk = (list, depth) => list.forEach((c) => { out.push({ slug: c.slug, label: `${'  '.repeat(depth)}${c.name}` }); walk(c.children, depth + 1) })
    walk(buildTree(cats || []), 0)
    return out
  }, [cats])

  const kinds = new Set(LAYERS.filter((l) => layers[l.key]).flatMap((l) => l.kinds))
  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] }
    const n = data.nodes.filter((x) => x.kind === 'card' || layers[NODE_LAYER[x.kind]])
    return { nodes: n, edges: data.edges.filter((e) => kinds.has(e.kind)) }
  }, [data, JSON.stringify(layers)]) // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    const term = unaccentLower(q.trim())
    return term ? new Set(nodes.filter((n) => unaccentLower(n.label).includes(term)).map((n) => n.id)) : null
  }, [q, nodes])

  const byId = useMemo(() => new Map((data?.nodes || []).map((n) => [n.id, n])), [data])
  const open = (id) => id?.startsWith('c:') && navigate(`/wiki?card=${id.slice(2)}`)
  const pick = (id) => { setSelected(id); if (id) setFocus(id) }

  const analyze = async () => {
    setRunError(null)
    try {
      await api.analyzeGraph({ space_id: f.space_id || null, category: f.category || null })
      await reload()
    } catch (e) { setRunError(e.message) }
  }

  const map = data?.map
  const run = data?.run
  const canRun = data?.can_analyze && (map ? map.can_run : run ? run.can_run : true)
  const cardCount = data?.nodes.filter((n) => n.kind === 'card').length

  return (
    <>
      <PageHeader title="Bản đồ tri thức" actions={
        <>
          <a className="ui-btn" href={api.vaultUrl(f)} download title="Tải về, giải nén rồi mở bằng Obsidian (Open folder as vault)">⤓ Xuất Obsidian vault</a>
          <button type="button" className="ui-btn ui-btn-primary" onClick={analyze} disabled={running || !canRun}
            title={!data?.can_analyze ? 'AI chưa sẵn sàng (thiếu ANTHROPIC_API_KEY)' : !canRun ? 'Cần quyền sửa kho để chạy lại' : ''}>
            {running ? 'AI đang phân tích…' : map ? '✦ Phân tích lại bằng AI' : '✦ AI phân tích chủ đề'}
          </button>
        </>
      } description={<>
        Đồ thị VCWIKI kiểu Obsidian — mỗi chấm là một thẻ, nối với lĩnh vực, tag, chủ đề và thẻ liên quan.{' '}
        {data && <>{num(cardCount)} thẻ{data.truncated && ` (trong ${num(data.card_total)} — thu hẹp phạm vi để xem hết)`}.</>}
      </>} />
      <WikiTabs />

      <form className="filters card" role="search" aria-label="Lọc đồ thị" onSubmit={(e) => e.preventDefault()}>
        <input className="search" type="search" aria-label="Tìm nút trên đồ thị" placeholder="Tìm nút trên đồ thị — Enter để đến kết quả đầu"
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && matches?.size && pick([...matches][0])} />
        <SpaceSelect spaces={spaces} value={f.space_id} onChange={(v) => update({ space_id: v })} allowAll />
        <select value={f.category} onChange={(e) => update({ category: e.target.value })} aria-label="Lĩnh vực">
          <option value="">Mọi lĩnh vực</option>
          {catOptions.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>
        <select value={f.status} onChange={(e) => update({ status: e.target.value })} aria-label="Trạng thái">
          <option value="">Nháp + đã duyệt</option>
          {Object.entries(CARD_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="graph-layers" role="group" aria-label="Lớp liên kết hiển thị">
          {LAYERS.map((l) => (
            <label key={l.key} className="check">
              <input type="checkbox" checked={layers[l.key]} onChange={(e) => setLayers({ ...layers, [l.key]: e.target.checked })} />
              {l.label}
            </label>
          ))}
        </div>
      </form>

      <ErrorBox>{error || runError || (run?.status === 'error' && `AI phân tích lỗi: ${run.error}`)}</ErrorBox>
      {!data && !error && <Loading />}
      {data && cardCount === 0 && <Empty>Chưa có thẻ nào trong phạm vi này.</Empty>}

      {data && cardCount > 0 && (
        <div className="graph-layout">
          <ForceGraph nodes={nodes} edges={edges} selected={selected} focus={focus} highlight={matches}
            onSelect={setSelected} onOpen={open}
            summary={`${num(cardCount)} thẻ, ${num(nodes.length)} nút, ${num(edges.length)} liên kết — xem bảng tương đương bằng nút "Xem dạng danh sách"`} />
          <aside className="card graph-side">
            {selected && byId.get(selected)
              ? <NodePanel node={byId.get(selected)} data={data} byId={byId} onPick={pick} onClose={() => setSelected(null)} />
              : <TopicPanel map={map} run={run} onPick={pick} />}
          </aside>
        </div>
      )}
      {data && cardCount > 0 && (
        <div style={{ marginTop: 12 }}>
          <button className="btn" type="button" aria-expanded={listView} aria-controls="graph-list" data-testid="graph-list-toggle"
            onClick={() => setListView(!listView)}>{listView ? 'Ẩn dạng danh sách' : 'Xem dạng danh sách'}</button>
          {listView && <NodeTable id="graph-list" nodes={nodes} edges={edges} byId={byId} matches={matches} selected={selected} onPick={pick} />}
        </div>
      )}
    </>
  )
}

const KIND_LABEL = { card: 'Thẻ', category: 'Lĩnh vực', tag: 'Tag', topic: 'Chủ đề AI' }
const TABLE_MAX = 500

// Bảng tương đương đồ thị: mỗi nút một hàng (tên, loại, lĩnh vực, số liên kết), theo đúng lớp đang bật và ô tìm
function NodeTable({ id, nodes, edges, byId, matches, selected, onPick }) {
  const rows = useMemo(() => {
    const deg = new Map()
    const cats = new Map()
    for (const e of edges) {
      deg.set(e.s, (deg.get(e.s) || 0) + 1)
      deg.set(e.t, (deg.get(e.t) || 0) + 1)
      for (const [a, b] of [[e.s, e.t], [e.t, e.s]]) {
        if (byId.get(b)?.kind === 'category' && byId.get(a)?.kind === 'card') (cats.get(a) || cats.set(a, []).get(a)).push(byId.get(b).label)
      }
    }
    return nodes.filter((n) => !matches || matches.has(n.id))
      .map((n) => ({ n, deg: deg.get(n.id) || 0, cats: [...new Set(cats.get(n.id) || [])] }))
      .sort((a, b) => b.deg - a.deg || a.n.label.localeCompare(b.n.label))
  }, [nodes, edges, byId, matches])
  const shown = rows.slice(0, TABLE_MAX)
  return (
    <section id={id} className="card table-wrap" style={{ marginTop: 8 }} aria-label="Đồ thị dạng danh sách">
      <table className="table" data-testid="graph-list">
        <caption className="sr-only">Các nút trên đồ thị ({rows.length}{rows.length > TABLE_MAX ? `, hiện ${TABLE_MAX} nút nhiều liên kết nhất` : ''})</caption>
        <thead>
          <tr><th scope="col">Tên</th><th scope="col">Loại</th><th scope="col">Lĩnh vực</th><th scope="col">Số liên kết</th></tr>
        </thead>
        <tbody>
          {shown.map(({ n, deg, cats }) => (
            <tr key={n.id} data-id={n.id} data-kind={n.kind} className={n.id === selected ? 'active' : ''}>
              <td>
                <button className="link" type="button" onClick={() => onPick(n.id)} aria-pressed={n.id === selected}>{n.label}</button>
                {n.kind === 'card' && <> · <Link className="link small" to={`/wiki?card=${n.id.slice(2)}`}>mở thẻ<SrOnly> {n.label}</SrOnly></Link></>}
              </td>
              <td>{n.kind === 'card' ? CARD_TYPE[n.type] || 'Thẻ' : KIND_LABEL[n.kind] || n.kind}</td>
              <td>{n.kind === 'card' ? cats.join(', ') || '—' : n.kind === 'category' ? n.full || n.label : '—'}</td>
              <td>{num(deg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > TABLE_MAX && <p className="small muted">Còn {num(rows.length - TABLE_MAX)} nút — lọc hoặc tìm để thu hẹp.</p>}
    </section>
  )
}

function Legend() {
  return (
    <div className="graph-legend small muted">
      <span><i style={{ background: 'var(--muted)' }} />Thẻ (● rỗng = nháp)</span>
      <span><i style={{ background: 'var(--info)' }} />Lĩnh vực</span>
      <span><i style={{ background: 'var(--good)' }} />Tag</span>
      <span><i className="dash" />Liên kết AI</span>
      <span>Cuộn: phóng to · kéo: di chuyển · bấm đúp thẻ: mở</span>
    </div>
  )
}

function TopicPanel({ map, run, onPick }) {
  if (!map) {
    return (
      <>
        <h3 style={{ marginTop: 0 }}>Chủ đề AI</h3>
        {run?.status === 'running'
          ? <p className="muted">AI đang đọc {num(run.card_count)} thẻ để gom chủ đề và tìm liên kết… thường mất 1–2 phút.</p>
          : <p className="muted">Bấm <b>✦ AI phân tích chủ đề</b> để Claude gom các thẻ thành chủ đề, tìm cặp thẻ nên đọc cùng nhau và nhận xét chỗ kho còn mỏng.</p>}
        <Legend />
      </>
    )
  }
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Chủ đề AI · {map.topics.length}</h3>
      <p className="small">{map.overview}</p>
      <div className="muted small">
        {map.created_by_name} · {dateTime(map.finished_at || map.created_at)} · {num(map.card_count)} thẻ
        {run?.status === 'running' && ' · đang phân tích lại…'}
      </div>
      <ul className="topic-list">
        {map.topics.map((t) => (
          <li key={t.key}>
            <button className="topic-item" onClick={() => onPick(`p:${t.key}`)} disabled={!t.count}>
              <i style={{ background: topicColor(t.key) }} aria-hidden="true" />
              <span className="grow">
                <span className="strong">{t.name}</span> <span className="muted small">{t.count}</span>
                <span className="muted small clamp-2">{t.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Legend />
    </>
  )
}

function NodePanel({ node, data, byId, onPick, onClose }) {
  const isCard = node.kind === 'card'
  const { data: card } = useFetch(() => (isCard ? api.card(node.id.slice(2)) : Promise.resolve(null)), [node.id])
  const links = data.edges.filter((e) => e.s === node.id || e.t === node.id)
    .map((e) => ({ ...e, other: byId.get(e.s === node.id ? e.t : e.s) })).filter((e) => e.other)
  const ai = links.filter((e) => e.kind === 'ai')
  const neighborCards = links.filter((e) => e.kind !== 'ai' && e.other.kind === 'card')
  const groups = links.filter((e) => e.other.kind !== 'card')
  const topic = node.kind === 'topic' ? data.map?.topics.find((t) => t.key === node.topic) : null
  const kindLabel = { card: CARD_TYPE[node.type] || 'Thẻ', category: 'Lĩnh vực', tag: 'Tag', topic: 'Chủ đề AI' }[node.kind]

  return (
    <>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="muted small">{kindLabel}{node.full && node.full !== node.label ? ` · ${node.full}` : ''}</div>
          <h2>{node.label}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Đóng bảng chi tiết nút" title="Đóng">✕</button>
      </div>
      {isCard && (
        <>
          <div className="meta-line">
            <Badge tone={CARD_STATUS[node.status]?.tone}>{CARD_STATUS[node.status]?.label}</Badge>
            {card?.space_name && <span>{card.space_name}</span>}
          </div>
          {card && <p className="small">{card.summary}</p>}
          <Link className="btn btn-primary" to={`/wiki?card=${node.id.slice(2)}`} data-testid="graph-card-open">Mở thẻ</Link>
        </>
      )}
      {topic && <p className="small">{topic.description}</p>}
      {groups.length > 0 && (
        <div className="chips" style={{ marginTop: 10 }}>
          {groups.map((e) => (
            <button key={e.other.id} className="chip chip-btn" onClick={() => onPick(e.other.id)}
              style={e.other.kind === 'topic' ? { background: topicColor(e.other.topic), color: '#fff' } : undefined}>
              {e.other.label}
            </button>
          ))}
        </div>
      )}
      {ai.length > 0 && (
        <>
          <h3>Liên quan (AI gợi ý)</h3>
          <ul className="graph-links">
            {ai.map((e) => (
              <li key={e.other.id}><button className="link" onClick={() => onPick(e.other.id)}>{e.other.label}</button>
                <div className="muted small">{e.reason}</div></li>
            ))}
          </ul>
        </>
      )}
      {neighborCards.length > 0 && (
        <>
          <h3>{isCard ? 'Cùng tài liệu gốc' : `Thẻ · ${neighborCards.length}`}</h3>
          <ul className="graph-links">
            {neighborCards.slice(0, 100).map((e) => (
              <li key={e.other.id}><button className="link" onClick={() => onPick(e.other.id)}>{e.other.label}</button></li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
