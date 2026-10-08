import { useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { PROJECT_ROLE, dateTime } from '../format'
import { Badge, Empty, ErrorBox, Loading } from '../components/ui'
import { SpaceSelect } from '../components/pickers'

// Dự án marketing (BA 5.13): tầng trên chiến dịch / Viết nhanh — kho tài nguyên tham chiếu, thẻ học, thành viên.
export default function Projects() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('active')
  const [creating, setCreating] = useState(false)
  const { data, error, loading, reload } = useFetch(() => api.projects({ status }), [status])

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Dự án marketing</h1>
          <p className="muted">
            Một dự án (VD: <i>Marketing xưởng VCS</i>) gom <b>tài nguyên tham chiếu</b> (video, trang web, bài mẫu, tài liệu),
            <b> thẻ VCWIKI</b> để đội học trước, và các <b>chiến dịch</b> / <b>bài Viết nhanh</b> làm trong dự án — chiến dịch lấy tham chiếu từ kho dự án, không phải dán lại.
          </p>
        </div>
        <button className="btn btn-primary" data-testid="projects-project-create" onClick={() => setCreating(true)}>+ Dự án mới</button>
      </header>
      <section className="filters card" role="search" aria-label="Lọc dự án">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lọc trạng thái">
          <option value="active">Đang chạy</option>
          <option value="archived">Đã lưu trữ</option>
          <option value="all">Tất cả</option>
        </select>
      </section>
      <ErrorBox>{error}</ErrorBox>
      {loading && !data && <Loading />}
      {data?.length === 0 && <Empty>Chưa có dự án nào. Bấm <b>+ Dự án mới</b> để tạo dự án đầu tiên.</Empty>}
      {data?.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <caption className="sr-only">Danh sách dự án marketing</caption>
            <thead><tr><th scope="col">Dự án</th><th scope="col">Kho</th><th scope="col">Vai trò của tôi</th><th scope="col" className="num">Tài nguyên</th><th scope="col" className="num">Thẻ</th><th scope="col">Cập nhật</th></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} data-id={p.id} data-status={p.status} data-testid="projects-project-row" onClick={() => navigate(`/studio/projects/${p.id}`)}>
                  <td className="cell-video">
                    <Link className="strong clamp-1" to={`/studio/projects/${p.id}`}>{p.name}</Link>
                    <div className="muted small clamp-1">{p.goal}</div>
                    {p.status === 'archived' && <Badge tone="muted">Đã lưu trữ</Badge>}
                  </td>
                  <td className="small">{p.space_name}</td>
                  <td className="small">{PROJECT_ROLE[p.my_role] || '—'}</td>
                  <td className="num">{p.resource_count}</td>
                  <td className="num">{p.card_count}</td>
                  <td className="nowrap small">{dateTime(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <ProjectForm onClose={() => setCreating(false)} onSaved={(p) => { setCreating(false); reload(); navigate(`/studio/projects/${p.id}`) }} />}
    </>
  )
}

// Tạo mới / sửa dự án (ngăn kéo bên phải như Người đứng tên)
export function ProjectForm({ project, onClose, onSaved }) {
  const { data: spaces } = useFetch(api.spaces, [])
  const [f, setF] = useState({ name: project?.name || '', goal: project?.goal || '', description: project?.description || '' })
  const [spaceId, setSpaceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const personal = spaces?.find((s) => s.type === 'personal' && s.my_role === 'owner')
  useEffect(() => { if (!project && personal && !spaceId) setSpaceId(personal.id) }, [project, personal, spaceId])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const titleId = useId()
  const title = project ? `Sửa: ${project.name}` : 'Dự án mới'

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const saved = project ? await api.patchProject(project.id, f) : await api.createProject({ ...f, space_id: spaceId || null })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <>
      <div className="overlay" aria-hidden="true" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-labelledby={titleId} data-testid="project-form">
        <div className="drawer-head">
          <h2 className="grow" id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={`Đóng: ${title}`} title="Đóng">✕</button>
        </div>
        <form className="drawer-body form" onSubmit={save}>
          <label className="field"><span>Tên dự án *</span>
            <input value={f.name} onChange={set('name')} required maxLength={150} placeholder="VD: Marketing xưởng VCS" autoFocus />
          </label>
          {!project && (
            <label className="field"><span>Thuộc kho</span>
              <SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly />
              <small>Chiến dịch và bài viết trong dự án nằm ở kho này; quyền xem / sửa theo kho cộng với vai trò trong dự án.</small>
            </label>
          )}
          <label className="field"><span>Mục tiêu</span>
            <textarea rows={3} value={f.goal} onChange={set('goal')} maxLength={2000} placeholder="VD: Tăng 30% khách sửa xe mới trong quý 4, xây kênh TikTok xưởng lên 10.000 người theo dõi" />
          </label>
          <label className="field"><span>Mô tả</span>
            <textarea rows={5} value={f.description} onChange={set('description')} maxLength={5000} placeholder="Bối cảnh, phạm vi, điều cần tránh… (Markdown)" />
          </label>
          <ErrorBox>{error}</ErrorBox>
          <div className="drawer-foot">
            <button className="btn btn-primary" disabled={busy} data-testid="project-form-save">{busy ? 'Đang lưu…' : project ? 'Lưu' : 'Tạo dự án'}</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button>
          </div>
        </form>
      </aside>
    </>
  )
}
