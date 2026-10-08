import { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { CAMPAIGN_STAGE, CARD_STATUS, CARD_TYPE, CHANNEL, FLOW, clock, dateTime, num } from '../format'
import { Badge, Empty, ErrorBox, Loading } from '../components/ui'
import { confirmDialog } from '../components/dialog'
import { toast } from '../components/toast'
import { CampaignStatus, RefTable } from './Studio'
import { ProjectAssign } from './QuickWrite'
import { Markdown } from '../components/markdown'
import { FacebookPublish } from '../components/facebookPublish'

const BUSY = ['queued', 'generating']
const REVIEW = { draft: { label: 'Nháp', tone: 'warn' }, approved: { label: 'Đã duyệt', tone: 'good' }, rejected: { label: 'Loại', tone: 'muted' } }
// Tab kế hoạch của luồng video giữ khoá 'plan' để link cũ (?tab=plan) vẫn mở đúng
const FLOW_TAB = { video: 'plan', seo: 'seo', social: 'social' }

export const List = ({ items }) => (items?.length ? <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">—</p>)

export default function Campaign() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'strategy'
  const openScript = params.get('script')
  const [interval, setInterval_] = useState(0)
  const { data: c, error, reload, setData } = useFetch(() => api.campaign(id), [id], interval)
  const [actionError, setActionError] = useState(null)

  const busy = c && (BUSY.includes(c.status) || c.scripts.some((s) => BUSY.includes(s.status)))
  useEffect(() => setInterval_(busy ? 4000 : 0), [busy])

  const setQuery = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }
  const run = async (fn) => {
    setActionError(null)
    try {
      const res = await fn()
      if (res && res.id === id) setData(res)
      else reload()
      return true
    } catch (e) {
      setActionError(e.message)
      return false
    }
  }

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!c) return <Loading />
  const st = c.strategy || {}
  const dna = Object.fromEntries((st.reference_analysis || []).map((d) => [d.ref, d]))
  // Luồng không chọn khi lập chiến dịch vẫn hiện tab nếu có nội dung nhân bản sang
  const shownFlows = Object.keys(FLOW).filter((f) => c.flows.includes(f) || c.scripts.some((s) => s.flow === f))
  const tabs = [['strategy', 'Chiến lược'], ['campaign', 'Chiến dịch'],
    ...shownFlows.map((f) => [FLOW_TAB[f], `${FLOW[f].label}${c.plans[f] ? ` (${c.plans[f].episodes.length})` : ''}`]),
    ['refs', 'Tham chiếu']]
  const tabFlow = Object.keys(FLOW_TAB).find((f) => FLOW_TAB[f] === tab)

  return (
    <>
      <Link className="crumb link" to="/studio">‹ Xưởng chiến dịch</Link>
      <header className="page-head">
        <div>
          <h1>{c.name}</h1>
          <p className="muted">
            <CampaignStatus s={c.overall} /> · {c.space_name} · {c.created_by_name} · {dateTime(c.created_at)}
            {c.project_id && <> · Dự án: <Link className="link" to={`/studio/projects/${c.project_id}`}>{c.project_name}</Link></>}
          </p>
          {c.can_edit && <ProjectAssign spaceId={c.space_id} value={c.project_id} onChange={(v) => run(() => api.patchCampaign(id, { project_id: v }))} />}
          <p className="muted small">
            {c.brief.weeks} tuần · {c.flows.map((f) => `${c.targets[f]} ${f === 'video' ? 'tập video' : FLOW[f].unit + ' ' + (f === 'seo' ? 'SEO' : 'MXH')}`).join(' + ')}
            {' · '}{c.cards.length} thẻ VCWIKI
          </p>
        </div>
        <div className="actions">
          <a className="btn" href={api.campaignExportUrl(id)} download>⭳ Xuất hồ sơ (.md)</a>
          {c.can_edit && !BUSY.includes(c.status) && (
            <>
              {c.strategy && (
                <button className="btn btn-ghost" data-testid="campaign-plan-regenerate" onClick={async () => {
                  if (await confirmDialog({ title: 'Giữ chiến lược, lập lại kế hoạch mọi luồng?', okLabel: 'Lập lại kế hoạch' })) run(() => api.regenerateCampaign(id, 'plan'))
                }}>Lập lại kế hoạch</button>
              )}
              <button className="btn btn-ghost" data-testid="campaign-all-regenerate" onClick={async () => {
                if (await confirmDialog({ title: 'AI lập lại toàn bộ chiến lược + kế hoạch?', body: 'Nội dung đã viết được giữ.', okLabel: 'Lập lại tất cả' })) run(() => api.regenerateCampaign(id, 'all'))
              }}>Lập lại tất cả</button>
            </>
          )}
          {c.can_edit && (
            <button className="btn btn-ghost btn-danger-text" aria-label={`Xoá chiến dịch: ${c.name}`} data-testid="campaign-delete"
              onClick={async () => {
                if (!(await confirmDialog({ title: 'Xoá chiến dịch và mọi nội dung của nó?', body: c.name, okLabel: 'Xoá chiến dịch', danger: true }))) return
                if (await run(() => api.deleteCampaign(id))) navigate('/studio')
              }}>Xoá</button>
          )}
        </div>
      </header>
      <ErrorBox>{actionError}</ErrorBox>

      {BUSY.includes(c.status) && (
        <div className="current" role="status">
          <span className="pulse" />
          {c.status === 'queued' ? 'Đang chờ AI…' : `AI đang làm: ${CAMPAIGN_STAGE[c.stage] || '…'}`}
          <span className="muted small">— thường mất 2–6 phút mỗi luồng, trang tự cập nhật.</span>
        </div>
      )}
      {c.overall === 'waiting_ai' && <div className="notice">Máy chủ chưa có <code>ANTHROPIC_API_KEY</code> — chiến dịch sẽ tự chạy khi được cấu hình.</div>}
      {c.status === 'error' && <ErrorBox>Lỗi khi lập chiến dịch: {c.error}</ErrorBox>}

      <div className="tabs tabs-top">
        {tabs.map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} aria-pressed={tab === k} data-testid={`campaign-tab-${k}`} onClick={() => setQuery({ tab: k })}>{label}</button>
        ))}
      </div>

      {tab === 'strategy' && (st.strategy ? <StrategyTab st={st} /> : <Empty>Chiến lược chưa có — AI đang lập hoặc chờ chạy.</Empty>)}
      {tab === 'campaign' && (st.campaign ? <CampaignTab cp={st.campaign} /> : <Empty>Chiến dịch chưa có — AI đang lập hoặc chờ chạy.</Empty>)}
      {tabFlow && (c.plans[tabFlow] || c.scripts.some((s) => s.flow === tabFlow)
        ? <PlanTab c={c} flow={tabFlow} onOpen={(sid) => setQuery({ script: sid })} run={run} />
        : <Empty>Kế hoạch {FLOW[tabFlow].label.toLowerCase()} chưa có — AI lập sau bước chiến lược.</Empty>)}
      {tab === 'refs' && <RefsTab c={c} dna={dna} />}

      {openScript && <ScriptDrawer id={openScript} campaign={c} onClose={() => setQuery({ script: '' })} onChanged={reload} onOpen={(sid) => setQuery({ script: sid })} />}
    </>
  )
}

