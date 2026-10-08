import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { Badge, Empty, ErrorBox, Loading } from '../components/ui'
import { confirmDialog } from '../components/dialog'
import { SpaceSelect } from '../components/pickers'

// Hồ sơ người đứng tên (BA CE-18): giọng, chủ đề được / không được nói, bài mẫu — dùng cho FB cá nhân, LinkedIn, tác giả bài SEO
const EMPTY = {
  name: '', title: '', expertise: '', voice: '', catchphrases: '', topics_ok: '', topics_avoid: '',
  samples: [''], consent: false, consent_note: '',
}

export default function Authors() {
  const { data, error, loading, reload } = useFetch(() => api.authors(), [])
  const [editing, setEditing] = useState(null)   // null | 'new' | author

  return (
    <>
      <Link className="crumb link" to="/studio">‹ Xưởng chiến dịch</Link>
      <header className="page-head">
        <div>
          <h1>Người đứng tên</h1>
          <p className="muted">
            Hồ sơ giọng của người thật đứng tên nội dung (Facebook cá nhân, LinkedIn, tác giả bài SEO). AI học giọng từ hồ sơ và bài mẫu,
            chỉ nói trong chủ đề được phép. Người đứng tên phải <b>đồng ý</b> và duyệt nội dung đăng dưới tên mình.
          </p>
        </div>
        <button className="btn btn-primary" data-testid="authors-author-create" onClick={() => setEditing('new')}>+ Người đứng tên</button>
      </header>
      <ErrorBox>{error}</ErrorBox>
      {loading && !data && <Loading />}
      {data?.length === 0 && <Empty>Chưa có hồ sơ nào. Luồng bài mạng xã hội cần hồ sơ này cho kênh Facebook cá nhân / LinkedIn cá nhân.</Empty>}
      {data?.length > 0 && (
        <div className="grid-2 author-grid">
          {data.map((a) => (
            <section key={a.id} className="card author-card" aria-labelledby={`author-${a.id}`} data-id={a.id} data-status={a.consent ? 'consented' : 'no-consent'}>
              <div className="row-between">
                <div>
                  <div className="strong" id={`author-${a.id}`}>{a.name}</div>
                  <div className="muted small">{a.title} · {a.space_name}</div>
                </div>
                {a.consent ? <Badge tone="good">Đã đồng ý</Badge> : <Badge tone="warn">Chưa đồng ý</Badge>}
              </div>
              {a.expertise && <p className="small clamp-2">{a.expertise}</p>}
              {a.voice && <p className="small muted clamp-2">Giọng: {a.voice}</p>}
              <div className="meta"><span>{a.samples?.length || 0} bài mẫu</span></div>
              {a.can_edit && <div className="actions"><button className="btn btn-ghost" aria-label={`Sửa hồ sơ: ${a.name}`} data-testid="authors-author-edit" onClick={() => setEditing(a)}>Sửa</button></div>}
            </section>
          ))}
        </div>
      )}
      {editing && <AuthorForm author={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </>
  )
}

function AuthorForm({ author, onClose, onSaved }) {
  const { data: spaces } = useFetch(api.spaces, [])
  const [f, setF] = useState(author ? { ...EMPTY, ...author, samples: author.samples?.length ? author.samples : [''] } : EMPTY)
  const [spaceId, setSpaceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const personal = spaces?.find((s) => s.type === 'personal' && s.my_role === 'owner')
  useEffect(() => { if (!author && personal && !spaceId) setSpaceId(personal.id) }, [author, personal, spaceId])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const titleId = useId()
  const title = author ? `Sửa: ${author.name}` : 'Người đứng tên mới'

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const body = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, f[k]]))
    body.samples = f.samples.filter((x) => x.trim())
    try {
      if (author) await api.patchAuthor(author.id, body)
      else await api.createAuthor({ ...body, space_id: spaceId || null })
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!(await confirmDialog({ title: `Xoá hồ sơ ${author.name}?`, body: 'Chiến dịch đã lập vẫn giữ bản chụp hồ sơ.', okLabel: 'Xoá hồ sơ', danger: true }))) return
    try {
      await api.deleteAuthor(author.id)
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="overlay" aria-hidden="true" onClick={onClose} />
      <aside className="drawer drawer-wide" role="dialog" aria-labelledby={titleId} data-testid="author-form">
        <div className="drawer-head">
          <h2 className="grow" id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={`Đóng: ${title}`} title="Đóng">✕</button>
        </div>
        <form className="drawer-body form" onSubmit={save}>
          <div className="row">
            <label className="field grow2"><span>Họ tên *</span><input value={f.name} onChange={set('name')} required maxLength={100} /></label>
            <label className="field"><span>Chức danh</span><input value={f.title} onChange={set('title')} placeholder="VD: Kỹ thuật trưởng VC Garage" /></label>
          </div>
          {!author && <label className="field"><span>Lưu vào kho</span><SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly /></label>}
          <label className="field"><span>Lĩnh vực / kinh nghiệm thật</span>
            <textarea rows={2} value={f.expertise} onChange={set('expertise')} placeholder="VD: 15 năm sửa chữa, chuyên chẩn đoán điện – điều hoà; đào tạo 200 thợ" />
          </label>
          <div className="grid-2">
            <label className="field"><span>Giọng, cách xưng hô</span>
              <textarea rows={2} value={f.voice} onChange={set('voice')} placeholder="VD: xưng anh – các em; thẳng, hơi hài, câu ngắn" />
            </label>
            <label className="field"><span>Câu cửa miệng</span>
              <textarea rows={2} value={f.catchphrases} onChange={set('catchphrases')} placeholder="VD: “Nói thật nhé…”, “Xe không biết nói dối”" />
            </label>
            <label className="field"><span>Chủ đề được nói</span>
              <textarea rows={2} value={f.topics_ok} onChange={set('topics_ok')} placeholder="VD: nghề sửa xe, quản lý xưởng, đào tạo thợ" />
            </label>
            <label className="field"><span>Chủ đề KHÔNG được nói</span>
              <textarea rows={2} value={f.topics_avoid} onChange={set('topics_avoid')} placeholder="VD: chính trị, so sánh đối thủ, lương cụ thể của nhân viên" />
            </label>
          </div>
          <div className="field">
            <span>Bài mẫu do chính người này viết <em>(tối đa 5 — AI học giọng, không chép)</em></span>
            {f.samples.map((x, i) => (
              <div key={i} className="row">
                <textarea rows={3} value={x} aria-label={`Bài mẫu ${i + 1}`} onChange={(e) => setF({ ...f, samples: f.samples.map((y, j) => (j === i ? e.target.value : y)) })} />
                {f.samples.length > 1 && <button type="button" className="btn btn-ghost btn-danger-text" aria-label={`Bỏ bài mẫu ${i + 1}`} onClick={() => setF({ ...f, samples: f.samples.filter((_, j) => j !== i) })}>Bỏ</button>}
              </div>
            ))}
            {f.samples.length < 5 && <button type="button" className="btn btn-ghost" onClick={() => setF({ ...f, samples: [...f.samples, ''] })}>+ Thêm bài mẫu</button>}
          </div>
          <div className="checks">
            <label><input type="checkbox" checked={f.consent} onChange={set('consent')} /> Người này đã đồng ý cho nội dung đăng dưới tên mình và sẽ duyệt trước khi đăng</label>
          </div>
          {f.consent && <label className="field"><span>Ghi chú đồng ý</span><input value={f.consent_note} onChange={set('consent_note')} placeholder="VD: đồng ý qua email ngày 24/09/2026" /></label>}
          <ErrorBox>{error}</ErrorBox>
          <div className="drawer-foot">
            <button className="btn btn-primary" disabled={busy} data-testid="author-form-save">{busy ? 'Đang lưu…' : 'Lưu'}</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button>
            {author && <button type="button" className="btn btn-ghost btn-danger-text" aria-label={`Xoá hồ sơ: ${author.name}`} data-testid="author-form-delete" onClick={remove}>Xoá</button>}
          </div>
        </form>
      </aside>
    </>
  )
}
