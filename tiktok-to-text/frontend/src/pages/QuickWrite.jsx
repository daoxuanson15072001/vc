import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useUrlState } from '../urlState'
import { api } from '../api'
import { useDebounced, useFetch, usePageTitle } from '../hooks'
import { CHANNEL, PERSONAL_CHANNELS, dateTime, num } from '../format'
import { Badge, Empty, ErrorBox, Loading, Pagination } from '../components/ui'
import { confirmDialog } from '../components/dialog'
import { ProjectSelect, SpaceSelect } from '../components/pickers'
import { Markdown } from '../components/markdown'
import { FacebookPublish } from '../components/facebookPublish'
import { Checks, List, Score, SeoBody, VideoBody } from './Campaign'

// Viết nhanh (Content Engine): chọn loại nội dung → điền form → AI viết, tự kiểm tra, chấm, sửa.
// Danh mục loại, ô nhập và cách hiển thị kết quả do BE khai báo (studio/quick.py) — thêm loại không cần sửa trang này.

const BUSY = ['queued', 'generating']
const REVIEW = { draft: { label: 'Nháp', tone: 'warn' }, approved: { label: 'Đã duyệt', tone: 'good' }, rejected: { label: 'Loại', tone: 'muted' } }
const STATUS = {
  queued: { label: 'Chờ AI', tone: 'info' }, generating: { label: 'AI đang viết', tone: 'info' },
  waiting_ai: { label: 'Chờ cấu hình AI', tone: 'warn' }, done: { label: 'Xong', tone: 'good' }, error: { label: 'Lỗi', tone: 'bad' },
}
const ADVANCED = ['source', 'source_url', 'site_urls']   // gom vào "Tư liệu" cho form gọn
const EXTRA_CHANNEL = { fb_group: 'Nhóm Facebook', zalo: 'Zalo' }

const optValue = (o) => (Array.isArray(o) ? o[0] : o)
const optLabel = (o) => (Array.isArray(o) ? o[1] : o)
const get = (obj, path) => path.split('.').reduce((x, k) => (x == null ? x : x[k]), obj)
const defaults = (type) => Object.fromEntries(type.fields.map((f) => [f.key, f.default ?? '']))

export function PieceStatus({ s }) {
  const x = STATUS[s] || { label: s, tone: 'muted' }
  return <Badge tone={x.tone}>{x.label}</Badge>
}

function CopyBtn({ text, label = 'Sao chép' }) {
  const [done, setDone] = useState(false)
  if (!text) return null
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) })}>
        {done ? '✓ Đã chép' : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">{done ? `Đã sao chép: ${label}` : ''}</span>
    </>
  )
}

// --- Trang chính: chọn loại + form + nội dung đã viết ---------------------------------------------------------

export default function QuickWrite() {
  usePageTitle('Viết nhanh')
  const [params, setParams] = useSearchParams()
  const { data: catalog, error } = useFetch(api.quickTypes, [])
  const typeKey = params.get('type') || ''
  const fromId = params.get('from') || ''
  const type = catalog?.types[typeKey]
  const pick = (k) => setParams(k ? { type: k } : {}, { replace: false })

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Viết nhanh</h1>
          <p className="muted">
            Một nội dung marketing trong vài phút, không cần lập chiến dịch: chọn loại, điền vài ô, AI viết theo sự thật trong
            {' '}<Link className="link" to="/wiki">VCWIKI</Link> và tư liệu anh chị dán vào, tự kiểm tra quy cách kênh, giám khảo chấm và sửa trước khi đưa người duyệt.
            Chiến dịch nhiều bài, nhiều kênh thì dùng <Link className="link" to="/studio">Xưởng chiến dịch</Link>.
          </p>
        </div>
      </header>
      <ErrorBox>{error}</ErrorBox>
      {catalog && !catalog.ai.ready && (
        <div className="notice"><b>AI chưa sẵn sàng:</b> {catalog.ai.error}. Yêu cầu vẫn được lưu và tự chạy khi máy chủ có AI.</div>
      )}
      {catalog && (
        <div className={`quick-layout ${type ? 'has-type' : ''}`}>
          <TypePicker catalog={catalog} value={typeKey} onPick={pick} />
          <div className="quick-main">
            {type
              ? <QuickForm key={`${typeKey}:${fromId}`} typeKey={typeKey} type={type} catalog={catalog} fromId={fromId} onChange={() => pick('')} />
              : <TypeGallery catalog={catalog} onPick={pick} />}
          </div>
        </div>
      )}
      {catalog && <History catalog={catalog} />}
    </>
  )
}