function describeFilter(f) {
  if (!f) return '—'
  if (f.video_ids?.length) return `chọn tay ${f.video_ids.length} video`
  return [f.q && `“${f.q}”`, f.channel && `@${f.channel}`, f.tag && `#${f.tag}`, `top ${f.limit}`].filter(Boolean).join(' · ')
}

function RefsTab({ c, dna }) {
  return (
    <div className="stack">
      {c.references.length > 0 && (
        <section className="card">
          <h2>Video tham chiếu</h2>
          <p className="muted small">Ảnh chụp lúc tạo chiến dịch{c.strategy ? ' · ADN viral do AI mổ xẻ' : ''}. Bộ lọc: {describeFilter(c.reference_filter)}</p>
          <RefTable items={c.references} dna={c.strategy ? dna : null} />
        </section>
      )}
      {c.flows.includes('seo') && (
        <section className="card">
          <h2>Trang đối thủ (SEO)</h2>
          <p className="muted small">{c.site_url_count} URL website dùng làm link nội bộ{c.sitemap_error ? ` · ${c.sitemap_error}` : ''}.</p>
          {c.competitors.length === 0 ? <p className="muted">Không dán trang đối thủ nào — AI phân tích chỉ từ từ khoá.</p> : (
            <ul className="list">
              {c.competitors.map((p) => (
                <li key={p.ref} className="list-row">
                  <b>{p.ref}</b>
                  {p.status === 'pending' && <Badge tone="muted">chờ tải</Badge>}
                  {p.status === 'ok' && <Badge tone="good">{num(p.words)} chữ</Badge>}
                  {p.status === 'error' && <Badge tone="bad">lỗi</Badge>}
                  <a className="link grow ellipsis" href={p.url} target="_blank" rel="noreferrer">{p.title || p.url}</a>
                  {p.error && <span className="tone-bad small">{p.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {c.flows.includes('social') && (
        <section className="card">
          <h2>Người đứng tên & bài mẫu (MXH)</h2>
          {c.authors.length === 0 ? <p className="muted">Không có người đứng tên.</p> : (
            <ul className="list">
              {c.authors.map((a) => <li key={a.ref} className="list-row"><b>{a.ref}</b><span className="grow">{a.name} <span className="muted small">{a.title}</span></span></li>)}
            </ul>
          )}
          {c.social_refs.map((p) => (
            <div key={p.ref} className="panel post-ref">
              <div className="small"><b>{p.ref}</b> · {CHANNEL[p.channel]}{p.metrics && ` · ${p.metrics}`}</div>
              <div className="small clamp-3 pre">{p.text}</div>
            </div>
          ))}
        </section>
      )}
      <section className="card">
        <h2>Thẻ VCWIKI làm căn cứ</h2>
        {c.cards.length === 0 ? <p className="muted">Không dùng thẻ nào.</p> : (
          <ul className="list">
            {c.cards.map((k) => (
              <li key={k.ref} className="list-row">
                <b>{k.ref}</b>
                <Badge tone="info">{CARD_TYPE[k.type] || k.type}</Badge>
                <Badge tone={CARD_STATUS[k.status]?.tone}>{CARD_STATUS[k.status]?.label}</Badge>
                <Link className="link grow ellipsis" to={`/wiki?card=${k.card_id}`}>{k.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StrategyTab({ st }) {
  const s = st.strategy
  const ba = st.brief_analysis
  const sr = st.seo_research
  return (
    <div className="stack">
      <section className="card">
        <h2>Đọc brief</h2>
        <p>{ba.summary}</p>
        <div className="grid-2">
          <div><h3>Giả định AI đặt ra</h3><List items={ba.assumptions} /></div>
          <div><h3>Câu hỏi cần chốt</h3><List items={ba.open_questions} /></div>
        </div>
      </section>
      <section className="card">
        <h2>Chiến lược</h2>
        <dl className="kv">
          <dt>Mục tiêu</dt><dd>{s.objective}</dd>
          <dt>Bối cảnh</dt><dd>{s.market_context}</dd>
          <dt>Định vị</dt><dd>{s.positioning}</dd>
          <dt>Thông điệp chủ đạo</dt><dd className="strong">{s.key_message}</dd>
          <dt>Giọng điệu</dt><dd>{s.tone_of_voice}</dd>
          <dt>Nhân vật</dt><dd>{s.persona}</dd>
        </dl>
        <h3>Lý do tin</h3><List items={s.reasons_to_believe} />
      </section>
      <section className="card">
        <h2>Khán giả mục tiêu</h2>
        <div className="grid-2">
          {s.audiences.map((a, i) => (
            <div key={i} className="panel">
              <div className="strong">{a.name}</div>
              <p className="small">{a.profile}</p>
              <h4>Nỗi đau</h4><List items={a.pains} />
              <h4>Mong muốn</h4><List items={a.desires} />
              <p className="small muted">Thói quen: {a.content_habits}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Insight khán giả</h2>
        <ul>
          {st.insights.map((x, i) => <li key={i}><b>{x.insight}</b> <span className="muted small">— {x.evidence} ({x.refs.join(', ')})</span></li>)}
        </ul>
      </section>
      <section className="card table-wrap">
        <h2>Trụ nội dung</h2>
        <table className="table table-static">
          <thead><tr><th>Trụ</th><th>Mục đích</th><th className="num">Tỷ trọng</th><th>Hình thức</th><th>Căn cứ</th></tr></thead>
          <tbody>
            {s.pillars.map((p, i) => (
              <tr key={i}><td className="strong">{p.name}</td><td>{p.purpose}</td><td className="num">{p.share_pct}%</td><td>{p.formats.join(', ')}</td><td className="small">{p.refs.join(', ')}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      {sr && (
        <section className="card">
          <h2>Nghiên cứu SEO</h2>
          <dl className="kv">
            <dt>Độ dài mục tiêu</dt><dd>~{num(sr.target_words)} chữ</dd>
            <dt>Chủ đề bắt buộc</dt><dd>{sr.must_cover.join(' · ')}</dd>
            <dt>Khoảng trống</dt><dd className="strong">{sr.content_gaps.join(' · ')}</dd>
          </dl>
          <div className="table-wrap">
            <table className="table table-static">
              <thead><tr><th>Từ khoá</th><th>Ý định</th><th>Ghi chú</th></tr></thead>
              <tbody>{sr.keyword_ideas.map((k, i) => <tr key={i}><td className="strong">{k.keyword}</td><td className="nowrap">{k.intent}</td><td className="small">{k.note}</td></tr>)}</tbody>
            </table>
          </div>
          {sr.serp_pages.length > 0 && (
            <>
              <h3>Trang đối thủ</h3>
              {sr.serp_pages.map((p) => (
                <div key={p.ref} className="panel post-ref">
                  <div className="small"><b>{p.ref}</b> · {p.page_type} · {num(p.word_count)} chữ</div>
                  <div className="small">Chủ đề con: {p.subtopics.join(', ')}</div>
                  <div className="small tone-bad">Điểm yếu: {p.weaknesses}</div>
                </div>
              ))}
            </>
          )}
        </section>
      )}
      {st.social_analysis?.length > 0 && (
        <section className="card">
          <h2>Phân tích bài MXH mẫu</h2>
          {st.social_analysis.map((p) => (
            <div key={p.ref} className="panel post-ref">
              <div className="small"><b>{p.ref}</b> · {p.format} · CTA: {p.cta_type}</div>
              <div className="small">Mở đầu: “{p.hook}” — {p.structure}</div>
              <div className="small">Vì sao hiệu quả: {p.why_it_works}</div>
              <div className="small tone-good">Bài học: {p.takeaway}</div>
            </div>
          ))}
        </section>
      )}
      <section className="card grid-2">
        <div><h3>Nên</h3><List items={s.dos} /></div>
        <div><h3>Không nên</h3><List items={s.donts} /></div>
      </section>
    </div>
  )
}

function CampaignTab({ cp }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>{cp.name}</h2>
        <p className="lead">{cp.big_idea}</p>
        <dl className="kv">
          <dt>Tagline</dt><dd className="strong">{cp.tagline}</dd>
          <dt>CTA</dt><dd>{cp.cta}</dd>
          <dt>Ngân sách</dt><dd>{cp.budget_notes}</dd>
        </dl>
      </section>
      <section className="card table-wrap">
        <h2>Giai đoạn</h2>
        <table className="table table-static">
          <thead><tr><th>Giai đoạn</th><th>Thời gian</th><th>Mục tiêu</th><th>Trọng tâm nội dung</th><th>KPI</th></tr></thead>
          <tbody>{cp.phases.map((p, i) => <tr key={i}><td className="strong">{p.name}</td><td className="nowrap">{p.weeks}</td><td>{p.objective}</td><td>{p.content_focus}</td><td>{p.kpi}</td></tr>)}</tbody>
        </table>
      </section>
      <div className="grid-2">
        <section className="card table-wrap">
          <h2>KPI</h2>
          <table className="table table-static">
            <thead><tr><th>Chỉ số</th><th>Mục tiêu</th><th>Cách đo</th></tr></thead>
            <tbody>{cp.kpis.map((k, i) => <tr key={i}><td>{k.metric}</td><td className="strong">{k.target}</td><td className="small">{k.how_to_measure}</td></tr>)}</tbody>
          </table>
        </section>
        <section className="card">
          <h2>Kênh</h2>
          <ul>{cp.channels.map((ch, i) => <li key={i}><b>{ch.platform}</b>: {ch.role} <span className="muted">({ch.frequency})</span></li>)}</ul>
          <h3>Nguồn lực cần có</h3><List items={cp.resources} />
        </section>
      </div>
      <section className="card">
        <h2>Rủi ro & cách giảm</h2>
        <ul>{cp.risks.map((r, i) => <li key={i}><b>{r.risk}</b> → {r.mitigation}</li>)}</ul>
      </section>
    </div>
  )
}

// Chữ trên nút / thông báo theo luồng
const WORDING = {
  video: { write: (n) => `✎ Viết kịch bản ${n || ''} tập đã chọn`, queued: (n) => `Đã xếp hàng ${n} kịch bản`, pick: (no) => `Chọn tập ${no}`, next: '4 tập tiếp theo', feedback: 'Yêu cầu chung cho kịch bản (tuỳ chọn) — VD: quay tại xưởng, 1 người nói, không dùng nhạc trend' },
  seo: { write: (n) => `✎ Lập dàn ý ${n || ''} bài đã chọn`, queued: (n) => `Đã xếp hàng lập dàn ý ${n} bài — duyệt dàn ý xong mới viết bài`, pick: (no) => `Chọn bài ${no}`, next: '2 bài tiếp theo', feedback: 'Yêu cầu chung (tuỳ chọn) — VD: dẫn số liệu từ hãng, có bảng so sánh, giọng chuyên gia' },
  social: { write: (n) => `✎ Viết ${n || ''} bài đã chọn`, queued: (n) => `Đã xếp hàng ${n} bài đăng`, pick: (no) => `Chọn bài ${no}`, next: '5 bài tiếp theo', feedback: 'Yêu cầu chung (tuỳ chọn) — VD: không dùng emoji, mỗi bài một câu hỏi cuối' },
}
const NEXT_COUNT = { video: 4, seo: 2, social: 5 }

function PieceStatus({ s }) {
  if (!s) return <span className="muted small">chưa viết</span>
  if (BUSY.includes(s.status)) return <span className="small"><span className="pulse inline-pulse" /> {s.stage || 'chờ AI'}</span>
  if (s.status === 'error') return <span className="tone-bad small" title={s.error}>Lỗi — chọn để viết lại</span>
  if (s.flow === 'seo' && s.step === 'outline') return <Badge tone="info">Dàn ý — chờ duyệt</Badge>
  return <><Score value={s.score} /> <Badge tone={REVIEW[s.review_status]?.tone}>{REVIEW[s.review_status]?.label}</Badge></>
}

function PlanTab({ c, flow, onOpen, run }) {
  const plan = c.plans[flow]
  const w = WORDING[flow]
  const pieces = c.scripts.filter((s) => s.flow === flow)
  const byEp = Object.fromEntries(pieces.filter((s) => !s.derived).map((s) => [s.episode_no, s]))
  const derived = pieces.filter((s) => s.derived)
  const [selected, setSelected] = useState(new Set())
  const [feedback, setFeedback] = useState('')
  const [msg, setMsg] = useState(null)
  useEffect(() => { setSelected(new Set()); setMsg(null) }, [flow])
  if (!plan) return <DerivedList pieces={derived} onOpen={onOpen} />
  const writable = plan.episodes.filter((e) => !byEp[e.no] || byEp[e.no].status === 'error')
  const toggle = (no) => {
    const next = new Set(selected)
    next.has(no) ? next.delete(no) : next.add(no)
    setSelected(next)
  }
  const queue = async (nos) => {
    setMsg(null)
    let res
    const ok = await run(async () => { res = await api.queueScripts(c.id, { flow, episodes: nos, feedback }) })
    if (ok) {
      setSelected(new Set())
      setMsg(`${w.queued(res.queued.length)}.${res.skipped.length ? ` Bỏ qua ${res.skipped.length} mục đã có.` : ''}`)
    }
  }
  const openable = (s) => s && s.status === 'done'

  return (
    <div className="stack">
      <section className="card">
        <dl className="kv">
          <dt>Nhịp đăng</dt><dd>{plan.cadence}</dd>
          {plan.posting_times && <><dt>Khung giờ</dt><dd>{plan.posting_times.join(' · ')}</dd></>}
          {plan.mix && <><dt>Tỷ trọng</dt><dd>{plan.mix}</dd></>}
          {plan.cluster && <><dt>Bài trụ</dt><dd><b>{plan.cluster.pillar_topic}</b> — “{plan.cluster.pillar_keyword}”. <span className="muted">{plan.cluster.rationale}</span></dd></>}
          {plan.internal_linking && <><dt>Liên kết nội bộ</dt><dd>{plan.internal_linking}</dd></>}
        </dl>
        {c.can_edit && (
          <div className="script-bar">
            <input aria-label="Yêu cầu chung cho AI" placeholder={w.feedback} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            <button className="btn btn-primary" disabled={!selected.size} data-testid="campaign-pieces-write" onClick={() => queue([...selected])}>{w.write(selected.size)}</button>
            <button className="btn" disabled={!writable.length} data-testid="campaign-pieces-next" onClick={() => queue(writable.slice(0, NEXT_COUNT[flow]).map((e) => e.no))}
              title="Chất lượng hơn số lượng — làm từng đợt nhỏ">{w.next}</button>
          </div>
        )}
        {msg && <p className="tone-good small" role="status">{msg}</p>}
      </section>

      <div className="card table-wrap">
        <table className="table">
          <caption className="sr-only">Kế hoạch {FLOW[flow].label.toLowerCase()}: {plan.episodes.length} mục. Mục đã viết xong mở bằng nút tiêu đề.</caption>
          <thead>
            <tr>
              {c.can_edit && <th scope="col"><span className="sr-only">Chọn</span></th>}
              <th scope="col">#</th><th scope="col">Lịch</th>
              {flow === 'social' && <th scope="col">Kênh</th>}
              <th scope="col">{flow === 'video' ? 'Tập' : 'Bài'}</th>
              <th scope="col">{flow === 'seo' ? 'Ý định' : 'Hình thức'}</th>
              <th scope="col" className="num">Dự đoán</th><th scope="col">Nội dung</th>
            </tr>
          </thead>
          <tbody>
            {plan.episodes.map((e) => {
              const s = byEp[e.no]
              const canPick = c.can_edit && (!s || s.status === 'error')
              return (
                <tr key={e.no} data-id={e.no} data-status={s ? (s.status === 'done' ? (s.review_status || 'done') : s.status) : 'empty'} data-testid="campaign-piece-row"
                  onClick={() => (openable(s) ? onOpen(s.id) : canPick && toggle(e.no))}>
                  {c.can_edit && (
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <input type="checkbox" disabled={!canPick} checked={selected.has(e.no)} onChange={() => toggle(e.no)} aria-label={`${w.pick(e.no)}: ${e.title}`} />
                    </td>
                  )}
                  <td className="strong">{e.no}</td>
                  <td className="nowrap small">Tuần {e.week}<div className="muted">{e.day}</div></td>
                  {flow === 'social' && <td className="small">{CHANNEL[e.channel] || e.channel}<div className="muted">{authorName(c, e.author)}</div></td>}
                  <td className="cell-video">
                    {openable(s)
                      ? <button type="button" className="link strong" style={{ textAlign: 'left' }} data-testid="campaign-piece-open"
                          onClick={(ev) => { ev.stopPropagation(); onOpen(s.id) }}>{e.title}</button>
                      : <div className="strong">{e.title}</div>}
                    {flow === 'seo' ? (
                      <>
                        <div className="small">Từ khoá: <b>{e.primary_keyword}</b> <span className="muted">· {e.secondary_keywords.join(', ')}</span></div>
                        <div className="muted small clamp-2">{e.angle}</div>
                      </>
                    ) : (
                      <>
                        <div className="small">“{e.hook}”</div>
                        <div className="muted small clamp-2">{e.key_message} · CTA: {e.cta}</div>
                      </>
                    )}
                    <div className="meta">
                      {flow === 'seo' && <span className="chip">{e.role === 'pillar' ? 'Bài trụ' : 'Vệ tinh'}</span>}
                      <span className="chip">{e.pillar}</span>
                      {e.phase && <span>{e.phase}</span>}
                      {flow === 'seo' && e.links_to.length > 0 && <span>liên kết tới: {e.links_to.join(', ')}</span>}
                      <span title={e.rationale}>căn cứ: {[...e.refs, ...e.cards].join(', ') || '—'}</span>
                    </div>
                  </td>
                  <td className="small">
                    {flow === 'video' && <>{e.format}<div className="muted">{e.duration_sec}s</div></>}
                    {flow === 'seo' && <>{e.search_intent}<div className="muted">~{num(e.target_words)} chữ</div></>}
                    {flow === 'social' && <>{e.format}<div className="muted">{e.post_type}{e.link === 'có' ? ' · dẫn link' : ''}</div></>}
                  </td>
                  <td className="num">{e.predicted_score}</td>
                  <td className="nowrap">
                    {openable(s) ? <button className="link" onClick={(ev) => { ev.stopPropagation(); onOpen(s.id) }}><PieceStatus s={s} /></button> : <PieceStatus s={s} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <DerivedList pieces={derived} onOpen={onOpen} />

      {plan.production_batches?.length > 0 && (
        <section className="card">
          <h2>Lịch quay gộp</h2>
          <ul>{plan.production_batches.map((b, i) => <li key={i}><b>{b.batch}</b>: tập {b.episodes.join(', ')} — {b.timing}. <span className="muted">{b.notes}</span></li>)}</ul>
        </section>
      )}
    </div>
  )
}

function DerivedList({ pieces, onOpen }) {
  if (!pieces.length) return null
  return (
    <section className="card">
      <h2>Nhân bản từ nội dung khác</h2>
      <ul className="list">
        {pieces.map((s) => (
          <li key={s.id} className={`list-row ${s.status === 'done' ? 'clickable' : ''}`} data-id={s.id} data-status={s.status} onClick={() => s.status === 'done' && onOpen(s.id)}>
            <span className="chip">từ {FLOW[s.derived.from_flow]?.label} #{s.derived.from_no}</span>
            {s.channel && <span className="small muted">{CHANNEL[s.channel]}</span>}
            {s.status === 'done'
              ? <button type="button" className="link grow ellipsis" style={{ textAlign: 'left' }} onClick={(ev) => { ev.stopPropagation(); onOpen(s.id) }}>{s.title}</button>
              : <span className="grow ellipsis">{s.title}</span>}
            <PieceStatus s={s} />
          </li>
        ))}
      </ul>
    </section>
  )
}

const authorName = (c, ref) => c.authors?.find((a) => a.ref === ref)?.name || ref || ''

export function Score({ value }) {
  if (value == null) return null
  return <Badge tone={value >= 80 ? 'good' : value >= 65 ? 'warn' : 'bad'}>{value}/100</Badge>
}

// --- Văn bản để sao chép ------------------------------------------------------------------------------------

function copyText(sc) {
  const c = sc.content
  if (sc.flow === 'seo') {
    return [`# ${c.h1}`, '', c.body, '', ...(c.faq.length ? ['## Câu hỏi thường gặp', '', ...c.faq.flatMap((f) => [`**${f.q}**`, '', f.a, ''])] : [])].join('\n')
  }
  if (sc.flow === 'social') {
    const link = c.link && c.link_placement === 'trong bài' ? `\n\n${c.link.utm_url}` : ''
    return `${c.hooks[0] || ''}\n\n${c.body}${link}${c.hashtags.length ? `\n\n${c.hashtags.join(' ')}` : ''}`
  }
  const lines = [`TẬP ${sc.episode_no}: ${c.title}`, c.logline, '', `HOOK: “${c.hook.voice}”`, `  Chữ: ${c.hook.on_screen_text}`, `  Hình: ${c.hook.visual}`, '']
  c.scenes.forEach((s) => lines.push(`[${clock(s.start_sec)}–${clock(s.end_sec)}] ${s.shot} | ${s.visual}`, `  Lời: ${s.voice}`, `  Chữ: ${s.on_screen_text}`, `  Âm thanh: ${s.sound}`))
  lines.push('', `KẾT + CTA: “${c.ending.voice}” — ${c.ending.on_screen_text}`, '', `Caption: ${c.caption}`, c.hashtags.join(' '))
  return lines.join('\n')
}

// --- Nội dung trong drawer theo luồng -----------------------------------------------------------------------------

export function VideoBody({ c }) {
  return (
    <>
      {c.logline && <p className="lead">{c.logline}</p>}
      <p className="small muted">{c.format} · {c.duration_sec}s · Giọng: {c.persona_voice}</p>
      <h3>Hook — 3 giây đầu</h3>
      <div className="hook-box">
        <div className="strong">“{c.hook.voice}”</div>
        <div className="small">Chữ trên màn hình: <b>{c.hook.on_screen_text}</b></div>
        <div className="small muted">Hình: {c.hook.visual}</div>
      </div>
      <h3>Phân cảnh</h3>
      <div className="table-wrap">
        <table className="table table-static scene-table">
          <thead><tr><th>Thời gian</th><th>Cảnh / hình ảnh</th><th>Lời thoại</th><th>Chữ · Âm thanh</th></tr></thead>
          <tbody>
            {c.scenes.map((s, i) => (
              <tr key={i}>
                <td className="seg-time nowrap">{clock(s.start_sec)}–{clock(s.end_sec)}</td>
                <td><div className="strong small">{s.shot}</div><div className="small">{s.visual}</div></td>
                <td>{s.voice}</td>
                <td className="small"><div><b>{s.on_screen_text}</b></div><div className="muted">♪ {s.sound}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Kết + CTA</h3>
      <p>“{c.ending.voice}” <span className="muted small">— chữ: {c.ending.on_screen_text} · hình: {c.ending.visual}</span></p>
      <h3>Caption & hashtag</h3>
      <p>{c.caption}<br /><span className="tone-info">{c.hashtags.join(' ')}</span></p>
      <h3>Hook thay thế (thử A/B)</h3><List items={c.alt_hooks} />
      <h3>Ghi chú sản xuất</h3>
      <dl className="kv">
        <dt>Nhân vật</dt><dd>{c.production.cast.join(', ')}</dd>
        <dt>Bối cảnh</dt><dd>{c.production.locations.join(', ')}</dd>
        <dt>Đạo cụ</dt><dd>{c.production.props.join(', ')}</dd>
        <dt>Thiết bị</dt><dd>{c.production.equipment.join(', ')}</dd>
        <dt>Quay</dt><dd>{c.production.shooting_notes}</dd>
        <dt>Dựng</dt><dd>{c.production.editing_notes}</dd>
        <dt>Thời gian</dt><dd>{c.production.time_estimate}</dd>
      </dl>
    </>
  )
}

function OutlineBody({ o }) {
  return (
    <>
      <p className="lead">{o.h1}</p>
      <dl className="kv">
        <dt>Từ khoá chính</dt><dd className="strong">{o.primary_keyword}</dd>
        <dt>Từ khoá phụ</dt><dd>{o.secondary_keywords.join(', ')}</dd>
        <dt>Ý định tìm kiếm</dt><dd>{o.search_intent}</dd>
        <dt>Góc viết</dt><dd>{o.angle}</dd>
        <dt>Độ dài dự kiến</dt><dd>~{num(o.target_words)} chữ</dd>
        <dt>CTA</dt><dd>{o.cta}</dd>
      </dl>
      <h3>Dàn ý</h3>
      <div className="outline">
        {o.sections.map((s, i) => (
          <div key={i} className={s.level === 3 ? 'outline-h3' : 'outline-h2'}>
            <div className="strong">H{s.level} · {s.heading}</div>
            <ul className="small">{s.points.map((p, j) => <li key={j}>{p}</li>)}</ul>
            {s.needs.length > 0 && <div className="small tone-warn">Cần: {s.needs.join('; ')}</div>}
          </div>
        ))}
      </div>
      <h3>Câu hỏi thường gặp</h3><List items={o.faq} />
      <h3>Link nội bộ dự kiến</h3>
      <List items={o.internal_links.map((l) => `${l.anchor} → ${l.url || '(chưa có URL)'} — ${l.reason}`)} />
    </>
  )
}

export function SeoBody({ c }) {
  return (
    <>
      <h3>Xem trước trên Google</h3>
      <div className="serp-preview">
        <div className="serp-url">{c.slug ? `…/${c.slug}` : ''}</div>
        <div className="serp-title">{c.meta_title}</div>
        <div className="serp-desc">{c.meta_description}</div>
      </div>
      <dl className="kv">
        <dt>Từ khoá chính</dt><dd className="strong">{c.primary_keyword}</dd>
        <dt>Từ khoá phụ</dt><dd>{c.secondary_keywords.join(', ')}</dd>
        <dt>Ý định</dt><dd>{c.search_intent}</dd>
        <dt>Tác giả</dt><dd>{c.author}</dd>
        <dt>CTA</dt><dd>{c.cta}</dd>
      </dl>
      <h3>Bài viết</h3>
      <article className="article-preview">
        <h1>{c.h1}</h1>
        <Markdown text={c.body} />
        {c.faq.length > 0 && (
          <>
            <h2>Câu hỏi thường gặp</h2>
            {c.faq.map((f, i) => <div key={i}><p className="strong">{f.q}</p><p>{f.a}</p></div>)}
          </>
        )}
      </article>
      <h3>Ảnh cần chuẩn bị</h3>
      <List items={c.images.map((im) => `${im.placement}: ${im.description} — alt “${im.alt}” — ${im.filename}`)} />
      <h3>Link nội bộ</h3>
      <List items={c.internal_links.map((l) => `${l.anchor} → ${l.url} (${l.placement})`)} />
      <h3>Nguồn nên trích</h3>
      <List items={c.external_sources.map((s) => `${s.source_name}: ${s.what_to_cite}${s.url ? ` — ${s.url}` : ''}`)} />
      {c.schema_jsonld && (<><h3>Schema JSON-LD</h3><pre className="code-block">{c.schema_jsonld}</pre></>)}
    </>
  )
}

function SocialBody({ c, sc, campaign }) {
  const [pick, setPick] = useState(0)
  const hooks = c.hooks || []
  return (
    <>
      <p className="small muted">{CHANNEL[sc.episode.channel] || c.channel} · Người đứng tên: {authorName(campaign, c.author || sc.episode.author) || '—'} · Giờ đăng: {c.best_time}</p>
      <h3>Mở đầu — chọn một trong 3 phương án</h3>
      <div className="hook-options">
        {hooks.map((h, i) => (
          <label key={i} className={`hook-option ${pick === i ? 'on' : ''}`}>
            <input type="radio" name="hook" checked={pick === i} onChange={() => setPick(i)} />
            <span className="pre">{h}</span>
          </label>
        ))}
      </div>
      <h3>Xem trước bài đăng</h3>
      <div className="post-preview">
        <div className="strong pre">{hooks[pick]}</div>
        <div className="pre">{c.body}</div>
        {c.link && c.link_placement === 'trong bài' && <div className="link">{c.link.utm_url}</div>}
        {c.hashtags.length > 0 && <div className="tone-info">{c.hashtags.join(' ')}</div>}
      </div>
      {c.first_comment && (<><h3>Bình luận đầu</h3><div className="panel pre small">{c.first_comment}{c.link && c.link_placement === 'bình luận đầu' ? `\n${c.link.utm_url}` : ''}</div></>)}
      {c.link && <p className="small muted">Link ({c.link_placement}): <span className="mono">{c.link.utm_url}</span></p>}
      <h3>Hình ảnh</h3>
      <p className="small"><b>{c.visual.type}</b> — {c.visual.description}</p>
      {c.visual.slides.length > 0 && <ol className="small">{c.visual.slides.map((s, i) => <li key={i}>{s}</li>)}</ol>}
    </>
  )
}

export function Checks({ items }) {
  if (!items?.length) return null
  const passed = items.filter((x) => x.ok).length
  return (
    <>
      <h3>Kiểm tra tự động <span className="muted small">({passed}/{items.length} đạt)</span></h3>
      <ul className="check-list">
        {items.map((x) => (
          <li key={x.key} className={x.ok ? 'tone-good' : 'tone-bad'}>
            {x.ok ? '✓' : '✗'} {x.label}{x.detail && <span className="muted"> — {x.detail}</span>}
          </li>
        ))}
      </ul>
    </>
  )
}

function Repurpose({ sc, campaign, run }) {
  const others = Object.keys(FLOW)
  const [flow, setFlow] = useState(sc.flow === 'social' ? 'video' : 'social')
  const [channel, setChannel] = useState((campaign.brief.social?.channels || [])[0] || 'fanpage')
  const [count, setCount] = useState(sc.flow === 'seo' ? 3 : 1)
  return (
    <div className="copy-row repurpose">
      <span className="small strong nowrap">Nhân bản sang</span>
      <select value={flow} onChange={(e) => setFlow(e.target.value)} aria-label="Luồng nhân bản">
        {others.map((f) => <option key={f} value={f}>{FLOW[f].label}</option>)}
      </select>
      {flow === 'social' && (
        <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Kênh nhân bản">
          {Object.entries(CHANNEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      )}
      <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Số bản">
        {[1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{x} bản</option>)}
      </select>
      <button className="btn" onClick={() => run(() => api.repurposeScript(sc.id, { flow, channel: flow === 'social' ? channel : null, count }), `Đã xếp hàng ${count} bản — xem ở tab ${FLOW[flow].label}`)}>Nhân bản</button>
    </div>
  )
}

function ScriptDrawer({ id, campaign, onClose, onChanged }) {
  const [interval, setInterval_] = useState(0)
  const { data: sc, error, setData } = useFetch(() => api.script(id), [id], interval)
  const { data: status } = useFetch(api.studioStatus, [])
  const [feedback, setFeedback] = useState('')
  const [note, setNote] = useState(null)
  const [actionError, setActionError] = useState(null)
  const titleId = useId()
  useEffect(() => setInterval_(sc && BUSY.includes(sc.status) ? 4000 : 0), [sc?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (text) => toast(text)
  const run = async (fn, okText) => {
    setActionError(null)
    try {
      const res = await fn()
      if (res?.id) setData(res)
      onChanged()
      if (okText) flash(okText)
      return true
    } catch (e) {
      setActionError(e.message)
      return false
    }
  }

  const c = sc?.content
  const rv = sc?.review
  const ep = sc?.episode
  const flow = sc?.flow || 'video'
  const outlineOnly = flow === 'seo' && !c && sc?.outline && sc.step === 'outline'
  const unit = flow === 'video' ? 'Tập' : 'Bài'
  const rubric = status?.rubrics?.[flow]
  const title = c?.title || c?.h1 || sc?.outline?.h1 || ep?.title

  return (
    <>
      <div className="overlay" aria-hidden="true" onClick={onClose} />
      <aside className="drawer drawer-wide" role="dialog" aria-labelledby={titleId} data-testid="campaign-piece-drawer" data-id={id} data-status={sc?.status}>
        <div className="drawer-head">
          <div className="grow">
            <div className="muted small">
              {FLOW[flow].label} · {ep?.derived ? `nhân bản từ ${FLOW[ep.derived.from_flow]?.label} #${ep.derived.from_no}` : `${unit} ${sc?.episode_no}`}
              {ep?.pillar && ` · ${ep.pillar}`}{ep?.week && ` · Tuần ${ep.week} ${ep.day || ''}`}
            </div>
            <h2 className="clamp-2" id={titleId}>{title || FLOW[flow].piece}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={`Đóng: ${title || FLOW[flow].piece}`} title="Đóng">✕</button>
        </div>
        <ErrorBox>{error}</ErrorBox>
        {sc && (
          <div className="drawer-body">
            {BUSY.includes(sc.status) && <div className="current" role="status"><span className="pulse" /> {sc.stage || 'Đang chờ AI…'}</div>}
            {sc.status === 'error' && <ErrorBox>{sc.error}</ErrorBox>}

            {outlineOnly && (
              <>
                <div className="notice">Dàn ý chờ duyệt. Sửa hướng bằng góp ý rồi bấm <b>Duyệt dàn ý & viết bài</b>, hoặc <b>Lập lại dàn ý</b>.</div>
                <OutlineBody o={sc.outline} />
              </>
            )}
            {c && (
              <>
                <div className="meta-line">
                  <Score value={sc.score} />
                  <Badge tone={REVIEW[sc.review_status]?.tone}>{REVIEW[sc.review_status]?.label}</Badge>
                  <span>{sc.rounds?.length} vòng AI · {dateTime(sc.generated_at)}</span>
                </div>
                {flow === 'video' && <VideoBody c={c} />}
                {flow === 'seo' && <SeoBody c={c} />}
                {flow === 'social' && <SocialBody c={c} sc={sc} campaign={campaign} />}
                {c.facts_to_verify?.length > 0 && (<><h3 className="tone-bad">Cần kiểm chứng trước khi đăng</h3><List items={c.facts_to_verify} /></>)}
                <h3>Căn cứ</h3>
                <p className="small">{[...c.sources.refs, ...c.sources.cards].join(', ')} — {c.sources.notes}</p>

                <Checks items={sc.checks} />
                {rv && rubric && (
                  <>
                    <h3>Giám khảo AI</h3>
                    <p className="small">{rv.verdict} <span className="muted">· Rủi ro giống nguồn: {rv.similarity_risk}</span></p>
                    <div className="score-bars">
                      {Object.entries(rubric).map(([k, r]) => (
                        <div key={k} className="score-row">
                          <span>{r.label}{r.auto && <span className="muted"> (tự động)</span>}</span>
                          <div className="progress"><div className="progress-bar" style={{ width: `${Math.min(100, ((rv.scores[k] || 0) / r.max) * 100)}%` }} /></div>
                          <b>{rv.scores[k] ?? '—'}/{r.max}</b>
                        </div>
                      ))}
                    </div>
                    <div className="grid-2">
                      <div><h4>Điểm mạnh</h4><List items={rv.strengths} /></div>
                      <div><h4>Nên sửa thêm</h4><List items={rv.fixes} /></div>
                    </div>
                    {sc.rounds?.length > 1 && <p className="muted small">Điểm qua các vòng: {sc.rounds.map((r) => r.total).join(' → ')} (giữ bản cao nhất)</p>}
                  </>
                )}

                <h3>Ghi chú của người duyệt</h3>
                {note === null ? (
                  <p className="small">{sc.note || <span className="muted">—</span>} {sc.can_edit && <button className="link" onClick={() => setNote(sc.note || '')}>sửa</button>}</p>
                ) : (
                  <div className="form">
                    <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="actions">
                      <button className="btn btn-primary" onClick={async () => (await run(() => api.patchScript(id, { note }), 'Đã lưu')) && setNote(null)}>Lưu</button>
                      <button className="btn btn-ghost" onClick={() => setNote(null)}>Huỷ</button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="drawer-foot">
              {c && sc.can_edit && sc.status === 'done' && (
                <>
                  {sc.review_status !== 'approved' && <button className="btn btn-primary" data-testid="campaign-piece-approve" onClick={() => run(() => api.patchScript(id, { review_status: 'approved' }), 'Đã duyệt')}>✓ Duyệt</button>}
                  {sc.review_status !== 'rejected' && <button className="btn" data-testid="campaign-piece-reject" onClick={() => run(() => api.patchScript(id, { review_status: 'rejected' }), 'Đã loại')}>Loại</button>}
                  {sc.review_status !== 'draft' && <button className="btn btn-ghost" onClick={() => run(() => api.patchScript(id, { review_status: 'draft' }))}>Về nháp</button>}
                </>
              )}
              {c && <button className="btn btn-ghost" data-testid="campaign-piece-copy" onClick={() => navigator.clipboard.writeText(copyText(sc)).then(() => flash('Đã sao chép'), () => toast('Không sao chép được — chọn chữ và sao chép tay', { tone: 'error' }))}>Sao chép</button>}
              {sc.can_edit && sc.status !== 'generating' && (
                <button className="btn btn-ghost btn-danger-text" data-testid="campaign-piece-delete" onClick={async () => {
                  if (!(await confirmDialog({ title: 'Xoá nội dung này?', body: title || '', okLabel: 'Xoá nội dung', danger: true }))) return
                  if (await run(() => api.deleteScript(id))) onClose()
                }}>Xoá</button>
              )}
            </div>
            {c && flow === 'social' && sc.status === 'done' && <FacebookPublish source="script" piece={sc} channel={sc.episode?.channel} />}
            {sc.can_edit && !BUSY.includes(sc.status) && (
              <div className="copy-row">
                <input aria-label={outlineOnly ? 'Góp ý cho dàn ý / bài viết' : 'Góp ý để AI viết lại'} placeholder={outlineOnly ? 'Góp ý cho dàn ý / bài viết — VD: thêm mục bảng giá, bỏ mục lịch sử' : 'Góp ý để AI viết lại — VD: mở đầu gắt hơn, thêm chuyện thật của anh Hùng'}
                  value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                {outlineOnly && <button className="btn btn-primary" onClick={async () => (await run(() => api.writeArticle(id, feedback), 'Đã gửi AI viết bài')) && setFeedback('')}>✓ Duyệt dàn ý & viết bài</button>}
                <button className="btn" onClick={async () => (await run(() => api.rewriteScript(id, feedback), 'Đã gửi AI làm lại')) && setFeedback('')}>{outlineOnly ? 'Lập lại dàn ý' : 'Viết lại'}</button>
              </div>
            )}
            {sc.can_edit && sc.status === 'done' && (c || sc.outline) && <Repurpose sc={sc} campaign={campaign} run={run} />}
            <ErrorBox>{actionError}</ErrorBox>
            {sc.usage && <p className="muted small">AI: {sc.usage.calls} lượt · {num(sc.usage.input_tokens)} token vào · {num(sc.usage.output_tokens)} token ra</p>}
          </div>
        )}
      </aside>
    </>
  )
}
