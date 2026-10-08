import { useId, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useDebounced, useFetch } from '../hooks'
import { CARD_STATUS, CARD_TYPE, CHANNEL, PROJECT_ROLE, RESOURCE_KIND, compact, dateTime, num } from '../format'
import { Badge, Empty, ErrorBox, Loading } from '../components/ui'
import { confirmDialog } from '../components/dialog'
import { Markdown } from '../components/markdown'
import { CampaignStatus } from './Studio'
import { ProjectForm } from './Projects'
import ProjectAnalysis from './ProjectAnalysis'

// Trang một dự án marketing (BA 5.13, đợt 1): tổng quan + thành viên · tài nguyên · thẻ học · chiến dịch · nội dung.
// Phân tích 7P, kế hoạch kỳ, lịch đăng: đợt sau (CE-27…31).
const TABS = [['overview', 'Tổng quan'], ['resources', 'Tài nguyên'], ['cards', 'Thẻ học'], ['analysis', 'Phân tích'], ['campaigns', 'Chiến dịch'], ['contents', 'Viết nhanh']]

export default function Project() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'overview'
  const { data: p, error, setData, reload } = useFetch(() => api.project(id), [id])
  const [editing, setEditing] = useState(false)
  const [actionError, setActionError] = useState(null)

  const run = async (fn) => {
    setActionError(null)
    try {
      const res = await fn()
      if (res?.id === id) setData(res)
      else reload()
      return true
    } catch (e) {
      setActionError(e.message)
      return false
    }
  }

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!p) return <Loading />
  const canDelete = p.can_manage && !p.campaign_count && !p.quick_count

  return (
    <>
      <Link className="crumb link" to="/studio/projects">‹ Dự án marketing</Link>
      <header className="page-head">
        <div>
          <h1>{p.name}</h1>
          <p className="muted">
            {p.status === 'archived' ? <Badge tone="muted">Đã lưu trữ</Badge> : <Badge tone="good">Đang chạy</Badge>}
            {' · '}{p.space_name} · {p.created_by_name} · {dateTime(p.created_at)} · Vai trò của tôi: <b>{PROJECT_ROLE[p.my_role]}</b>
          </p>
        </div>
        <div className="actions">
          {p.can_edit && <button className="btn btn-ghost" data-testid="project-edit" onClick={() => setEditing(true)}>Sửa</button>}
          {p.can_manage && (
            <button className="btn btn-ghost" data-testid={p.status === 'archived' ? 'project-reopen' : 'project-archive'} onClick={() => run(() => api.patchProject(id, { status: p.status === 'archived' ? 'active' : 'archived' }))}>
              {p.status === 'archived' ? 'Mở lại' : 'Lưu trữ'}
            </button>
          )}
          {canDelete && (
            <button className="btn btn-ghost btn-danger-text" aria-label={`Xoá dự án: ${p.name}`} data-testid="project-delete"
              onClick={async () => {
                if (!(await confirmDialog({ title: 'Xoá dự án này?', body: 'Tài nguyên và thẻ ghim của dự án bị xoá theo.', okLabel: 'Xoá dự án', danger: true }))) return
                if (await run(() => api.deleteProject(id))) navigate('/studio/projects')
              }}>Xoá</button>
          )}
        </div>
      </header>
      <ErrorBox>{actionError}</ErrorBox>

      <div className="tabs tabs-top">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} aria-pressed={tab === k} data-testid={`project-tab-${k}`} onClick={() => setParams({ tab: k }, { replace: true })}>
            {label}{k === 'resources' && p.resources.length ? ` (${p.resources.length})` : ''}{k === 'cards' && p.cards.length ? ` (${p.cards.length})` : ''}{k === 'analysis' && p.analysis ? ` (v${p.analysis.version})` : ''}
            {k === 'campaigns' && p.campaign_count ? ` (${p.campaign_count})` : ''}{k === 'contents' && p.quick_count ? ` (${p.quick_count})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab p={p} run={run} />}
      {tab === 'resources' && <ResourcesTab p={p} run={run} />}
      {tab === 'cards' && <CardsTab p={p} run={run} />}
      {tab === 'analysis' && <ProjectAnalysis p={p} reloadProject={reload} />}
      {tab === 'campaigns' && <CampaignsTab p={p} />}
      {tab === 'contents' && <ContentsTab p={p} />}

      {editing && <ProjectForm project={p} onClose={() => setEditing(false)} onSaved={(saved) => { setEditing(false); setData(saved) }} />}
    </>
  )
}

// --- Tổng quan + thành viên ---------------------------------------------------------------------------------

function OverviewTab({ p, run }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  return (
    <div className="grid-2">
      <section className="card">
        <h2>Mục tiêu</h2>
        {p.goal ? <p>{p.goal}</p> : <p className="muted">Chưa ghi mục tiêu — bấm <b>Sửa</b> để thêm.</p>}
        {p.description && (<><h3>Mô tả</h3><Markdown text={p.description} /></>)}
        <div className="stats-row">
          <span><b>{p.resources.length}</b> tài nguyên</span>
          <span><b>{p.cards.length}</b> thẻ ghim</span>
          <span><b>{p.courses?.length || 0}</b> khoá ghim</span>
          <span><b>{p.campaign_count}</b> chiến dịch</span>
          <span><b>{p.quick_count}</b> bài Viết nhanh</span>
        </div>
        <p className="muted small">
          {p.analysis ? <>Phân tích hiện hành: <b>7P phiên bản {p.analysis.version}</b> (tab Phân tích) — chiến dịch và bài viết mới nạp bản này làm căn cứ.</> : <>Chưa chốt phân tích 7P — làm ở tab <b>Phân tích</b> để chiến dịch có định vị nhất quán.</>}
          {' '}Sắp có: kế hoạch kỳ (KPI theo kênh), lịch đăng và luồng duyệt (BA 5.13, đợt 3–4).
        </p>
      </section>
      <section className="card">
        <h2>Thành viên</h2>
        <p className="muted small">
          Ai xem được <b>kho</b> thì xem được dự án; ai sửa được kho thì sửa được dự án. Mời thêm người ngoài kho hoặc nâng quyền riêng cho dự án ở đây:
          <i> chủ dự án</i> quản lý mọi thứ, <i>biên tập</i> thêm tài nguyên / lập chiến dịch, <i>người duyệt</i> chỉ duyệt nội dung, <i>chỉ xem</i>.
        </p>
        <table className="table">
          <caption className="sr-only">Thành viên dự án và vai trò</caption>
          <tbody>
            {p.members.map((m) => (
              <tr key={m.user_id} data-id={m.user_id} data-role={m.role}>
                <td className="strong">{m.name || m.user_id}</td>
                <td>
                  {p.can_manage ? (
                    <select value={m.role} aria-label={`Vai trò ${m.name}`} onChange={(e) => run(() => api.setProjectMemberRole(p.id, m.user_id, e.target.value))}>
                      {Object.entries(PROJECT_ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : m.role_label}
                </td>
                <td className="num">
                  {p.can_manage && (
                    <button className="btn btn-ghost btn-sm btn-danger-text" aria-label={`Bỏ thành viên: ${m.name || m.user_id}`} data-testid="project-member-remove"
                      onClick={async () => { if (await confirmDialog({ title: `Bỏ ${m.name} khỏi dự án?`, okLabel: 'Bỏ khỏi dự án', danger: true })) run(() => api.removeProjectMember(p.id, m.user_id)) }}>Bỏ</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {p.can_manage && (
          <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api.addProjectMember(p.id, { email, role }))) setEmail('') }}>
            <input className="grow" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email người dùng trong hệ thống" aria-label="Email thành viên" required />
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Vai trò mới">
              {Object.entries(PROJECT_ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn" data-testid="project-member-add">+ Mời</button>
          </form>
        )}
      </section>
    </div>
  )
}

// --- Kho tài nguyên tham chiếu (CE-26) ------------------------------------------------------------------------

const KIND_ORDER = ['video', 'url', 'social_post', 'document']

function ResourcesTab({ p, run }) {
  const [adding, setAdding] = useState(false)
  const [viewing, setViewing] = useState(null)
  const groups = KIND_ORDER.map((k) => [k, p.resources.filter((r) => r.kind === k)]).filter(([, rows]) => rows.length)
  return (
    <>
      <div className="row-between">
        <p className="muted small grow">
          Tham chiếu dùng chung cho mọi chiến dịch của dự án: <b>R</b> video viral trong Kho video · <b>S</b> trang web (top Google, đối thủ) ·
          <b> P</b> bài mạng xã hội mẫu · <b>D</b> tài liệu trong Kho tư liệu. Mỗi mục được chụp lại lúc thêm nên nguồn đổi sau này không làm lệch căn cứ.
        </p>
        {p.can_edit && <button className="btn btn-primary" data-testid="project-resource-add" onClick={() => setAdding(true)}>+ Thêm tài nguyên</button>}
      </div>
      {!p.resources.length && <Empty>Chưa có tài nguyên nào. {p.can_edit ? 'Bấm + Thêm tài nguyên: chọn video trong Kho video, dán link trang web, dán bài mẫu hoặc chọn tài liệu.' : ''}</Empty>}
      {groups.map(([kind, rows]) => (
        <section key={kind} className="card">
          <h2>{RESOURCE_KIND[kind].label} <span className="muted small">({rows.length})</span></h2>
          <table className="table">
            <caption className="sr-only">Tài nguyên loại {RESOURCE_KIND[kind].label}</caption>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ref} data-id={r.ref} data-kind={kind}>
                  <td className="nowrap"><span className="chip">{r.ref}</span></td>
                  <td>
                    <div className="strong clamp-1">{r.url && kind !== 'social_post' ? <a className="link" href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : r.title}</div>
                    <div className="muted small clamp-1">
                      {kind === 'video' && <>@{r.channel_handle} · {compact(r.views)} lượt xem · viral {r.metrics?.viral_score ?? '—'}</>}
                      {kind === 'url' && <>{num(r.words)} từ · {r.headings?.length || 0} đề mục</>}
                      {kind === 'social_post' && <>{CHANNEL[r.channel]?.label || r.channel}{r.url && <> · <a className="link" href={r.url} target="_blank" rel="noreferrer">bài gốc</a></>}</>}
                      {kind === 'document' && <Link className="link" to={`/kb?doc=${r.document_id}`}>Mở trong Kho tư liệu</Link>}
                      {r.note && <> · <i>{r.note}</i></>}
                    </div>
                  </td>
                  <td className="num nowrap">
                    {r.has_text && <button className="btn btn-ghost btn-sm" aria-label={`Xem tài nguyên: ${r.ref} ${r.title}`} data-testid="project-resource-view" onClick={() => setViewing(r.ref)}>Xem</button>}
                    {kind === 'video' && <Link className="btn btn-ghost btn-sm" to={`/kb/videos?id=${r.video_id}`}>Kho video</Link>}
                    {p.can_edit && (
                      <button className="btn btn-ghost btn-sm btn-danger-text" aria-label={`Bỏ tài nguyên: ${r.ref} ${r.title}`} data-testid="project-resource-remove"
                        onClick={async () => { if (await confirmDialog({ title: `Bỏ ${r.ref} khỏi dự án?`, body: r.title, okLabel: 'Bỏ tài nguyên', danger: true })) run(() => api.removeProjectResource(p.id, r.ref)) }}>Bỏ</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {adding && <AddResource p={p} run={run} onClose={() => setAdding(false)} />}
      {viewing && <ResourceView p={p} refCode={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

function ResourceView({ p, refCode, onClose }) {
  const { data: r, error } = useFetch(() => api.projectResource(p.id, refCode), [p.id, refCode])
  const titleId = useId()
  return (
    <>
      <div className="overlay" aria-hidden="true" onClick={onClose} />
      <aside className="drawer drawer-wide" role="dialog" aria-labelledby={titleId} data-testid="project-resource-drawer">
        <div className="drawer-head">
          <h2 className="grow" id={titleId}>{refCode} · {r?.title || '…'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={`Đóng: ${refCode} · ${r?.title || 'tài nguyên'}`} title="Đóng">✕</button>
        </div>
        <div className="drawer-body">
          <ErrorBox>{error}</ErrorBox>
          {r && <p className="muted small">{RESOURCE_KIND[r.kind]?.label} · thêm bởi {r.added_by_name} · {dateTime(r.added_at)}{r.note && <> · {r.note}</>}</p>}
          {r?.headings?.length > 0 && <details><summary>{r.headings.length} đề mục</summary><ul>{r.headings.map((h, i) => <li key={i}>{h}</li>)}</ul></details>}
          {r && <pre className="pre-wrap">{r.text}</pre>}
        </div>
      </aside>
    </>
  )
}

function AddResource({ p, run, onClose }) {
  const [kind, setKind] = useState('video')
  const [f, setF] = useState({ url: '', title: '', channel: 'fanpage', text: '', note: '' })
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { data: picks } = useFetch(() => (kind === 'video' ? api.projectPickVideos(p.id, { q: dq })
    : kind === 'document' ? api.projectPickDocuments(p.id, { q: dq }) : Promise.resolve([])), [kind, dq, p.id])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const have = new Set(p.resources.map((r) => r.video_id || r.document_id || r.url).filter(Boolean))

  const add = async (body) => {
    setBusy(true)
    setError(null)
    try {
      await api.addProjectResource(p.id, { kind, note: f.note, ...body })
      await run(() => api.project(p.id))
      if (kind === 'video' || kind === 'document') setBusy(false)   // thêm tiếp được
      else onClose()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }
  const submit = (e) => {
    e.preventDefault()
    if (kind === 'url') add({ url: f.url, title: f.title })
    if (kind === 'social_post') add({ channel: f.channel, text: f.text, url: f.url || null, title: f.title })
  }

  const titleId = useId()
  return (
    <>
      <div className="overlay" aria-hidden="true" onClick={onClose} />
      <aside className="drawer drawer-wide" role="dialog" aria-labelledby={titleId} data-testid="project-resource-add-drawer">
        <div className="drawer-head">
          <h2 className="grow" id={titleId}>Thêm tài nguyên tham chiếu</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng: Thêm tài nguyên tham chiếu" title="Đóng">✕</button>
        </div>
        <form className="drawer-body form" onSubmit={submit}>
          <div className="tabs" role="group" aria-label="Loại tài nguyên">
            {KIND_ORDER.map((k) => <button type="button" key={k} className={kind === k ? 'active' : ''} aria-pressed={kind === k} onClick={() => { setKind(k); setError(null) }}>{RESOURCE_KIND[k].label}</button>)}
          </div>
          <label className="field"><span>Ghi chú <em>(vì sao tham khảo)</em></span>
            <input value={f.note} onChange={set('note')} maxLength={500} placeholder="VD: hook mở đầu hay, dùng cho series TikTok" />
          </label>
          {(kind === 'video' || kind === 'document') && (
            <>
              <label className="field"><span>{kind === 'video' ? 'Tìm trong Kho video (đã chuyển chữ, xếp theo điểm viral)' : 'Tìm trong Kho tư liệu (theo tên)'}</span>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ để lọc…" autoFocus />
              </label>
              {picks?.length === 0 && <Empty>Không có mục nào khớp.</Empty>}
              {picks?.length > 0 && (
                <table className="table">
                  <caption className="sr-only">{kind === 'video' ? 'Video tìm được trong Kho video' : 'Tài liệu tìm được trong Kho tư liệu'}</caption>
                  <tbody>
                    {picks.map((x) => {
                      const key = kind === 'video' ? x.id : x.id
                      const added = have.has(key)
                      return (
                        <tr key={x.id} data-id={x.id} data-status={added ? 'added' : 'available'}>
                          <td>
                            <div className="strong clamp-1">{kind === 'video' ? (x.caption || x.id) : x.title}</div>
                            <div className="muted small clamp-1">{kind === 'video' ? <>@{x.channel_handle} · {compact(x.views)} lượt xem · viral {x.metrics?.viral_score ?? '—'}</> : <>{x.url || ''}</>}</div>
                          </td>
                          <td className="num nowrap">
                            <button type="button" className="btn btn-sm" disabled={busy || added}
                              onClick={() => add(kind === 'video' ? { video_id: x.id } : { document_id: x.id })}>{added ? 'Đã có' : '+ Thêm'}</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
          {kind === 'url' && (
            <>
              <label className="field"><span>Link trang web *</span>
                <input type="url" value={f.url} onChange={set('url')} required placeholder="https://…" autoFocus />
                <small>Hệ thống tải trang, trích nội dung và đề mục (như trang top Google của luồng SEO).</small>
              </label>
              <label className="field"><span>Tên gợi nhớ <em>(tuỳ chọn)</em></span><input value={f.title} onChange={set('title')} maxLength={200} /></label>
            </>
          )}
          {kind === 'social_post' && (
            <>
              <label className="field"><span>Kênh</span>
                <select value={f.channel} onChange={set('channel')}>
                  {Object.entries(CHANNEL).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                </select>
              </label>
              <label className="field"><span>Nội dung bài mẫu * <em>(≥ 20 ký tự)</em></span>
                <textarea rows={8} value={f.text} onChange={set('text')} required minLength={20} maxLength={8000} autoFocus />
              </label>
              <div className="row">
                <label className="field grow"><span>Tên gợi nhớ</span><input value={f.title} onChange={set('title')} maxLength={200} /></label>
                <label className="field grow"><span>Link bài gốc</span><input type="url" value={f.url} onChange={set('url')} placeholder="https://…" /></label>
              </div>
            </>
          )}
          <ErrorBox>{error}</ErrorBox>
          <div className="drawer-foot">
            {(kind === 'url' || kind === 'social_post') && <button className="btn btn-primary" disabled={busy}>{busy ? 'Đang thêm…' : 'Thêm'}</button>}
            <button type="button" className="btn btn-ghost" onClick={onClose}>Đóng</button>
          </div>
        </form>
      </aside>
    </>
  )
}

// --- Thẻ VCWIKI + khoá học ghim (CE-26) ------------------------------------------------------------------------

function CardsTab({ p, run }) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [cq, setCq] = useState('')
  const dcq = useDebounced(cq)
  const { data: found } = useFetch(() => (p.can_edit && dq.trim() ? api.studioCards({ q: dq, limit: 12 }) : Promise.resolve([])), [dq, p.can_edit])
  const { data: courses } = useFetch(() => (p.can_edit && dcq.trim() ? api.projectPickCourses(p.id, { q: dcq }) : Promise.resolve([])), [dcq, p.can_edit, p.id])
  const pinned = new Set(p.cards.map((c) => c.card_id))
  const pinnedCourses = new Set((p.courses || []).map((c) => c.course_id))
  return (
    <div className="grid-2">
      <section className="card">
        <h2>Thẻ VCWIKI ghim <span className="muted small">({p.cards.length})</span></h2>
        <p className="muted small">Đội đọc trước khi làm; chiến dịch và Viết nhanh trong dự án lấy các thẻ này làm căn cứ (mã K…).</p>
        {!p.cards.length && <Empty>Chưa ghim thẻ nào.</Empty>}
        <ul className="list-plain">
          {p.cards.map((c) => (
            <li key={c.ref} className="row-between">
              <span className="chip">{c.ref}</span>
              <Link className="link grow ellipsis" to={`/wiki?card=${c.card_id}`}>{c.title}</Link>
              <span className="muted small nowrap">{CARD_TYPE[c.type]?.label || c.type} · {CARD_STATUS[c.status]?.label || c.status}</span>
              {p.can_edit && <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => run(() => api.unpinProjectCard(p.id, c.ref))}>Bỏ</button>}
            </li>
          ))}
        </ul>
        {p.can_edit && (
          <>
            <label className="field"><span>Tìm thẻ để ghim</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Từ khoá trong thẻ…" /></label>
            {found?.length > 0 && (
              <ul className="list-plain">
                {found.map((c) => (
                  <li key={c.id} className="row-between">
                    <span className="grow ellipsis">{c.title} <span className="muted small">· {CARD_TYPE[c.type]?.label || c.type}</span></span>
                    <button type="button" className="btn btn-sm" disabled={pinned.has(c.id)} onClick={() => run(() => api.pinProjectCard(p.id, c.id))}>{pinned.has(c.id) ? 'Đã ghim' : '+ Ghim'}</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      <section className="card">
        <h2>Khoá học ghim <span className="muted small">({p.courses?.length || 0})</span></h2>
        <p className="muted small">Lộ trình / khoá ở phần Học tập mà thành viên dự án nên học (mã L…).</p>
        {!(p.courses || []).length && <Empty>Chưa ghim khoá nào.</Empty>}
        <ul className="list-plain">
          {(p.courses || []).map((c) => (
            <li key={c.ref} className="row-between">
              <span className="chip">{c.ref}</span>
              <Link className="link grow ellipsis" to={`/learn/paths/${c.course_id}`}>{c.title}</Link>
              {p.can_edit && <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => run(() => api.unpinProjectCourse(p.id, c.ref))}>Bỏ</button>}
            </li>
          ))}
        </ul>
        {p.can_edit && (
          <>
            <label className="field"><span>Tìm khoá để ghim</span><input type="search" value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Tên lộ trình / khoá…" /></label>
            {courses?.length > 0 && (
              <ul className="list-plain">
                {courses.map((c) => (
                  <li key={c.id} className="row-between">
                    <span className="grow ellipsis">{c.title}</span>
                    <button type="button" className="btn btn-sm" disabled={pinnedCourses.has(c.id)} onClick={() => run(() => api.pinProjectCourse(p.id, c.id))}>{pinnedCourses.has(c.id) ? 'Đã ghim' : '+ Ghim'}</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}

// --- Chiến dịch / Viết nhanh trong dự án ------------------------------------------------------------------------

function CampaignsTab({ p }) {
  const navigate = useNavigate()
  const { data, error } = useFetch(() => api.campaigns({ project_id: p.id, page_size: 100 }), [p.id])
  return (
    <>
      <div className="row-between">
        <p className="muted small grow">Chiến dịch lập trong dự án nằm ở kho của dự án và mặc định lấy video / bài mẫu / trang web / thẻ ghim từ kho dự án.</p>
        {p.can_edit && p.status === 'active' && <Link className="btn btn-primary" to={`/studio/new?project=${p.id}`}>+ Chiến dịch trong dự án</Link>}
      </div>
      <ErrorBox>{error}</ErrorBox>
      {data?.items.length === 0 && <Empty>Chưa có chiến dịch nào trong dự án. Chiến dịch có sẵn có thể gán vào dự án ở trang chiến dịch.</Empty>}
      {data?.items.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <caption className="sr-only">Chiến dịch trong dự án {p.name}</caption>
            <thead><tr><th scope="col">Chiến dịch</th><th scope="col">Trạng thái</th><th scope="col" className="num">Mục</th><th scope="col">Tạo lúc</th></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} data-id={c.id} data-status={c.overall} data-testid="project-campaign-row" onClick={() => navigate(`/studio/${c.id}`)}>
                  <td><Link className="strong clamp-1" to={`/studio/${c.id}`}>{c.name}</Link><div className="muted small clamp-1">{c.brief?.goal}</div></td>
                  <td><CampaignStatus s={c.overall} /></td>
                  <td className="num">{c.episode_count || Object.values(c.targets || {}).reduce((a, b) => a + b, 0)}</td>
                  <td className="nowrap small">{dateTime(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function ContentsTab({ p }) {
  const navigate = useNavigate()
  const { data, error } = useFetch(() => api.quickList({ project_id: p.id, page_size: 100 }), [p.id])
  return (
    <>
      <div className="row-between">
        <p className="muted small grow">Bài Viết nhanh làm trong dự án: AI dùng thẻ ghim của dự án làm căn cứ. Bài có sẵn gán vào dự án ở trang bài.</p>
        {p.can_edit && p.status === 'active' && <Link className="btn btn-primary" to={`/studio/quick?project=${p.id}`}>+ Viết nhanh trong dự án</Link>}
      </div>
      <ErrorBox>{error}</ErrorBox>
      {data?.items.length === 0 && <Empty>Chưa có bài Viết nhanh nào trong dự án.</Empty>}
      {data?.items.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <caption className="sr-only">Bài Viết nhanh trong dự án {p.name}</caption>
            <thead><tr><th scope="col">Nội dung</th><th scope="col">Loại</th><th scope="col">Trạng thái</th><th scope="col">Tạo lúc</th></tr></thead>
            <tbody>
              {data.items.map((x) => (
                <tr key={x.id} data-id={x.id} data-status={x.status === 'done' ? (x.review_status || 'draft') : x.overall} data-testid="project-quick-row" onClick={() => navigate(`/studio/quick/${x.id}`)}>
                  <td><Link className="strong clamp-1" to={`/studio/quick/${x.id}`}>{x.title}</Link><div className="muted small">{x.created_by_name}</div></td>
                  <td className="small">{x.type_label}</td>
                  <td className="small">{x.status === 'done' ? (x.review_status === 'approved' ? 'Đã duyệt' : x.review_status === 'rejected' ? 'Loại' : 'Nháp') : x.overall}</td>
                  <td className="nowrap small">{dateTime(x.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