function TypePicker({ catalog, value, onPick }) {
  return (
    <nav className="quick-types card" aria-label="Loại nội dung">
      {Object.entries(catalog.groups).map(([g, label]) => (
        <div key={g} className="quick-group">
          <div className="quick-group-title">{label}</div>
          {Object.entries(catalog.types).filter(([, t]) => t.group === g).map(([k, t]) => (
            <button key={k} type="button" className={`quick-type ${value === k ? 'on' : ''}`} onClick={() => onPick(k)} aria-pressed={value === k}>
              <span className="quick-icon" aria-hidden>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}

function TypeGallery({ catalog, onPick }) {
  return (
    <section className="card">
      <h2>Chọn loại nội dung muốn viết</h2>
      {Object.entries(catalog.groups).map(([g, label]) => (
        <div key={g}>
          <h3>{label}</h3>
          <div className="quick-gallery">
            {Object.entries(catalog.types).filter(([, t]) => t.group === g).map(([k, t]) => (
              <button key={k} type="button" className="quick-tile" onClick={() => onPick(k)}>
                <span className="quick-icon" aria-hidden>{t.icon}</span>
                <span><b>{t.label}</b><small>{t.desc}</small></span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function Field({ f, value, onChange, authors }) {
  const set = (e) => onChange(e.target.value)
  const label = <span>{f.label}{f.required && ' *'}</span>
  let input
  if (f.kind === 'textarea') {
    input = <textarea rows={f.key === 'source' || f.key === 'site_urls' ? 5 : 3} value={value} onChange={set} maxLength={f.max} placeholder={f.placeholder} required={f.required} />
  } else if (f.kind === 'select') {
    input = <select value={value} onChange={set}>{f.options.map((o) => <option key={optValue(o)} value={optValue(o)}>{optLabel(o)}</option>)}</select>
  } else if (f.kind === 'number') {
    input = <input type="number" min={f.min} max={f.max} value={value} onChange={set} />
  } else if (f.kind === 'author') {
    const ok = (authors || []).filter((a) => a.consent)
    input = (
      <select value={value} onChange={set}>
        <option value="">— Chọn người đứng tên —</option>
        {ok.map((a) => <option key={a.id} value={a.id}>{a.name}{a.title ? ` · ${a.title}` : ''}</option>)}
      </select>
    )
  } else {
    input = <input type={f.key.endsWith('url') ? 'url' : 'text'} value={value} onChange={set} maxLength={f.max} placeholder={f.placeholder} required={f.required} />
  }
  return (
    <label className={`field ${f.kind === 'number' ? 'field-sm' : ''}`}>
      {label}{input}
      {f.hint && <small>{f.hint}</small>}
      {f.kind === 'author' && <small>Chỉ hiện người đã xác nhận đồng ý. Thêm ở <Link className="link" to="/studio/authors">Người đứng tên</Link>.</small>}
    </label>
  )
}

function QuickForm({ typeKey, type, catalog, fromId, onChange }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: spaces } = useFetch(api.spaces, [])
  // Dự án marketing (BA 5.13): ?project=<id> từ trang dự án; chọn dự án thì kho = kho dự án, thẻ ghim của dự án làm căn cứ
  const [projectId, setProjectId] = useState(params.get('project') || '')
  const { data: projects } = useFetch(() => api.projects({ status: 'active' }), [])
  const project = projects?.find((x) => x.id === projectId)
  const needsAuthor = type.fields.some((f) => f.kind === 'author')
  const { data: authors } = useFetch(() => (needsAuthor ? api.authors() : Promise.resolve([])), [needsAuthor])
  const { data: from } = useFetch(() => (fromId ? api.quick(fromId) : Promise.resolve(null)), [fromId])
  const personal = spaces?.find((s) => s.type === 'personal' && s.my_role === 'owner')
  const [spaceId, setSpaceId] = useState('')
  const [inputs, setInputs] = useState(() => defaults(type))
  const [judge, setJudge] = useState(type.judge)
  const [useWiki, setUseWiki] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const converting = from && from.type !== typeKey

  useEffect(() => { if (personal && !spaceId) setSpaceId(personal.id) }, [personal, spaceId])
  // Làm lại / chuyển thể từ một nội dung khác: điền sẵn các ô trùng tên
  useEffect(() => {
    if (!from) return
    const keys = new Set(type.fields.map((f) => f.key))
    setInputs((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(from.inputs).filter(([k, v]) => keys.has(k) && v !== '' && v != null)) }))
  }, [from]) // eslint-disable-line react-hooks/exhaustive-deps

  const channel = inputs.channel
  const shown = type.fields.filter((f) => f.kind !== 'author' || PERSONAL_CHANNELS.includes(channel))
  const main = shown.filter((f) => !ADVANCED.includes(f.key))
  const advanced = shown.filter((f) => ADVANCED.includes(f.key))
  const set = (k) => (v) => setInputs({ ...inputs, [k]: v })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = { type: typeKey, space_id: spaceId || null, project_id: projectId || null, inputs, judge, use_wiki: useWiki, parent_id: converting ? from.id : null }
      if (!shown.some((f) => f.kind === 'author')) body.inputs = { ...inputs, author_id: '' }
      const p = await api.createQuick(body)
      navigate(`/studio/quick/${p.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="form card" onSubmit={submit}>
      <button type="button" className="btn btn-ghost btn-sm quick-change" onClick={onChange}>← Đổi loại nội dung</button>
      <div className="row-between">
        <div>
          <h2><span className="quick-icon" aria-hidden>{type.icon}</span> {type.label}</h2>
          <p className="muted small">{type.desc}</p>
        </div>
        <div className="row">
          <label className="field field-space"><span>Thuộc dự án</span><ProjectSelect projects={projects?.filter((x) => x.can_edit)} value={projectId} onChange={(v) => setProjectId(v || '')} /></label>
          {!project && <label className="field field-space"><span>Lưu vào kho</span><SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly /></label>}
        </div>
      </div>
      {project && <div className="notice small">Viết trong dự án <Link className="link" to={`/studio/projects/${project.id}`}>{project.name}</Link> (kho {project.space_name}): {project.card_count} thẻ ghim của dự án được dùng làm căn cứ.</div>}
      {from && (
        <div className="notice small">
          {converting ? <>Chuyển thể từ <b>{from.type_label}</b>: “{from.title}” — AI dùng nội dung gốc làm căn cứ, viết lại cho kênh mới.</>
            : <>Điền sẵn từ “{from.title}”. Sửa đầu vào rồi viết bản mới.</>}
        </div>
      )}
      <div className="quick-fields">
        {main.map((f) => <Field key={f.key} f={f} value={inputs[f.key] ?? ''} onChange={set(f.key)} authors={authors} />)}
      </div>
      {advanced.length > 0 && (
        <details className="quick-advanced" open={advanced.some((f) => inputs[f.key])}>
          <summary>Tư liệu thêm cho AI <span className="muted small">(số liệu thật, bài tham khảo — giúp bài cụ thể, không bịa)</span></summary>
          {advanced.map((f) => <Field key={f.key} f={f} value={inputs[f.key] ?? ''} onChange={set(f.key)} authors={authors} />)}
        </details>
      )}
      <div className="quick-options">
        <label className="check"><input type="checkbox" checked={judge} onChange={(e) => setJudge(e.target.checked)} />
          Giám khảo AI chấm và tự sửa (dưới {catalog.pass_score} điểm thì viết lại, tối đa {catalog.max_rounds} vòng)</label>
        <label className="check"><input type="checkbox" checked={useWiki} onChange={(e) => setUseWiki(e.target.checked)} />
          Lấy thẻ VCWIKI liên quan làm căn cứ</label>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <div className="actions">
        <button className="btn btn-primary" disabled={busy} data-testid="quick-piece-create">{busy ? 'Đang gửi…' : '✎ Viết ngay'}</button>
        <span className="muted small">{judge ? 'Thường mất 1–3 phút.' : 'Thường mất dưới 1 phút.'}</span>
      </div>
    </form>
  )
}

function History({ catalog }) {
  const navigate = useNavigate()
  // Lọc theo trạng thái nằm trên URL (?status=) để link từ Việc của tôi (SCR-01) lọc đúng; giá trị ngoài REVIEW (vd needs_fix) gửi nguyên cho BE
  const [url, setUrl] = useUrlState({ status: { default: '' } })
  const [f, setF] = useState({ type: '', mine: true, q: '' })
  const [page, setPage] = useState(1)
  const dq = useDebounced(f.q)
  const [interval, setInterval_] = useState(0)
  const statusQuery = REVIEW[url.status] ? { review_status: url.status } : url.status ? { status: url.status } : {}
  const query = { ...f, ...statusQuery, q: dq, mine: f.mine ? 'true' : '', page, page_size: 20 }
  const { data, error } = useFetch(() => api.quickList(query), [JSON.stringify(query)], interval)
  useEffect(() => setInterval_(data?.items.some((x) => BUSY.includes(x.status)) ? 4000 : 0), [data])
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); setPage(1) }
  const setStatus = (e) => { setUrl({ status: e.target.value }); setPage(1) }

  return (
    <section className="quick-history">
      <h2>Nội dung đã viết</h2>
      <div className="filters card" role="search" aria-label="Lọc nội dung đã viết">
        <input className="search" type="search" placeholder="Tìm theo tiêu đề…" aria-label="Tìm theo tiêu đề" value={f.q} onChange={set('q')} />
        <select value={f.type} onChange={set('type')} aria-label="Lọc loại">
          <option value="">Mọi loại</option>
          {Object.entries(catalog.types).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        <select value={url.status} onChange={setStatus} aria-label="Lọc duyệt" data-testid="quick-status-filter">
          <option value="">Mọi trạng thái duyệt</option>
          {Object.entries(REVIEW).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          {url.status && !REVIEW[url.status] && <option value={url.status}>{url.status === 'error' ? 'Viết lỗi' : 'Trạng thái khác'}</option>}
        </select>
        <label className="check nowrap"><input type="checkbox" checked={f.mine} onChange={set('mine')} /> Của tôi</label>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {data?.items.length === 0 && <Empty>Chưa có nội dung nào. Chọn một loại ở trên để viết bài đầu tiên.</Empty>}
      {data?.items.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <caption className="sr-only">Nội dung Viết nhanh đã viết</caption>
            <thead><tr><th scope="col">Nội dung</th><th scope="col">Loại</th><th scope="col">Trạng thái</th><th scope="col">Điểm</th><th scope="col">Tạo lúc</th></tr></thead>
            <tbody>
              {data.items.map((x) => (
                <tr key={x.id} data-id={x.id} data-status={x.status === 'done' ? (x.review_status || 'draft') : x.overall} data-kind={x.type} data-testid="quick-piece-row" onClick={() => navigate(`/studio/quick/${x.id}`)}>
                  <td className="cell-video">
                    <Link className="strong clamp-1" to={`/studio/quick/${x.id}`}>{x.title}</Link>
                    <div className="muted small">{x.created_by_name}</div>
                  </td>
                  <td className="small">{x.type_label}</td>
                  <td>
                    <PieceStatus s={x.overall} />{' '}
                    {x.status === 'done' && <Badge tone={REVIEW[x.review_status]?.tone}>{REVIEW[x.review_status]?.label}</Badge>}
                    {x.error && <div className="tone-bad small clamp-2">{x.error}</div>}
                  </td>
                  <td><Score value={x.score} /></td>
                  <td className="nowrap small">{dateTime(x.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-foot">
            <span className="muted small">{num(data.total)} nội dung</span>
            <Pagination page={page} pageSize={20} total={data.total} onPage={setPage} />
          </div>
        </div>
      )}
    </section>
  )
}

// Gán / bỏ gán dự án cho một nội dung đã có (chỉ dự án cùng kho) — dùng ở trang bài Viết nhanh và trang chiến dịch
export function ProjectAssign({ spaceId, value, onChange }) {
  const { data: projects } = useFetch(() => api.projects({ space_id: spaceId, status: 'active' }), [spaceId])
  if (!projects?.length) return null
  return (
    <label className="meta-line small">Thuộc dự án:&nbsp;
      <ProjectSelect projects={projects.filter((x) => x.can_edit)} value={value} onChange={onChange} label="— không —" />
    </label>
  )
}

// --- Trang một nội dung --------------------------------------------------------------------------------------

export function QuickPiece() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [interval, setInterval_] = useState(0)
  const { data: p, error, setData } = useFetch(() => api.quick(id), [id], interval)
  const { data: catalog } = useFetch(api.quickTypes, [])
  const { data: status } = useFetch(api.studioStatus, [])
  const [feedback, setFeedback] = useState('')
  const [target, setTarget] = useState('')
  const [actionError, setActionError] = useState(null)
  const [note, setNote] = useState(null)
  usePageTitle(p?.title)
  useEffect(() => setInterval_(p && BUSY.includes(p.status) ? 3000 : 0), [p?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => {
    setActionError(null)
    try {
      const res = await fn()
      if (res?.id) setData(res)
      return true
    } catch (e) {
      setActionError(e.message)
      return false
    }
  }

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!p || !catalog) return <Loading />
  const type = catalog.types[p.type]
  const c = p.content
  const rv = p.review
  const rubric = status?.rubrics?.[type?.rubric]
  const busy = BUSY.includes(p.status)

  return (
    <>
      <header className="page-head">
        <div className="grow">
          <div className="muted small">
            <Link className="link" to="/studio/quick">← Viết nhanh</Link> · {type?.label} · {p.space_name} · {p.created_by_name} · {dateTime(p.created_at)}
            {p.project_id && <> · Dự án: <Link className="link" to={`/studio/projects/${p.project_id}`}>{p.project_name}</Link></>}
          </div>
          <h1 className="clamp-2">{p.title}</h1>
          {p.can_edit && <ProjectAssign spaceId={p.space_id} value={p.project_id} onChange={(v) => run(() => api.patchQuick(id, { project_id: v }))} />}
          <div className="meta-line">
            <PieceStatus s={p.overall} />
            {c && <Badge tone={REVIEW[p.review_status]?.tone}>{REVIEW[p.review_status]?.label}</Badge>}
            <Score value={p.score} />
            {p.rounds?.length > 1 && <span className="muted small">Điểm qua các vòng: {p.rounds.map((r) => r.total).join(' → ')} (giữ bản cao nhất)</span>}
          </div>
        </div>
        {c && (
          <div className="actions">
            <CopyBtn text={p.text} label="Sao chép toàn bộ" />
            {p.can_edit && p.review_status !== 'approved' && <button className="btn btn-primary" data-testid="quick-piece-approve" onClick={() => run(() => api.patchQuick(id, { review_status: 'approved' }))}>✓ Duyệt</button>}
            {p.can_edit && p.review_status !== 'rejected' && <button className="btn" data-testid="quick-piece-reject" onClick={() => run(() => api.patchQuick(id, { review_status: 'rejected' }))}>Loại</button>}
            {p.can_edit && p.review_status !== 'draft' && <button className="btn btn-ghost" onClick={() => run(() => api.patchQuick(id, { review_status: 'draft' }))}>Về nháp</button>}
          </div>
        )}
      </header>

      {busy && <div className="current card" role="status"><span className="pulse" /> {p.stage || (p.overall === 'waiting_ai' ? 'Chờ cấu hình AI…' : 'Đang chờ AI…')}</div>}
      {p.status === 'error' && <ErrorBox>{p.error}</ErrorBox>}
      {p.source_page?.status === 'error' && <div className="notice small">Không tải được bài tham khảo: {p.source_page.error}</div>}
      <ErrorBox>{actionError}</ErrorBox>

      <div className="quick-result">
        <div className="quick-result-main">
          {c && (
            <article className="card" aria-label="Bản nháp" data-testid="quick-piece-draft" data-status={p.review_status}>
              {type.sections.map((s, i) => <Section key={i} s={s} c={c} p={p} />)}
              {c.facts_to_verify?.length > 0 && (<><h3 className="tone-bad">Cần kiểm chứng trước khi đăng</h3><List items={c.facts_to_verify} /></>)}
              {c.sources && (c.sources.refs.length + c.sources.cards.length > 0 || c.sources.notes) && (
                <><h3>Căn cứ</h3><p className="small">{[...c.sources.refs, ...c.sources.cards].join(', ')}{c.sources.notes && ` — ${c.sources.notes}`}</p></>
              )}
            </article>
          )}
          {p.can_edit && !busy && (
            <section className="card">
              <h2>Chỉnh tiếp</h2>
              <div className="copy-row">
                <input placeholder="Góp ý để AI sửa — VD: mở đầu gắt hơn, bỏ emoji, thêm ưu đãi 10% đến 31/10" value={feedback} onChange={(e) => setFeedback(e.target.value)} aria-label="Góp ý" />
                <button className="btn" data-testid="quick-piece-rewrite" onClick={async () => (await run(() => api.rewriteQuick(id, feedback))) && setFeedback('')}>{feedback.trim() ? 'Sửa theo góp ý' : 'Viết lại bản khác'}</button>
              </div>
              <div className="copy-row repurpose">
                <span className="small strong nowrap">Chuyển thể sang</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Chuyển thể sang loại">
                  <option value="">— Chọn loại —</option>
                  {Object.entries(catalog.types).filter(([k]) => k !== p.type).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                </select>
                <button className="btn" disabled={!target || !c} onClick={() => navigate(`/studio/quick?type=${target}&from=${id}`)}>Mở form</button>
                <Link className="btn btn-ghost" to={`/studio/quick?type=${p.type}&from=${id}`}>Viết bài mới từ đầu vào này</Link>
              </div>
            </section>
          )}
        </div>

        <aside className="quick-result-side">
          {c && p.type === 'fb_post' && p.status === 'done' && <FacebookPublish source="quick" piece={p} channel={p.inputs.channel} />}
          {(p.checks?.length > 0 || rv) && (
            <section className="card">
              <Checks items={p.checks} />
              {rv && rubric && (
                <>
                  <h3>Giám khảo AI</h3>
                  <p className="small">{rv.verdict}</p>
                  <div className="score-bars">
                    {Object.entries(rubric).map(([k, r]) => (
                      <div key={k} className="score-row">
                        <span>{r.label}</span>
                        <div className="progress"><div className="progress-bar" style={{ width: `${Math.min(100, ((rv.scores[k] || 0) / r.max) * 100)}%` }} /></div>
                        <b>{rv.scores[k] ?? '—'}/{r.max}</b>
                      </div>
                    ))}
                  </div>
                  <h4>Điểm mạnh</h4><List items={rv.strengths} />
                  <h4>Nên sửa thêm</h4><List items={rv.fixes} />
                </>
              )}
            </section>
          )}
          <section className="card">
            <h3>Đầu vào</h3>
            <dl className="kv small">
              {type.fields.filter((f) => p.inputs[f.key] !== '' && p.inputs[f.key] != null && f.kind !== 'author').map((f) => (
                <FieldValue key={f.key} f={f} v={p.inputs[f.key]} />
              ))}
              {p.author && (<><dt>Người đứng tên</dt><dd>{p.author.name}</dd></>)}
            </dl>
            {p.cards?.length > 0 && (
              <>
                <h4>Thẻ VCWIKI làm căn cứ</h4>
                <ul className="small">{p.cards.map((k) => <li key={k.ref}><b>{k.ref}</b> <Link className="link" to={`/wiki?card=${k.card_id}`}>{k.title}</Link></li>)}</ul>
              </>
            )}
            {p.feedback && <p className="small muted">Góp ý gần nhất: {p.feedback}</p>}
          </section>
          <section className="card">
            <h3>Ghi chú của người duyệt</h3>
            {note === null ? (
              <p className="small">{p.note || <span className="muted">—</span>} {p.can_edit && <button className="link" onClick={() => setNote(p.note || '')}>sửa</button>}</p>
            ) : (
              <div className="form">
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Ghi chú" />
                <div className="actions">
                  <button className="btn btn-primary" onClick={async () => (await run(() => api.patchQuick(id, { note }))) && setNote(null)}>Lưu</button>
                  <button className="btn btn-ghost" onClick={() => setNote(null)}>Huỷ</button>
                </div>
              </div>
            )}
            {p.usage && <p className="muted small">AI: {p.usage.calls} lượt · {num(p.usage.input_tokens)} token vào · {num(p.usage.output_tokens)} token ra</p>}
            {p.can_edit && p.status !== 'generating' && (
              <button className="btn btn-ghost btn-danger-text" data-testid="quick-piece-delete" onClick={async () => {
                if (!(await confirmDialog({ title: 'Xoá nội dung này?', body: p.title, okLabel: 'Xoá nội dung', danger: true }))) return
                if (await run(() => api.deleteQuick(id))) navigate('/studio/quick')
              }}>Xoá nội dung</button>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}

function FieldValue({ f, v }) {
  const shown = f.kind === 'select' ? optLabel(f.options.find((o) => optValue(o) === v) || v) : String(v)
  return (<><dt>{f.label}</dt><dd className="pre clamp-3">{shown}</dd></>)
}

// --- Hiển thị kết quả theo `sections` BE khai báo ----------------------------------------------------------------

function Count({ text, limit }) {
  const n = (text || '').length
  if (!limit) return <span className="muted small nowrap">{n} ký tự</span>
  return <span className={`small nowrap ${n > limit ? 'tone-bad' : 'muted'}`}>{n}/{limit}</span>
}

function Section({ s, c, p }) {
  const v = s.key ? c[s.key] : null
  const head = (extra) => s.label && <h3 className="quick-section-head">{s.label}{extra}</h3>
  switch (s.kind) {
    case 'post': return <PostBody c={c} p={p} />
    case 'video': return <VideoBody c={c} />
    case 'seo': return (<><div className="actions"><CopyBtn text={c.body} label="Chép thân bài (Markdown)" /><CopyBtn text={c.schema_jsonld} label="Chép JSON-LD" /></div><SeoBody c={c} /></>)
    case 'serp': return <SerpOptions items={v || []} />
    case 'text': return v ? (<>{head(s.copy && <CopyBtn text={v} />)}<p className="pre">{v}</p></>) : null
    case 'md': return v ? (<>{head(s.copy && <CopyBtn text={v} />)}<div className="article-preview"><Markdown text={v} /></div></>) : null
    case 'list':
      if (!v?.length) return null
      return (
        <>
          {head(<CopyBtn text={v.join(s.inline ? ' ' : '\n')} />)}
          {s.inline ? <p className="chips">{v.map((x, i) => <span key={i} className="chip">{x}</span>)}</p>
            : <ol className="quick-list">{v.map((x, i) => <li key={i}><span>{x}</span>{s.count && <Count text={x} />}</li>)}</ol>}
        </>
      )
    case 'limited':
      if (!v?.length) return null
      return (
        <>
          {head(<><span className="muted small"> · tối đa {s.limit} ký tự</span><CopyBtn text={v.join('\n')} /></>)}
          <ol className="quick-list">{v.map((x, i) => <li key={i} className={x.length > s.limit ? 'over' : ''}><span>{x}</span><Count text={x} limit={s.limit} /></li>)}</ol>
        </>
      )
    case 'table':
      if (!v?.length) return null
      return (
        <>
          {head()}
          <div className="table-wrap">
            <table className="table table-static quick-table">
              <thead><tr><th>#</th>{s.cols.map(([k, label]) => <th key={k}>{label}</th>)}</tr></thead>
              <tbody>
                {v.map((row, i) => (
                  <tr key={i}>
                    <td className="muted">{i + 1}</td>
                    {s.cols.map(([k, , o = {}]) => (
                      <td key={k} className="pre">
                        {row[k]}
                        {(o.limit || o.count) && <div><Count text={row[k]} limit={o.limit} /></div>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )
    case 'fields': {
      const rows = s.items.map(([path, label]) => [label, get(c, path)]).filter(([, x]) => x != null && x !== '' && !(Array.isArray(x) && !x.length))
      if (!rows.length) return null
      return (
        <>
          {head()}
          <dl className="kv">
            {rows.map(([label, x]) => (
              <FieldRow key={label} label={label} x={x} />
            ))}
          </dl>
        </>
      )
    }
    default: return null
  }
}

function FieldRow({ label, x }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{Array.isArray(x) ? <ul className="quick-tight">{x.map((y, i) => <li key={i}>{y}</li>)}</ul> : <span className="pre">{x}</span>}</dd>
    </>
  )
}

function SerpOptions({ items }) {
  return (
    <>
      <h3>Phương án meta — xem trước trên Google</h3>
      {items.map((o, i) => (
        <div key={i} className="serp-preview">
          <div className="serp-url">…/{o.slug}</div>
          <div className="serp-title">{o.meta_title}</div>
          <div className="serp-desc">{o.meta_description}</div>
          <div className="row-between small">
            <span className="muted">{o.angle} · title <Count text={o.meta_title} limit={60} /> · description <Count text={o.meta_description} limit={160} /></span>
            <CopyBtn text={`${o.meta_title}\n${o.meta_description}`} />
          </div>
        </div>
      ))}
    </>
  )
}

function PostBody({ c, p }) {
  const [pick, setPick] = useState(0)
  const hooks = c.hooks || []
  const ch = p.inputs.channel
  const text = useMemo(() => {
    const link = c.link && c.link_placement === 'trong bài' ? `\n\n${c.link.utm_url}` : ''
    return `${hooks[pick] || ''}\n\n${c.body}${link}${c.hashtags.length ? `\n\n${c.hashtags.join(' ')}` : ''}`
  }, [c, pick]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <p className="small muted">{CHANNEL[ch] || EXTRA_CHANNEL[ch] || ch} · Người đứng tên: {p.author?.name || '—'} · Giờ đăng: {c.best_time}</p>
      <h3>Mở đầu — chọn một trong 3 phương án</h3>
      <div className="hook-options">
        {hooks.map((h, i) => (
          <label key={i} className={`hook-option ${pick === i ? 'on' : ''}`}>
            <input type="radio" name="hook" checked={pick === i} onChange={() => setPick(i)} />
            <span className="pre">{h}</span>
          </label>
        ))}
      </div>
      <h3 className="quick-section-head">Xem trước bài đăng <CopyBtn text={text} label="Chép bài với mở đầu đã chọn" /></h3>
      <div className="post-preview">
        <div className="strong pre">{hooks[pick]}</div>
        <div className="pre">{c.body}</div>
        {c.link && c.link_placement === 'trong bài' && <div className="link">{c.link.utm_url}</div>}
        {c.hashtags.length > 0 && <div className="tone-info">{c.hashtags.join(' ')}</div>}
      </div>
      {c.first_comment && (
        <>
          <h3 className="quick-section-head">Bình luận đầu <CopyBtn text={`${c.first_comment}${c.link && c.link_placement === 'bình luận đầu' ? `\n${c.link.utm_url}` : ''}`} /></h3>
          <div className="panel pre small">{c.first_comment}{c.link && c.link_placement === 'bình luận đầu' ? `\n${c.link.utm_url}` : ''}</div>
        </>
      )}
      {c.link && <p className="small muted">Link ({c.link_placement}): <span className="mono">{c.link.utm_url}</span></p>}
      <h3>Hình ảnh</h3>
      <p className="small"><b>{c.visual.type}</b> — {c.visual.description}</p>
      {c.visual.slides.length > 0 && <ol className="small">{c.visual.slides.map((x, i) => <li key={i}>{x}</li>)}</ol>}
    </>
  )
}
